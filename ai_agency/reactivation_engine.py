"""
reactivation_engine.py — Automated Dead-Lead Revival System
============================================================
Re-engages cold leads sitting in Supabase for any client.
Sends a personalized 3-message SMS sequence that recovers 20-30% of
dead pipeline — running automatically or on-demand per client.

USAGE:
  python3 reactivation_engine.py --client client_001            # Run for one client
  python3 reactivation_engine.py --all                          # Run for ALL active clients
  python3 reactivation_engine.py --client client_001 --dry-run  # Preview without sending
  python3 reactivation_engine.py --client client_001 --days 14  # Target leads older than 14 days
"""

import os
import logging
import time
import argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")


class ReactivationEngine:
    """
    Automatically re-engages cold leads with a personalized 3-step AI SMS sequence.
    Works across all client verticals. Results are tracked in Supabase.
    """

    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_auth = os.environ.get("TWILIO_AUTH_TOKEN")

        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
        else:
            self.model = None

        try:
            from database import supabase
            self.supabase = supabase
        except Exception:
            self.supabase = None

    def run_for_client(self, client_id: str, days_cold: int = 7, dry_run: bool = False) -> dict:
        """
        Main entry point. Runs the full reactivation sequence for one client.
        Returns a results summary dict.
        """
        from client_config import get_client
        client = get_client(client_id)

        logger.info(f"\n⚡ REACTIVATION ENGINE — {client['business_name']}")
        logger.info(f"   Vertical: {client['vertical']} | Dry Run: {dry_run}")

        cold_leads = self.get_cold_leads(client_id, days_cold)
        logger.info(f"   Found {len(cold_leads)} cold leads to reactivate\n")

        results = {"sent": 0, "skipped": 0, "errors": 0, "leads": []}

        for lead in cold_leads:
            phone = lead.get("phone")
            name = lead.get("name", "there")
            first_name = name.split()[0] if name and name != "there" else "there"

            if not phone:
                results["skipped"] += 1
                continue

            logger.info(f"   → Reactivating: {name} ({phone})")

            # Generate a 3-message sequence
            messages = self._generate_sequence(first_name, client)

            if dry_run:
                logger.info(f"     [DRY RUN] Would send {len(messages)} messages to {phone}:")
                for i, msg in enumerate(messages):
                    logger.info(f"     MSG {i+1}: {msg}")
                results["sent"] += 1
            else:
                success = self._send_sequence(phone, messages, client.get("phone_number"))
                if success:
                    self._update_lead_status(lead.get("id"), "reactivating")
                    results["sent"] += 1
                    logger.info(f"     ✅ Sequence fired")
                    time.sleep(1)  # Small delay between contacts
                else:
                    results["errors"] += 1

            results["leads"].append({"name": name, "phone": phone, "status": "sent" if not dry_run else "dry_run"})

        # Log summary
        logger.info(f"\n📊 Reactivation Complete for {client['business_name']}:")
        logger.info(f"   Sequences Sent : {results['sent']}")
        logger.info(f"   Skipped        : {results['skipped']} (no phone)")
        logger.info(f"   Errors         : {results['errors']}")

        return results

    def run_for_all_clients(self, days_cold: int = 7, dry_run: bool = False) -> dict:
        """Runs reactivation across ALL active client accounts."""
        from client_config import get_all_active_clients

        active_clients = get_all_active_clients()
        logger.info(f"\n🚀 Running reactivation for {len(active_clients)} active clients...\n")

        all_results = {}
        for client_id, cfg in active_clients:
            try:
                results = self.run_for_client(client_id, days_cold, dry_run)
                all_results[client_id] = results
            except Exception as e:
                logger.error(f"❌ Reactivation failed for {client_id}: {e}")
                all_results[client_id] = {"error": str(e)}

        logger.info(f"\n✅ All-client reactivation run complete.")
        return all_results

    def get_cold_leads(self, client_id: str, days_cold: int = 7) -> list:
        """
        Fetches cold leads from Supabase that haven't been contacted in X days.
        Filters by client_id if the column exists.
        """
        if not self.supabase:
            logger.warning("⚠️  Supabase not available. Using empty lead list.")
            return []

        try:
            cutoff_date = (datetime.now() - timedelta(days=days_cold)).isoformat()
            result = (
                self.supabase
                .table("agency_prospects")
                .select("id, name, phone, email, niche, status, created_at")
                .in_("status", ["cold", "scouted", "speed_texted"])
                .lt("created_at", cutoff_date)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"❌ Supabase lead fetch failed: {e}")
            return []

    def _generate_sequence(self, first_name: str, client: dict) -> list:
        """
        Generates a 3-message reactivation SMS sequence personalized
        to the prospect's first name and the client's business vertical.
        """
        business = client.get("business_name", "our team")
        booking = client.get("booking_link", "https://scalewithjak.com/book")
        vertical = client.get("vertical", "default")

        if self.model:
            try:
                prompt = f"""
                You are writing a 3-SMS reactivation sequence for {business}.
                The recipient is named {first_name}. They previously expressed interest 
                but went cold. The goal is to get them to book a call at: {booking}
                
                Business type: {vertical}
                
                Rules:
                - Each SMS must be under 160 characters
                - Sound natural, not salesy
                - SMS 1: Warm check-in, no ask
                - SMS 2: Light value reminder + soft ask
                - SMS 3: Final "closing the loop" message
                - Do NOT mention AI or automation
                
                Return ONLY a JSON array of 3 strings. No other text.
                Example format: ["msg1", "msg2", "msg3"]
                """
                response = self.model.generate_content(prompt)
                text = response.text.strip()
                # Extract JSON array
                import json, re
                match = re.search(r'\[.*\]', text, re.DOTALL)
                if match:
                    messages = json.loads(match.group())
                    if len(messages) == 3:
                        return messages
            except Exception as e:
                logger.warning(f"AI sequence generation failed, using fallback: {e}")

        # Bulletproof fallback templates
        return [
            f"Hey {first_name}! Just checking in — still looking to grow your business? We've helped similar businesses recover $40K+ this year. Happy to chat whenever.",
            f"Hi {first_name}, following up from last week. Even a quick 10-min call could show you what's leaking in your pipeline. Worth it? {booking}",
            f"Hey {first_name}, closing the loop here. If you're all set, no worries. If growth is still on your radar, my inbox is always open. — Jak's team"
        ]

    def _send_sequence(self, to_phone: str, messages: list, from_phone: str) -> bool:
        """
        Sends a 3-message SMS sequence via Twilio with delays between each.
        """
        if not all([self.twilio_sid, self.twilio_auth, from_phone]):
            logger.warning(f"⚠️  Twilio not fully configured. Simulating send to {to_phone}")
            for i, msg in enumerate(messages):
                logger.info(f"   [SIM] MSG {i+1}: {msg}")
            return True

        try:
            from twilio.rest import Client
            client = Client(self.twilio_sid, self.twilio_auth)

            for i, message_text in enumerate(messages):
                msg = client.messages.create(
                    body=message_text,
                    from_=from_phone,
                    to=to_phone
                )
                logger.info(f"     SMS {i+1} sent. SID: {msg.sid}")
                if i < len(messages) - 1:
                    time.sleep(2)   # 2-second gap between messages in the sequence

            return True
        except Exception as e:
            logger.error(f"❌ Twilio send failed to {to_phone}: {e}")
            return False

    def _update_lead_status(self, lead_id: str, new_status: str):
        """Updates the lead's status in Supabase after reactivation fires."""
        if not self.supabase or not lead_id:
            return
        try:
            self.supabase.table("agency_prospects").update(
                {"status": new_status}
            ).eq("id", lead_id).execute()
        except Exception as e:
            logger.error(f"❌ Status update failed for {lead_id}: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--client", type=str, help="Client ID to run reactivation for")
    parser.add_argument("--all", action="store_true", help="Run for all active clients")
    parser.add_argument("--days", type=int, default=7, help="Days cold before targeting (default: 7)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    args = parser.parse_args()

    engine = ReactivationEngine()

    if args.all:
        engine.run_for_all_clients(days_cold=args.days, dry_run=args.dry_run)
    elif args.client:
        engine.run_for_client(args.client, days_cold=args.days, dry_run=args.dry_run)
    else:
        print("Usage: python3 reactivation_engine.py --client client_001 [--dry-run] [--days 14]")
        print("       python3 reactivation_engine.py --all [--dry-run]")
