"""
Agentic AI Studios — Master Orchestrator
=========================================
Event-driven pipeline: Lead → Audit → Outreach → Demo → Close → Onboard → Retain

Replaces agency.py with a modular, niche-aware orchestration layer.
Supports both MedSpa and Veterinary Clinic niches out of the box.
"""

import os
import logging
import time
from dotenv import load_dotenv

from research_agent import ScoutAgent
from design_agent import DesignAgent
from outreach_agent import OutreachAgent
from close_agent import CloseAgent
from success_agent import SuccessAgent
from competitive_audit_agent import CompetitiveAuditAgent
from dispatch_agent import DispatchAgent
from inventory_agent import InventoryAgent
from field_report_agent import FieldReportAgent
from database import get_db

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger("orchestrator")


class AgenticAIStudios:
    """
    The central nervous system of your AI agency.
    Each method represents one stage of the client lifecycle pipeline.
    """

    def __init__(self):
        logger.info("Initializing Agentic AI Studios orchestrator...")
        self.scout = ScoutAgent()
        self.designer = DesignAgent()
        self.outreach = OutreachAgent()
        self.closer = CloseAgent()
        self.success = SuccessAgent()
        self.auditor = CompetitiveAuditAgent()
        self.dispatcher = DispatchAgent()
        self.inventory = InventoryAgent()
        self.field_reporter = FieldReportAgent()
        self.db = get_db()
        logger.info("All agents online.")

    # ─────────────────────────────────────────────
    # STAGE 1: PROSPECTING + AUDIT + OUTREACH
    # ─────────────────────────────────────────────

    def run_acquisition_pipeline(self, niche, location, num_leads=10):
        """
        Full acquisition pipeline for a niche + location.
        1. Scout businesses
        2. Score and qualify leads
        3. Generate competitive audit for HOT leads
        4. Design personalized website mockup
        5. Generate audit-powered email sequence
        6. Send outreach with audit + mockup attached
        """
        logger.info(f"Starting acquisition pipeline: {niche} in {location}")

        leads = self.scout.find_businesses(niche, location, num_results=num_leads)
        if not leads:
            logger.warning("No leads found — check API keys.")
            return []

        results = []

        for biz in leads:
            b_name = biz["name"]
            b_url = biz.get("website", "")
            safe_name = b_name.lower().replace(" ", "_")
            out_dir = f"./leads_generated/{safe_name}"

            logger.info(f"Processing lead: {b_name}")

            # Score the lead
            analysis = self.scout.evaluate_lead(biz)
            if not analysis:
                continue

            tag = analysis.get("tag")
            score = analysis.get("score")
            logger.info(f"{b_name} — Tag: {tag}, Score: {score}")

            if tag not in ["HOT", "WARM"]:
                logger.info(f"Skipping COLD lead: {b_name}")
                continue

            website_text = analysis.get("website_text", "")
            contact_email = (
                analysis.get("analysis", {}).get("owner_email")
                or f"hello@{b_url.replace('https://', '').replace('http://', '').split('/')[0]}"
            )

            # 1. Generate competitive audit
            audit_path, _audit_json_path, audit_analysis, opportunities = self.auditor.generate_audit(
                business_name=b_name,
                business_url=b_url,
                niche=niche,
                location=location,
                out_dir=out_dir
            )
            audit_gaps = audit_analysis.get("biggest_gaps", [])

            # 2. Design website mockup
            html_path = self.designer.generate_redesign(b_name, niche, website_text, out_dir)
            blurred_path = ""
            if html_path:
                blurred_path = self.designer.capture_and_blur_screenshot(html_path, out_dir) or ""

            # 3. Generate audit-powered email sequence
            sequence = self.outreach.generate_email_sequence_with_audit(
                business_name=b_name,
                niche=niche,
                text_content=website_text,
                audit_gaps=audit_gaps,
                opportunities=opportunities
            )

            # 4. Send outreach
            if sequence:
                sent = self.outreach.send_initial_outreach(
                    to_email=contact_email,
                    business_name=b_name,
                    blurred_preview_path=blurred_path,
                    sequence=sequence,
                    audit_report_path=audit_path
                )
                status = "outreach" if sent else "design_ready"
            else:
                status = "sequence_failed"

            # 5. Log to Supabase
            if self.db:
                try:
                    self.db.table("leads").upsert({
                        "business": b_name,
                        "website": b_url,
                        "email": contact_email,
                        "niche": niche,
                        "location": location,
                        "score": score,
                        "tag": tag,
                        "status": status,
                        "audit_score": audit_analysis.get("overall_score"),
                        "audit_gaps": ", ".join(audit_gaps[:3])
                    }).execute()
                except Exception as e:
                    logger.warning(f"Supabase upsert failed: {e}")

            results.append({"business": b_name, "status": status, "score": score})
            logger.info(f"Pipeline complete for {b_name} — Status: {status}")

            # Throttle to avoid rate limits
            time.sleep(2)

        logger.info(f"Acquisition pipeline done: {len(results)} leads processed.")
        return results

    # ─────────────────────────────────────────────
    # STAGE 2: CLOSE (Inbox Monitoring)
    # ─────────────────────────────────────────────

    def run_close_cycle(self):
        """
        Monitors inbox for replies and triggers appropriate close actions.
        Call this on a cron (every 2-4 hours).
        """
        logger.info("Running close cycle — checking inbox...")
        self.closer.check_inbox_and_classify()
        self.closer.check_stale_leads_and_call()

    # ─────────────────────────────────────────────
    # STAGE 3: ONBOARD (Client Activation)
    # ─────────────────────────────────────────────

    def onboard_client(self, client_name, contact_phone=None, telegram_chat_id=None):
        """
        Triggers the client onboarding sequence after a deal is closed.
        Sends WhatsApp/Telegram welcome message + collects business docs.
        """
        logger.info(f"Onboarding new client: {client_name}")

        if contact_phone:
            self.success.send_whatsapp_onboarding(contact_phone, client_name)

        if telegram_chat_id:
            import asyncio
            asyncio.run(self.success.send_telegram_onboarding(telegram_chat_id, client_name))

    # ─────────────────────────────────────────────
    # STAGE 4: OPERATE (Daily Client Services)
    # ─────────────────────────────────────────────

    def run_daily_operations(self, client_configs):
        """
        Runs daily operational agents for all active clients.
        Call this every morning via cron (e.g., 7:00 AM).

        client_configs: list of client config dicts with niche, appointments, stock, etc.
        """
        logger.info(f"Running daily operations for {len(client_configs)} clients...")

        for config in client_configs:
            b_name = config.get("business_name", "Unknown")
            logger.info(f"Daily ops: {b_name}")

            # Dispatch + SMS confirmations
            schedule = self.dispatcher.run_daily_dispatch(config)
            logger.info(f"{b_name}: {len(schedule)} appointments dispatched")

            # Inventory check + alerts
            if config.get("current_stock"):
                inv_result = self.inventory.run_inventory_check(config)
                if inv_result.get("alerts"):
                    logger.info(f"{b_name}: {len(inv_result['alerts'])} inventory alerts sent")

    # ─────────────────────────────────────────────
    # STAGE 5: RETAIN (Upsell + Follow-up)
    # ─────────────────────────────────────────────

    def run_retention_cycle(self, client_phone):
        """
        Sends upsell messages to existing clients on Tier 1 to upgrade to Tier 2.
        """
        logger.info(f"Running retention/upsell for {client_phone}")
        self.success.upsell_tier_2(client_phone)


# ─────────────────────────────────────────────
# CLI Entry Points
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    studio = AgenticAIStudios()

    if len(sys.argv) >= 3:
        command = sys.argv[1]

        if command == "prospect":
            # python orchestrator.py prospect "med spa" "Austin TX" 10
            niche = sys.argv[2]
            location = sys.argv[3] if len(sys.argv) > 3 else "Austin TX"
            num = int(sys.argv[4]) if len(sys.argv) > 4 else 10
            results = studio.run_acquisition_pipeline(niche, location, num)
            logger.info(f"Results: {results}")

        elif command == "close":
            # python orchestrator.py close
            studio.run_close_cycle()

        elif command == "onboard":
            # python orchestrator.py onboard "Business Name" "+15551234567"
            studio.onboard_client(sys.argv[2], contact_phone=sys.argv[3] if len(sys.argv) > 3 else None)

        else:
            print("Commands: prospect <niche> <location> [num] | close | onboard <name> <phone>")

    else:
        # Default: run acquisition for both target niches
        logger.info("Running default acquisition for target niches...")
        studio.run_acquisition_pipeline("med spa", "Austin TX", num_leads=5)
        studio.run_acquisition_pipeline("veterinary clinic", "Austin TX", num_leads=5)
