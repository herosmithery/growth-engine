import os
import json
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from twilio.rest import Client as TwilioClient
from database import get_db

load_dotenv()
logger = logging.getLogger(__name__)

# Niche-specific job templates
JOB_TEMPLATES = {
    "medspa": {
        "appointment_types": ["Botox", "Filler", "Hydrafacial", "Laser", "Consultation"],
        "avg_duration_mins": {"Botox": 30, "Filler": 45, "Hydrafacial": 60, "Laser": 45, "Consultation": 20},
        "confirmation_msg": "Hi {client_name}! Reminder: your {service} appointment at {business_name} is confirmed for {datetime}. Reply STOP to cancel or HELP to reschedule.",
        "no_show_msg": "Hi {client_name}, we noticed you missed your {service} appointment today. We'd love to get you rescheduled — reply here or call us anytime."
    },
    "veterinary clinic": {
        "appointment_types": ["Wellness Exam", "Vaccination", "Surgery", "Dental", "Emergency", "Follow-up"],
        "avg_duration_mins": {"Wellness Exam": 30, "Vaccination": 15, "Surgery": 120, "Dental": 90, "Emergency": 45, "Follow-up": 20},
        "confirmation_msg": "Hi {client_name}! Reminder: {pet_name}'s {service} appointment at {business_name} is confirmed for {datetime}. Reply STOP to cancel or HELP to reschedule.",
        "no_show_msg": "Hi {client_name}, we missed you for {pet_name}'s {service} appointment today. Please call us to reschedule — your pet's health is our priority."
    }
}


class DispatchAgent:
    """
    AI-powered appointment dispatcher for MedSpas and Vet Clinics.
    - Optimizes technician/provider scheduling by availability + travel time
    - Sends Twilio SMS confirmations 24hrs before appointments
    - Detects likely no-shows and triggers re-engagement
    - Integrates with Google Maps Distance Matrix for multi-location routing
    """

    def __init__(self):
        self.google_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.environ.get("TWILIO_PHONE_NUMBER", "")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        self.twilio = TwilioClient(self.twilio_sid, self.twilio_token) if self.twilio_sid else None
        self.db = get_db()

    def optimize_schedule(self, appointments, providers, niche="veterinary clinic"):
        """
        Takes a list of appointments and providers, returns an optimized schedule.

        appointments: [{"id", "client_name", "service", "duration_mins", "preferred_time", "address", "phone", "pet_name"(vet only)}]
        providers: [{"id", "name", "skills", "location", "available_slots": ["HH:MM", ...]}]
        """
        logger.info(f"Optimizing schedule for {len(appointments)} appointments across {len(providers)} providers...")

        template = JOB_TEMPLATES.get(niche.lower(), JOB_TEMPLATES["veterinary clinic"])

        prompt = f"""
        You are an intelligent scheduler for a {niche}.

        Providers available today:
        {json.dumps(providers, indent=2)}

        Appointments to schedule:
        {json.dumps(appointments, indent=2)}

        Rules:
        1. Match each appointment to the best-fit provider based on their skills.
        2. Avoid double-booking — respect each provider's available time slots.
        3. Group nearby client locations together when possible to minimize travel.
        4. Flag any appointment that cannot be filled as "unassigned".
        5. Estimate no-show risk (HIGH/LOW) for each appointment based on lead time and history notes.

        Return JSON array:
        [
          {{
            "appointment_id": "...",
            "provider_id": "...",
            "provider_name": "...",
            "scheduled_time": "HH:MM",
            "estimated_duration_mins": int,
            "no_show_risk": "HIGH" or "LOW",
            "routing_note": "brief note on location/travel"
          }}
        ]
        """

        try:
            response = self.model.generate_content(
                contents=f"Return ONLY valid JSON.\n\n{prompt}"
            )
            clean = response.text.replace("```json", "").replace("```", "").strip()
            schedule = json.loads(clean)
            logger.info(f"Schedule optimized: {len(schedule)} slots assigned.")
            return schedule
        except Exception as e:
            logger.error(f"Schedule optimization failed: {e}")
            return []

    def get_travel_time(self, origin, destination):
        """Uses Google Maps Distance Matrix to get travel time between two addresses."""
        if not self.google_key:
            return None
        try:
            params = {
                "origins": origin,
                "destinations": destination,
                "key": self.google_key,
                "mode": "driving"
            }
            r = requests.get("https://maps.googleapis.com/maps/api/distancematrix/json", params=params)
            data = r.json()
            element = data["rows"][0]["elements"][0]
            if element["status"] == "OK":
                return element["duration"]["value"] // 60  # minutes
            return None
        except Exception as e:
            logger.warning(f"Maps API failed: {e}")
            return None

    def send_confirmation_sms(self, phone, client_name, service, business_name,
                               scheduled_datetime, niche="veterinary clinic", pet_name=""):
        """Sends a Twilio SMS appointment confirmation."""
        if not self.twilio:
            logger.warning("Twilio not configured — SMS skipped.")
            return False

        template = JOB_TEMPLATES.get(niche.lower(), JOB_TEMPLATES["veterinary clinic"])
        msg = template["confirmation_msg"].format(
            client_name=client_name,
            service=service,
            business_name=business_name,
            datetime=scheduled_datetime,
            pet_name=pet_name or "your pet"
        )

        try:
            message = self.twilio.messages.create(
                body=msg,
                from_=self.twilio_from,
                to=phone
            )
            logger.info(f"Confirmation SMS sent to {phone} — SID: {message.sid}")
            return True
        except Exception as e:
            logger.error(f"SMS failed for {phone}: {e}")
            return False

    def send_no_show_recovery(self, phone, client_name, service, niche="veterinary clinic", pet_name=""):
        """Sends a no-show recovery SMS to re-engage the client."""
        if not self.twilio:
            return False

        template = JOB_TEMPLATES.get(niche.lower(), JOB_TEMPLATES["veterinary clinic"])
        msg = template["no_show_msg"].format(
            client_name=client_name,
            service=service,
            pet_name=pet_name or "your pet"
        )

        try:
            message = self.twilio.messages.create(body=msg, from_=self.twilio_from, to=phone)
            logger.info(f"No-show recovery SMS sent — SID: {message.sid}")

            # Log to Supabase
            if self.db:
                self.db.table("dispatch_events").insert({
                    "event_type": "no_show_recovery",
                    "client_phone": phone,
                    "client_name": client_name,
                    "service": service,
                    "timestamp": datetime.utcnow().isoformat()
                }).execute()
            return True
        except Exception as e:
            logger.error(f"No-show SMS failed: {e}")
            return False

    def run_daily_dispatch(self, client_config):
        """
        Main entry point. Called by the orchestrator each morning.
        client_config: {"business_name", "niche", "appointments": [...], "providers": [...]}
        """
        business = client_config.get("business_name", "")
        niche = client_config.get("niche", "veterinary clinic")
        appointments = client_config.get("appointments", [])
        providers = client_config.get("providers", [])

        logger.info(f"Running daily dispatch for {business}...")

        if not appointments:
            logger.info("No appointments to dispatch today.")
            return []

        # 1. Optimize the schedule
        schedule = self.optimize_schedule(appointments, providers, niche)

        # 2. Send confirmation SMS to all scheduled appointments
        appt_map = {a["id"]: a for a in appointments}
        for slot in schedule:
            appt = appt_map.get(slot["appointment_id"], {})
            phone = appt.get("phone")
            if phone and slot.get("scheduled_time"):
                self.send_confirmation_sms(
                    phone=phone,
                    client_name=appt.get("client_name", ""),
                    service=appt.get("service", ""),
                    business_name=business,
                    scheduled_datetime=slot["scheduled_time"],
                    niche=niche,
                    pet_name=appt.get("pet_name", "")
                )

        # 3. Log schedule to Supabase
        if self.db:
            try:
                self.db.table("daily_schedules").insert({
                    "business_name": business,
                    "niche": niche,
                    "date": datetime.utcnow().date().isoformat(),
                    "total_appointments": len(appointments),
                    "scheduled": len([s for s in schedule if s.get("provider_id")]),
                    "high_no_show_risk": len([s for s in schedule if s.get("no_show_risk") == "HIGH"])
                }).execute()
            except Exception as e:
                logger.warning(f"Supabase log failed: {e}")

        logger.info(f"Dispatch complete: {len(schedule)} appointments scheduled.")
        return schedule


if __name__ == "__main__":
    agent = DispatchAgent()
    # Example test
    test_config = {
        "business_name": "Austin Urban Veterinary Center",
        "niche": "veterinary clinic",
        "appointments": [
            {"id": "1", "client_name": "Sarah M.", "service": "Wellness Exam", "duration_mins": 30,
             "preferred_time": "09:00", "address": "1234 Main St Austin TX", "phone": "+15551234567", "pet_name": "Bella"},
            {"id": "2", "client_name": "Tom R.", "service": "Vaccination", "duration_mins": 15,
             "preferred_time": "10:00", "address": "5678 Oak Ave Austin TX", "phone": "+15559876543", "pet_name": "Max"}
        ],
        "providers": [
            {"id": "vet1", "name": "Dr. Johnson", "skills": ["Wellness Exam", "Vaccination", "Surgery"],
             "location": "clinic", "available_slots": ["09:00", "10:00", "11:00", "14:00", "15:00"]},
            {"id": "vet2", "name": "Dr. Patel", "skills": ["Dental", "Surgery", "Follow-up"],
             "location": "clinic", "available_slots": ["09:30", "11:00", "13:00", "15:00"]}
        ]
    }
    schedule = agent.run_daily_dispatch(test_config)
    print(json.dumps(schedule, indent=2))
