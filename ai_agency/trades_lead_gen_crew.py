"""
trades_lead_gen_crew.py — Trades-Specific Lead Gen Swarm
=========================================================
Inherits the base LeadGenSwarm architecture but overrides the Analyst and
Copywriter prompts to be optimized for the Home Services & Trades vertical.

Key differences from medspa swarm:
- Analyst focuses on speed-to-lead gaps, not HIPAA/CRM compliance
- Copywriter pitches ServiceTitan/Jobber integration, NOT Mindbody
- Email references Angi/HomeAdvisor lead bleeding, not medical intake
- No mention of HIPAA — replaces with contractor licensing compliance
"""

import os
import logging
import subprocess
from dotenv import load_dotenv
from textwrap import dedent
import google.generativeai as genai
from verticals import get_vertical

load_dotenv()

if not os.environ.get("PERPLEXITY_API_KEY"):
    os.environ["PERPLEXITY_API_KEY"] = "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"

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")

VERTICAL_CONFIG = get_vertical("trades")


class TradesLeadGenSwarm:
    """
    Multi-agent lead generation swarm optimized for the Home Services & Trades vertical.
    Uses Perplexity for market research + Gemini for deep analysis and copywriting.
    """

    def __init__(self, gemini_api_key=None):
        self.api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required.")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash", generation_config={"temperature": 0.7})

    def run_agent(self, role: str, task: str, context: str = "") -> str:
        prompt = dedent(f"""
        {role}

        YOUR TASK:
        {task}

        CONTEXT FROM PREVIOUS AGENTS:
        {context}
        """)
        response = self.model.generate_content(prompt)
        return response.text.strip()

    def run_swarm(self, business_name: str, trade_type: str, location: str, website_text: str) -> dict:
        logger.info(f"🚀 Launching Trades Multi-Agent Swarm for {business_name}...")

        # --- PERPLEXITY PRE-RESEARCH ---
        logger.info("\n[Perplexity Sub-Routine] Gathering trades market context...")
        perplexity_intel = ""
        try:
            research_query = (
                f"What are the common operational bottlenecks, speed-to-lead failures, "
                f"or CRM gaps for {trade_type} businesses in {location}? "
                f"Specifically focus on: after-hours missed calls, Angi/HomeAdvisor lead response time, "
                f"and estimate follow-up sequences."
            )
            script_path = "/Users/johnkraeger/Downloads/skills/perplexity_research/research.py"
            result = subprocess.run(
                ["python3", script_path, research_query],
                capture_output=True, text=True, check=True
            )
            perplexity_intel = result.stdout.strip()
            logger.info("✅ Trades Perplexity context gathered.")
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Perplexity script failed: {e.stderr}")
            perplexity_intel = "Could not retrieve local trades market context."
        except Exception as e:
            logger.error(f"❌ Perplexity error: {e}")
            perplexity_intel = "Could not retrieve local trades market context."

        # --- AGENT 1: Trades Operations Analyst ---
        logger.info("\n[Agent 1: Trades Operations Analyst] starts working...")
        analyst_role = dedent("""
            You are a ruthless but precise operations analyst for an elite B2B AI Agency 
            specializing in Home Services & Restoration companies.
            
            Analyze the provided website text AND the provided localized market research 
            to identify exactly 1 major operational flaw in this trades business.
            
            Specifically look for:
            - Speed-to-lead gap: Do they have a mechanism to respond to Angi/HomeAdvisor leads 
              in under 60 seconds? If not, they are losing every shared lead.
            - After-hours phone gap: Is there an AI voice agent or dispatcher for 3 AM emergency calls?
            - Estimate follow-up: Do they have an automated sequence for leads who got a quote but didn't book?
            - Online booking: Can homeowners book an estimate without calling between 9-5?
            - Review generation: Do they have an automated post-job Google review request?
        """)
        analyst_task = dedent(f"""
            Find the #1 operational flaw in this {trade_type} business using the market context.

            == WEBSITE SCRAPE ==
            {website_text[:8000]}

            == PERPLEXITY MARKET CONTEXT ==
            {perplexity_intel}

            Return ONLY a concise 2-3 sentence report on the specific speed/revenue flaw discovered.
            Focus on phone response time, lead source gaps, or CRM tooling — NOT marketing strategy.
        """)

        research_report = self.run_agent(analyst_role, analyst_task)
        logger.info(f"➡️ TRADES RESEARCH REPORT:\n{research_report}\n")

        # --- AGENT 2: Trades Copywriter ---
        logger.info("[Agent 2: Trades Direct Response Copywriter] starts working...")

        # Build the features bullet list from vertical config
        features_text = "\n".join([f"            - {f}" for f in VERTICAL_CONFIG["email_features_bullets"]])

        copywriter_role = dedent("""
            You are the founder of an AI operations firm specializing in Home Services & Restoration.
            You write cold emails that immediately separate you from generic marketing agencies by
            speaking the exact language of blue-collar business owners: speed, jobs, trucks, and revenue.
        """)

        copywriter_task = dedent(f"""
            Write a cold email to {business_name} ({trade_type}) using EXACTLY the following structure.
            Only adapt the bottleneck sentence — keep everything else identical.

            Format strictly as:
            SUBJECT: Quick question about {business_name}
            BODY:
            Hey,
            Saw your business recently. You don't need marketing agencies dumping shared Angi leads on your 
            dispatcher while 4 competing contractors beat you to the phone call. Our data analyst flagged you 
            because [insert brief 1-sentence specific bottleneck from researcher here].

            We build invisible AI infrastructure that integrates directly with your current {VERTICAL_CONFIG["email_crm_mention"]} workflow. {VERTICAL_CONFIG["email_differentiator"]}

            Why our Growth System is different:
{features_text}

            Love to book you in for a quick 10-minute Zoom demo. Just reply and I'll send you a link.
            Check out our site and interactive demo in the meantime: scalewithjak.com
        """)

        outreach_email = self.run_agent(copywriter_role, copywriter_task, context=f"Flaw Found by Analyst: {research_report}")
        logger.info(f"➡️ TRADES OUTREACH EMAIL:\n{outreach_email}\n")

        logger.info("✅ Trades Multi-Agent Swarm Complete!")
        return {
            "research": research_report,
            "email": outreach_email,
            "vertical": "trades"
        }


if __name__ == "__main__":
    swarm = TradesLeadGenSwarm()
    dummy_site_text = (
        "Welcome to Austin Best Foundation Repair. "
        "We specialize in pier foundation repair and basement waterproofing. "
        "Call us Monday-Friday 8am-5pm for a free estimate. Licensed and insured."
    )
    output = swarm.run_swarm(
        "Austin Best Foundation Repair",
        "Foundation Repair",
        "Austin, TX",
        dummy_site_text
    )
    print("\n--- FINAL EMAIL ---")
    print(output["email"])
