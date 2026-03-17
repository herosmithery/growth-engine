"""
speed_to_lead_agent.py — Angi/HomeAdvisor Speed-to-Lead Interceptor
====================================================================
Intercepts inbound leads from Angi, HomeAdvisor, Thumbtack, and Google LSA
and fires a personalized SMS to the homeowner within 5 seconds — before
any competing contractor can pick up the phone.

The moment a lead arrives via webhook, this agent:
1. Extracts the homeowner's name, phone, and service type
2. Fires an immediate, personalized SMS via Twilio
3. Logs the lead to Supabase with source attribution
4. (Optional) Pushes the pre-formatted job to Jobber/Housecall Pro via webhook
"""

import os
import logging
import time
import requests
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
logger = logging.getLogger(__name__)


class SpeedToLeadAgent:
    """
    Sub-5-second lead response agent for the Trades vertical.
    Intercepts shared leads and wins the homeowner's attention before
    any competing contractor can.
    """

    def __init__(self):
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_auth = os.environ.get("TWILIO_AUTH_TOKEN")
        self.twilio_phone = os.environ.get("TWILIO_PHONE_NUMBER")
        self.gemini_key = os.environ.get("GEMINI_API_KEY")

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

    def handle_angi_webhook(self, lead_payload: dict) -> bool:
        """
        Main entry point — called when Angi/HomeAdvisor fires their lead webhook.
        Responds to the homeowner in under 5 seconds.
        """
        start_time = time.time()

        customer_name = lead_payload.get("name") or lead_payload.get("customer_name", "there")
        customer_phone = lead_payload.get("phone") or lead_payload.get("customer_phone")
        service_type = lead_payload.get("service_requested") or lead_payload.get("category", "your service request")
        source = lead_payload.get("source", "angi")
        business_name = os.environ.get("AGENCY_BUSINESS_NAME", "our team")

        if not customer_phone:
            logger.error("❌ Speed-to-Lead: No phone number in webhook payload. Aborting.")
            return False

        logger.info(f"⚡ Speed-to-Lead: New {source} lead from {customer_name} — {service_type}")

        # Step 1: Generate a personalized SMS
        sms_text = self._generate_sms(customer_name, service_type, business_name, source)

        # Step 2: Fire the SMS immediately
        elapsed = time.time() - start_time
        logger.info(f"⏱ SMS generating at {elapsed:.2f}s — firing now...")

        sms_sent = self.fire_sms(customer_phone, sms_text)

        total_time = time.time() - start_time
        logger.info(f"✅ SMS fired in {total_time:.2f}s to {customer_phone}")

        # Step 3: Save to Supabase
        self.save_to_supabase(lead_payload, source)

        return sms_sent

    def _generate_sms(self, customer_name: str, service_type: str, business_name: str, source: str) -> str:
        """
        Uses Gemini to generate a personalized, human-sounding SMS.
        Falls back to a proven template if AI fails.
        """
        first_name = customer_name.split()[0] if customer_name and customer_name != "there" else "there"

        # Try AI-personalized version first
        if self.model:
            try:
                prompt = f"""
                You are writing a 1-sentence SMS text message on behalf of {business_name} to a homeowner named {first_name}.
                They just submitted a request on {source} for: {service_type}.
                
                RULES:
                - Sound like a real person, NOT a bot.
                - Do NOT say "AI" or "automated".
                - Do NOT make any promises or guarantees about pricing.
                - Keep it under 160 characters.
                - End with a question to get a reply.
                - Be warm, fast, and direct.
                
                EXAMPLE OUTPUT:
                "Hi {first_name}, it's Jake from Mike's Foundation — saw your {source} request. We have a crew near you today. Can I call you back in 2 minutes?"
                
                NOW WRITE ONE ORIGINAL SMS:
                """
                response = self.model.generate_content(prompt)
                sms = response.text.strip().strip('"')
                if len(sms) < 200:
                    return sms
            except Exception as e:
                logger.warning(f"AI SMS generation failed, using template: {e}")

        # Bulletproof fallback template
        return (
            f"Hi {first_name}, saw your request for {service_type}. "
            f"We have a crew available today — mind if I call you in the next 60 seconds?"
        )

    def fire_sms(self, to_phone: str, message: str) -> bool:
        """
        Fires an SMS via Twilio. Falls back to logging if Twilio is not configured.
        """
        if not all([self.twilio_sid, self.twilio_auth, self.twilio_phone]):
            logger.warning("⚠️  Twilio not configured. SMS simulated:")
            logger.info(f"   TO: {to_phone}")
            logger.info(f"   MSG: {message}")
            return True  # Simulated success for testing

        try:
            from twilio.rest import Client
            client = Client(self.twilio_sid, self.twilio_auth)
            msg = client.messages.create(
                body=message,
                from_=self.twilio_phone,
                to=to_phone
            )
            logger.info(f"✅ Twilio SMS sent. SID: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"❌ Twilio SMS failed: {e}")
            return False

    def save_to_supabase(self, lead_payload: dict, source: str):
        """Saves the intercepted lead to the agency_prospects Supabase table."""
        if not self.supabase:
            logger.warning("⚠️  Supabase not available. Skipping lead save.")
            return

        try:
            record = {
                "name": lead_payload.get("name") or lead_payload.get("customer_name", "Unknown"),
                "email": lead_payload.get("email") or lead_payload.get("customer_email"),
                "phone": lead_payload.get("phone") or lead_payload.get("customer_phone"),
                "niche": "trades",
                "city": lead_payload.get("city") or lead_payload.get("location", "Unknown"),
                "website": lead_payload.get("website", ""),
                "status": "speed_texted",
                "website_score": 0,
                "mockup_html": f"Lead source: {source}"
            }
            self.supabase.table("agency_prospects").insert(record).execute()
            logger.info(f"✅ Lead saved to Supabase from {source}")
        except Exception as e:
            logger.error(f"❌ Supabase save failed: {e}")

    def push_to_jobber(self, lead_payload: dict, jobber_webhook_url: str) -> bool:
        """
        Pushes a pre-formatted job request to a Jobber Webhook or Make.com scenario.
        This drops the lead directly into the contractor's Unassigned Jobs board.
        """
        if not jobber_webhook_url:
            logger.warning("No Jobber webhook URL configured.")
            return False

        try:
            payload = {
                "client_name": lead_payload.get("name", "Unknown"),
                "client_phone": lead_payload.get("phone"),
                "client_email": lead_payload.get("email"),
                "service_requested": lead_payload.get("service_requested", "General Inquiry"),
                "source": "Growth Engine Speed-to-Lead",
                "status": "New Lead - AI Texted"
            }
            response = requests.post(jobber_webhook_url, json=payload, timeout=5)
            if response.status_code < 300:
                logger.info("✅ Lead pushed to Jobber successfully.")
                return True
            else:
                logger.error(f"Jobber push failed: {response.status_code} — {response.text}")
                return False
        except Exception as e:
            logger.error(f"❌ Jobber push error: {e}")
            return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Run a simulated Angi lead")
    args = parser.parse_args()

    agent = SpeedToLeadAgent()

    if args.test:
        print("\n⚡ Running Speed-to-Lead test simulation...\n")
        test_payload = {
            "name": "John Smith",
            "phone": "+15125551234",
            "email": "john.smith@example.com",
            "service_requested": "Water Damage Restoration",
            "city": "Austin, TX",
            "source": "angi"
        }
        success = agent.handle_angi_webhook(test_payload)
        print(f"\nResult: {'✅ SUCCESS' if success else '❌ FAILED'}")
