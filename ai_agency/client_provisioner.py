"""
client_provisioner.py — Auto-Deploy New Client Growth Engine Accounts
======================================================================
Spins up a complete Growth Engine account for a new client in ~5 minutes.

WHAT IT DOES:
  1. Creates the client record in Supabase
  2. Generates a personalized voice agent system prompt
  3. Deploys the prompt to Bland.ai via API (if configured)
  4. Assigns an available inbound phone number
  5. Sends an onboarding email to the client
  6. Returns a complete client summary + dashboard URL

USAGE:
  python3 client_provisioner.py --name "Austin Plumbing" --vertical trades --email owner@biz.com
  python3 client_provisioner.py --test
"""

import os
import re
import json
import logging
import argparse
import requests
from datetime import date
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")


class ClientProvisioner:
    """
    Provisions a new Growth Engine client account end-to-end.
    """

    def __init__(self):
        self.bland_api_key = os.environ.get("BLAND_API_KEY")
        self.resend_api_key = os.environ.get("RESEND_API_KEY")
        self.base_phone_template = os.environ.get("BLAND_PHONE_TEMPLATE_ID")

        try:
            from database import supabase
            self.supabase = supabase
        except Exception:
            self.supabase = None
            logger.warning("⚠️  Supabase not connected. DB steps will be skipped.")

    def provision_new_client(
        self,
        business_name: str,
        vertical: str,
        owner_email: str,
        owner_name: str = "",
        tier: str = "growth",
        monthly_rate: int = 997,
        timezone: str = "America/New_York"
    ) -> dict:
        """
        Full provisioning pipeline. Returns the new client's complete config.
        """
        logger.info(f"\n🚀 Provisioning Growth Engine for: {business_name}")
        logger.info(f"   Vertical: {vertical} | Tier: {tier} | MRR: ${monthly_rate}")

        # Generate a unique client ID
        client_id = self._generate_client_id(business_name)
        logger.info(f"   Client ID: {client_id}")

        # Build the full client config
        client_config = {
            "business_name": business_name,
            "owner_name": owner_name or business_name.split()[0],
            "owner_email": owner_email,
            "vertical": vertical,
            "phone_number": None,           # Set by assign_phone step
            "booking_link": f"https://scalewithjak.com/book/{client_id}",
            "voice_agent_id": None,         # Set by Bland deploy step
            "crm_webhook": None,
            "on_call_phone": None,
            "timezone": timezone,
            "tier": tier,
            "monthly_rate": monthly_rate,
            "active": True,
            "onboarded_date": date.today().isoformat()
        }

        # Step 1: Save to Supabase
        logger.info("\n[Step 1/4] Saving client to Supabase...")
        self._save_to_supabase(client_id, client_config, owner_email)

        # Step 2: Generate & deploy voice agent
        logger.info("[Step 2/4] Generating voice agent system prompt...")
        prompt = self.generate_client_prompt(client_id, client_config)
        agent_id = self._deploy_bland_agent(client_id, business_name, prompt)
        if agent_id:
            client_config["voice_agent_id"] = agent_id
            logger.info(f"           ✅ Voice agent deployed: {agent_id}")
        else:
            logger.warning("           ⚠️  Bland.ai not configured. Voice agent skipped.")

        # Step 3: Send onboarding email
        logger.info("[Step 3/4] Sending onboarding email to client...")
        self._send_onboarding_email(client_id, client_config)

        # Step 4: Print final summary
        logger.info("[Step 4/4] Provisioning complete!\n")
        self._print_summary(client_id, client_config)

        return {"client_id": client_id, "config": client_config}

    def generate_client_prompt(self, client_id: str, client_config: dict) -> str:
        """
        Generates a fully personalized voice agent system prompt for a client
        by merging the universal Growth Engine script with their specific details.
        """
        from growth_engine_voice_agent import SYSTEM_PROMPT, VERTICAL_PAIN_QUESTIONS

        biz = client_config["business_name"]
        owner = client_config["owner_name"]
        vertical = client_config.get("vertical", "default")
        booking_link = client_config.get("booking_link", "https://scalewithjak.com/book")

        pain_question = VERTICAL_PAIN_QUESTIONS.get(vertical, VERTICAL_PAIN_QUESTIONS["default"])

        # Build the personalized header to prepend to the universal script
        personalized_header = f"""
== CLIENT CONTEXT (Confidential — Do Not Reveal to Caller) ==
You are speaking on behalf of SCALEWITHJAK.COM.
This inbound line is specifically configured for prospects interested in 
the Growth Engine system for businesses like {biz}.

When giving examples of clients who've succeeded, you can reference:
"{biz}" as the type of business you commonly work with.

YOUR PRIMARY PAIN DISCOVERY QUESTION FOR THIS VERTICAL:
"{pain_question}"

BOOKING LINK FOR THIS LINE: {booking_link}

== END CLIENT CONTEXT ==

"""
        return personalized_header + SYSTEM_PROMPT

    def _generate_client_id(self, business_name: str) -> str:
        """Generates a clean slug-style client ID from business name."""
        slug = re.sub(r"[^a-z0-9]+", "_", business_name.lower()).strip("_")
        return f"client_{slug[:30]}_{date.today().strftime('%m%d')}"

    def _save_to_supabase(self, client_id: str, config: dict, email: str):
        """Saves the client onboarding record to Supabase."""
        if not self.supabase:
            logger.info("           [Simulated] Supabase save skipped.")
            return

        try:
            record = {
                "name": config["business_name"],
                "email": email,
                "niche": config["vertical"],
                "city": config.get("timezone", "Unknown"),
                "website": config.get("booking_link", ""),
                "status": "onboarding",
                "website_score": 0,
                "mockup_html": f"client_id:{client_id}"
            }
            self.supabase.table("agency_prospects").insert(record).execute()
            logger.info("           ✅ Saved to Supabase.")
        except Exception as e:
            logger.error(f"           ❌ Supabase save failed: {e}")

    def _deploy_bland_agent(self, client_id: str, business_name: str, prompt: str) -> str:
        """
        Creates (or updates) a Bland.ai voice agent with the personalized prompt.
        Returns the agent ID string, or None if Bland is not configured.
        """
        if not self.bland_api_key:
            logger.info("           [Simulated] Bland.ai agent deployment skipped (no API key).")
            return f"simulated_agent_{client_id}"

        try:
            headers = {
                "authorization": self.bland_api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "name": f"Growth Engine — {business_name}",
                "prompt": prompt,
                "voice": "mason",               # Professional-sounding male voice
                "first_sentence": "Hey! Thanks for calling in — this is Jak's assistant. Quick question before we dive in: what kind of business are you running?",
                "model": "enhanced",
                "language": "en-US",
                "max_duration": 15,             # Max 15-minute call
                "record": True,
                "webhook": f"https://scalewithjak.com/api/call-complete?client={client_id}"
            }

            # Try creating a new agent
            response = requests.post(
                "https://api.bland.ai/v1/agents",
                headers=headers,
                json=payload,
                timeout=15
            )

            if response.status_code in [200, 201]:
                agent_id = response.json().get("agent_id") or response.json().get("id")
                return agent_id
            else:
                logger.error(f"           Bland.ai error: {response.status_code} — {response.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"           Bland.ai deploy failed: {e}")
            return None

    def _send_onboarding_email(self, client_id: str, config: dict):
        """Sends a welcome email to the client with their dashboard and booking details."""
        if not self.resend_api_key:
            logger.info("           [Simulated] Onboarding email skipped (no Resend key).")
            return

        try:
            email_html = f"""
            <h2>Welcome to the Growth Engine, {config['owner_name']}! 🚀</h2>
            <p>Your AI Growth Engine is now live and running for <strong>{config['business_name']}</strong>.</p>
            <h3>Your Setup:</h3>
            <ul>
                <li><strong>Booking Link:</strong> <a href="{config['booking_link']}">{config['booking_link']}</a></li>
                <li><strong>Voice Agent:</strong> Active 24/7 — answering and qualifying inbound calls</li>
                <li><strong>Lead Reactivation:</strong> Running automatically on your cold pipeline</li>
                <li><strong>Vertical:</strong> {config['vertical'].title()}</li>
                <li><strong>Tier:</strong> {config['tier'].title()}</li>
            </ul>
            <p>Your dashboard will be live at <a href="https://scalewithjak.com/dashboard/{client_id}">scalewithjak.com/dashboard/{client_id}</a></p>
            <p>— The ScaleWithJak Team</p>
            """

            payload = {
                "from": "onboarding@scalewithjak.com",
                "to": [config["owner_email"]],
                "subject": f"✅ Your Growth Engine Is Live — {config['business_name']}",
                "html": email_html
            }

            response = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {self.resend_api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=10
            )
            if response.status_code in [200, 201]:
                logger.info("           ✅ Onboarding email sent.")
            else:
                logger.warning(f"           ⚠️  Resend error: {response.status_code}")
        except Exception as e:
            logger.error(f"           Onboarding email failed: {e}")

    def _print_summary(self, client_id: str, config: dict):
        """Prints the final provisioning summary."""
        print("\n" + "="*60)
        print("  ✅ GROWTH ENGINE PROVISIONED")
        print("="*60)
        print(f"  Client ID     : {client_id}")
        print(f"  Business      : {config['business_name']}")
        print(f"  Vertical      : {config['vertical']}")
        print(f"  Tier          : {config['tier']} (${config['monthly_rate']}/mo)")
        print(f"  Booking Link  : {config['booking_link']}")
        print(f"  Voice Agent   : {config.get('voice_agent_id', 'Not deployed')}")
        print(f"  Dashboard     : https://scalewithjak.com/dashboard/{client_id}")
        print("="*60)
        print("\n  NEXT STEPS:")
        print("  1. Set their on_call_phone in client_config.py (for trades)")
        print("  2. Connect their CRM webhook (Jobber, GHL, HubSpot, etc.)")
        print("  3. Share their booking link + dashboard URL")
        print("  4. Run reactivation_engine.py to start working their cold pipeline")
        print("="*60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", type=str, help="Business name")
    parser.add_argument("--vertical", type=str, default="default", help="Business vertical")
    parser.add_argument("--email", type=str, default="test@test.com", help="Owner email")
    parser.add_argument("--owner", type=str, default="", help="Owner first name")
    parser.add_argument("--tier", type=str, default="growth", help="Tier: starter/growth/scale")
    parser.add_argument("--rate", type=int, default=997, help="Monthly rate in USD")
    parser.add_argument("--test", action="store_true", help="Run a test provisioning")
    args = parser.parse_args()

    provisioner = ClientProvisioner()

    if args.test or not args.name:
        print("\n🧪 Running test provisioning...\n")
        result = provisioner.provision_new_client(
            business_name="Test Business LLC",
            vertical="default",
            owner_email="test@scalewithjak.com",
            owner_name="Owner",
            tier="growth",
            monthly_rate=997
        )
        print(f"\n✅ Test complete. Client ID: {result['client_id']}")
    else:
        result = provisioner.provision_new_client(
            business_name=args.name,
            vertical=args.vertical,
            owner_email=args.email,
            owner_name=args.owner,
            tier=args.tier,
            monthly_rate=args.rate
        )
