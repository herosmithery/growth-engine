"""
trades_triage_agent.py — 24/7 Emergency AI Dispatcher for Home Services
========================================================================
Handles inbound after-hours emergency calls/texts for the Trades vertical
(Water Damage, Foundation Repair, Fire Restoration, HVAC, Plumbing).

When a homeowner contacts us during an emergency:
1. AI detects emergency keywords and switches to an empathetic, fast-response mode
2. Fires a priority pager/SMS to the on-call technician immediately
3. Guides the homeowner through immediate safety steps (e.g., water shut-off)
4. Logs the emergency job to Supabase and optionally pushes to their CRM
5. Follows up automatically with an estimate booking sequence once the emergency is resolved
"""

import os
import logging
import requests
from dotenv import load_dotenv
import google.generativeai as genai
from verticals import get_vertical

load_dotenv()
logger = logging.getLogger(__name__)

VERTICAL_CONFIG = get_vertical("trades")
EMERGENCY_KEYWORDS = VERTICAL_CONFIG["emergency_keywords"]


class TradesTriageAgent:
    """
    24/7 empathy-first emergency dispatcher for Home Services & Restoration.
    Designed to instantly calm panicked homeowners while simultaneously
    dispatching the on-call technician.
    """

    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_auth = os.environ.get("TWILIO_AUTH_TOKEN")
        self.twilio_phone = os.environ.get("TWILIO_PHONE_NUMBER")
        self.on_call_tech_phone = os.environ.get("ON_CALL_TECH_PHONE")
        self.business_name = os.environ.get("AGENCY_BUSINESS_NAME", "our team")

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

    def is_emergency(self, customer_message: str) -> bool:
        """Checks if inbound message contains emergency keywords."""
        msg_lower = customer_message.lower()
        return any(keyword in msg_lower for keyword in EMERGENCY_KEYWORDS)

    def handle_inbound_message(self, customer_phone: str, customer_message: str) -> str:
        """
        Main entry point for Twilio inbound SMS webhook.
        Routes to emergency or standard intake flow.
        Returns the AI reply text to send back to the homeowner.
        """
        logger.info(f"📱 Inbound from {customer_phone}: {customer_message[:80]}...")

        if self.is_emergency(customer_message):
            logger.info("🚨 EMERGENCY DETECTED — Activating emergency triage flow")
            return self._handle_emergency(customer_phone, customer_message)
        else:
            logger.info("📋 Standard inquiry — Routing to booking intake")
            return self._handle_standard_inquiry(customer_message)

    def _handle_emergency(self, customer_phone: str, customer_message: str) -> str:
        """
        Emergency flow:
        1. Immediately dispatches on-call tech
        2. Returns a calm, empathetic response with safety guidance
        """
        # Step 1: Page the on-call tech RIGHT NOW (non-blocking)
        self._dispatch_on_call_tech(customer_phone, customer_message)

        # Step 2: Generate empathetic AI response
        response = self._generate_emergency_response(customer_message)

        # Step 3: Log to Supabase
        self._log_emergency(customer_phone, customer_message)

        return response

    def _generate_emergency_response(self, customer_message: str) -> str:
        """Generates a calm, empathetic, and action-oriented emergency response."""
        if self.model:
            try:
                prompt = f"""
                You are the after-hours emergency dispatch AI for a professional restoration company.
                A homeowner just texted this emergency message: "{customer_message}"
                
                Write a short, calm, empathetic SMS response that:
                1. Opens with genuine empathy (e.g., "I'm so sorry to hear that...")
                2. Immediately tells them a tech is being dispatched RIGHT NOW
                3. Asks ONE practical safety question (e.g., location of water shut-off, whether they're safe from the damage)
                4. Keeps it under 3 sentences. No bullet points. This is an SMS.
                5. Do NOT sound like a robot or a script.
                """
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                logger.error(f"AI emergency response failed: {e}")

        # Bulletproof fallback
        return (
            "I'm so sorry to hear that — hang tight. I'm dispatching our on-call tech to you right now. "
            "For your safety, do you know where your main water shut-off valve is located?"
        )

    def _handle_standard_inquiry(self, customer_message: str) -> str:
        """Generates a friendly response for non-emergency inquiries."""
        if self.model:
            try:
                prompt = f"""
                You are a friendly scheduling assistant for a professional home services company.
                A homeowner texted: "{customer_message}"
                
                Write a brief SMS reply that:
                1. Warmly acknowledges their message
                2. Asks them to confirm their address or zip code to check crew availability
                3. Mentions we offer free estimates and same-day service
                4. Keep it under 2 sentences.
                """
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                logger.error(f"AI standard response failed: {e}")

        return (
            "Thanks for reaching out! We'd love to help — can you share your zip code "
            "so I can check on our nearest crew's availability for a free estimate?"
        )

    def _dispatch_on_call_tech(self, customer_phone: str, customer_message: str) -> bool:
        """
        Fires an urgent SMS to the on-call technician.
        In production, this can also trigger a PagerDuty alert or push to Jobber.
        """
        if not self.on_call_tech_phone:
            logger.warning("⚠️  ON_CALL_TECH_PHONE not set. Simulating dispatch.")
            logger.info(f"   [DISPATCH] Customer {customer_phone}: {customer_message[:100]}")
            return True

        alert_message = (
            f"🚨 EMERGENCY JOB — Customer: {customer_phone}\n"
            f"Message: {customer_message[:200]}\n"
            f"Please call them immediately and update your Jobber board."
        )

        return self._send_sms(self.on_call_tech_phone, alert_message)

    def _send_sms(self, to_phone: str, message: str) -> bool:
        """Sends an SMS via Twilio."""
        if not all([self.twilio_sid, self.twilio_auth, self.twilio_phone]):
            logger.warning(f"⚠️  Twilio not configured. Simulated SMS to {to_phone}")
            logger.info(f"   MSG: {message}")
            return True

        try:
            from twilio.rest import Client
            client = Client(self.twilio_sid, self.twilio_auth)
            msg = client.messages.create(body=message, from_=self.twilio_phone, to=to_phone)
            logger.info(f"✅ SMS sent. SID: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"❌ Twilio send failed: {e}")
            return False

    def _log_emergency(self, customer_phone: str, customer_message: str):
        """Logs the emergency to Supabase for follow-up and tracking."""
        if not self.supabase:
            return

        try:
            self.supabase.table("agency_prospects").insert({
                "name": "Emergency Lead",
                "phone": customer_phone,
                "niche": "trades",
                "status": "emergency_dispatched",
                "city": "Unknown",
                "website": "",
                "website_score": 100,  # Max priority for emergencies
                "mockup_html": f"EMERGENCY: {customer_message[:500]}"
            }).execute()
            logger.info("✅ Emergency logged to Supabase.")
        except Exception as e:
            logger.error(f"❌ Supabase emergency log failed: {e}")

    def generate_follow_up_estimate_sms(self, customer_phone: str, job_type: str) -> str:
        """
        After the emergency is resolved, auto-generates a follow-up estimate booking SMS.
        Sent 24-48 hours after the emergency call for restoration/repair upsells.
        """
        if self.model:
            try:
                prompt = f"""
                Write a short, friendly follow-up SMS to a homeowner 24 hours after an emergency {job_type} service.
                Goal: Get them to book a free comprehensive damage assessment / estimate appointment.
                - Reference the emergency call from yesterday warmly
                - Keep it under 2 sentences
                - End with a simple yes/no question to drive a reply
                """
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                logger.error(f"Follow-up SMS gen failed: {e}")

        return (
            "Hi, just checking in after yesterday's situation — I hope things are stabilizing! "
            "Would you like to schedule a free comprehensive damage assessment this week?"
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--test", type=str, help="Test a customer message (e.g., 'my basement is flooding')")
    args = parser.parse_args()

    agent = TradesTriageAgent()

    if args.test:
        print(f"\n🚨 Testing emergency triage with: '{args.test}'\n")
        is_emerg = agent.is_emergency(args.test)
        print(f"Emergency Detected: {is_emerg}")
        reply = agent.handle_inbound_message("+15125559999", args.test)
        print(f"\n📱 AI Reply:\n{reply}")
    else:
        # Default demo
        test_msg = "HELP my pipes burst and my whole kitchen is flooding"
        print(f"Demo message: '{test_msg}'")
        reply = agent.handle_inbound_message("+15125558888", test_msg)
        print(f"AI Reply:\n{reply}")
