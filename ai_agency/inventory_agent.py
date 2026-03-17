import os
import json
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai
from twilio.rest import Client as TwilioClient
from database import get_db

load_dotenv()
logger = logging.getLogger(__name__)

# Niche-specific inventory catalogs
INVENTORY_CATALOG = {
    "medspa": {
        "categories": {
            "injectables": {
                "items": ["Botox (units)", "Dysport (units)", "Xeomin (units)",
                          "Juvederm Ultra (syringe)", "Juvederm Voluma (syringe)",
                          "Restylane (syringe)", "Sculptra (vial)", "Kybella (vial)"],
                "unit": "units/syringes/vials",
                "reorder_lead_days": 3
            },
            "skincare": {
                "items": ["Hydrafacial tips (sets)", "Chemical peel solution (bottles)",
                          "Microneedling cartridges", "Numbing cream (tubes)"],
                "unit": "units",
                "reorder_lead_days": 5
            },
            "laser_consumables": {
                "items": ["Laser cooling gel (bottles)", "IPL filters", "Treatment tip covers"],
                "unit": "units",
                "reorder_lead_days": 7
            }
        },
        "alert_thresholds": {"critical": 5, "warning": 15},
        "avg_usage_per_appointment": {
            "Botox": {"Botox (units)": 40},
            "Filler": {"Juvederm Ultra (syringe)": 1},
            "Hydrafacial": {"Hydrafacial tips (sets)": 1, "Hydrafacial solution": 1},
            "Laser": {"Laser cooling gel (bottles)": 0.2}
        }
    },
    "veterinary clinic": {
        "categories": {
            "vaccines": {
                "items": ["Rabies vaccine (dose)", "DHPP vaccine (dose)", "Bordetella vaccine (dose)",
                          "Feline FVRCP (dose)", "Feline Leukemia (dose)", "Leptospirosis (dose)"],
                "unit": "doses",
                "reorder_lead_days": 2
            },
            "medications": {
                "items": ["Amoxicillin (tablets)", "Metronidazole (tablets)", "Carprofen (tablets)",
                          "Doxycycline (capsules)", "Prednisone (tablets)", "Apoquel (tablets)"],
                "unit": "tablets/capsules",
                "reorder_lead_days": 3
            },
            "surgical_supplies": {
                "items": ["Suture packs (3-0 Vicryl)", "Surgical gloves (pairs)", "Sterile drapes",
                          "Anesthesia circuits", "IV catheters (24g)", "IV fluids (1L bags)"],
                "unit": "units",
                "reorder_lead_days": 5
            },
            "diagnostics": {
                "items": ["Heartworm test kits", "Parvo test kits", "Urinalysis strips",
                          "Blood collection tubes"],
                "unit": "kits/units",
                "reorder_lead_days": 3
            }
        },
        "alert_thresholds": {"critical": 10, "warning": 25},
        "avg_usage_per_appointment": {
            "Vaccination": {"Rabies vaccine (dose)": 1, "DHPP vaccine (dose)": 1},
            "Wellness Exam": {"Blood collection tubes": 2},
            "Surgery": {"Suture packs (3-0 Vicryl)": 2, "Surgical gloves (pairs)": 4,
                        "IV fluids (1L bags)": 2, "IV catheters (24g)": 1}
        }
    }
}


class InventoryAgent:
    """
    AI-powered inventory management for MedSpas and Vet Clinics.
    - Tracks current stock levels per item
    - Forecasts depletion based on upcoming appointment schedule
    - Sends alerts when items hit warning/critical thresholds
    - Suggests reorder quantities based on usage patterns
    """

    def __init__(self):
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.environ.get("TWILIO_PHONE_NUMBER", "")
        self.alert_phone = os.environ.get("OWNER_PHONE_NUMBER", "")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        self.twilio = TwilioClient(self.twilio_sid, self.twilio_token) if self.twilio_sid else None
        self.db = get_db()

    def forecast_depletion(self, current_stock, upcoming_appointments, niche):
        """
        Predicts which items will run low based on upcoming appointment schedule.
        Returns a list of items at risk with estimated depletion dates.
        """
        catalog = INVENTORY_CATALOG.get(niche.lower(), INVENTORY_CATALOG["veterinary clinic"])
        usage_map = catalog.get("avg_usage_per_appointment", {})
        thresholds = catalog.get("alert_thresholds", {"critical": 10, "warning": 25})
        alerts = []

        # Count upcoming appointment types
        appt_counts = {}
        for appt in upcoming_appointments:
            service = appt.get("service", "")
            appt_counts[service] = appt_counts.get(service, 0) + 1

        # Calculate projected usage
        projected_usage = {}
        for service, count in appt_counts.items():
            usage = usage_map.get(service, {})
            for item, per_appt in usage.items():
                projected_usage[item] = projected_usage.get(item, 0) + (per_appt * count)

        # Check stock levels against projected usage
        for item, current_qty in current_stock.items():
            projected_use = projected_usage.get(item, 0)
            after_scheduled = current_qty - projected_use

            if after_scheduled <= thresholds["critical"]:
                alerts.append({
                    "item": item,
                    "current_qty": current_qty,
                    "projected_use": projected_use,
                    "remaining_after_schedule": max(0, after_scheduled),
                    "severity": "CRITICAL",
                    "action": "Order immediately"
                })
            elif after_scheduled <= thresholds["warning"]:
                alerts.append({
                    "item": item,
                    "current_qty": current_qty,
                    "projected_use": projected_use,
                    "remaining_after_schedule": max(0, after_scheduled),
                    "severity": "WARNING",
                    "action": "Order within 2 days"
                })

        return alerts

    def generate_reorder_suggestions(self, alerts, niche, weekly_appointment_count):
        """Uses Gemini to generate smart reorder quantities based on usage trends."""
        if not alerts:
            return []

        prompt = f"""
        You are an inventory manager for a {niche}.
        Weekly appointment volume: {weekly_appointment_count}

        The following items need to be reordered:
        {json.dumps(alerts, indent=2)}

        For each item, suggest:
        1. Recommended reorder quantity (enough for 3 weeks of usage + 20% buffer)
        2. Estimated cost range (rough industry average)
        3. Priority (URGENT / NORMAL)

        Return JSON array:
        [
          {{
            "item": "...",
            "reorder_qty": int,
            "estimated_cost_range": "$XX-$XX",
            "priority": "URGENT" or "NORMAL",
            "notes": "brief note"
          }}
        ]
        """

        try:
            response = self.model.generate_content(f"Return ONLY valid JSON.\n\n{prompt}")
            clean = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except Exception as e:
            logger.error(f"Reorder suggestion failed: {e}")
            return [{"item": a["item"], "priority": a["severity"], "reorder_qty": 50} for a in alerts]

    def send_stock_alert(self, business_name, alerts, reorder_suggestions):
        """Sends an SMS stock alert to the business owner."""
        if not self.twilio or not self.alert_phone:
            logger.warning("Twilio or owner phone not configured — alert skipped.")
            return False

        critical = [a for a in alerts if a["severity"] == "CRITICAL"]
        warning = [a for a in alerts if a["severity"] == "WARNING"]

        lines = [f"Stock Alert — {business_name}"]
        if critical:
            lines.append(f"CRITICAL ({len(critical)} items): " + ", ".join(a["item"] for a in critical[:3]))
        if warning:
            lines.append(f"Warning ({len(warning)} items): " + ", ".join(a["item"] for a in warning[:3]))
        lines.append("Reply REORDER to get the full list sent to your email.")

        msg = "\n".join(lines)

        try:
            self.twilio.messages.create(body=msg, from_=self.twilio_from, to=self.alert_phone)
            logger.info(f"Stock alert SMS sent to {self.alert_phone}")
            return True
        except Exception as e:
            logger.error(f"Stock alert SMS failed: {e}")
            return False

    def run_inventory_check(self, client_config):
        """
        Main entry point. Called by orchestrator after daily schedule is set.
        client_config: {"business_name", "niche", "current_stock": {item: qty}, "upcoming_appointments": [...]}
        """
        business = client_config.get("business_name", "")
        niche = client_config.get("niche", "veterinary clinic")
        current_stock = client_config.get("current_stock", {})
        upcoming = client_config.get("upcoming_appointments", [])

        logger.info(f"Running inventory check for {business}...")

        # 1. Forecast depletion
        alerts = self.forecast_depletion(current_stock, upcoming, niche)

        if not alerts:
            logger.info("All stock levels healthy.")
            return {"status": "healthy", "alerts": []}

        # 2. Generate reorder suggestions
        reorder = self.generate_reorder_suggestions(alerts, niche, len(upcoming))

        # 3. Send SMS alert
        self.send_stock_alert(business, alerts, reorder)

        # 4. Log to Supabase
        if self.db:
            try:
                self.db.table("inventory_alerts").insert({
                    "business_name": business,
                    "niche": niche,
                    "timestamp": datetime.utcnow().isoformat(),
                    "critical_count": len([a for a in alerts if a["severity"] == "CRITICAL"]),
                    "warning_count": len([a for a in alerts if a["severity"] == "WARNING"]),
                    "alerts": json.dumps(alerts),
                    "reorder_suggestions": json.dumps(reorder)
                }).execute()
            except Exception as e:
                logger.warning(f"Supabase log failed: {e}")

        logger.info(f"Inventory check done: {len(alerts)} alerts ({len([a for a in alerts if a['severity']=='CRITICAL'])} critical)")
        return {"status": "alerts_sent", "alerts": alerts, "reorder": reorder}


if __name__ == "__main__":
    agent = InventoryAgent()
    test_config = {
        "business_name": "Austin Urban Veterinary Center",
        "niche": "veterinary clinic",
        "current_stock": {
            "Rabies vaccine (dose)": 8,
            "DHPP vaccine (dose)": 30,
            "Suture packs (3-0 Vicryl)": 4,
            "IV fluids (1L bags)": 6,
            "Apoquel (tablets)": 200
        },
        "upcoming_appointments": [
            {"service": "Vaccination"}, {"service": "Vaccination"}, {"service": "Vaccination"},
            {"service": "Vaccination"}, {"service": "Vaccination"}, {"service": "Vaccination"},
            {"service": "Surgery"}, {"service": "Surgery"},
            {"service": "Wellness Exam"}, {"service": "Wellness Exam"}
        ]
    }
    result = agent.run_inventory_check(test_config)
    print(json.dumps(result, indent=2))
