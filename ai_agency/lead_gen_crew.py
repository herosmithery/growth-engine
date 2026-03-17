import os
import logging
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
# Fallback to inject key directly if missing from .env
if not os.environ.get("PERPLEXITY_API_KEY"):
    os.environ["PERPLEXITY_API_KEY"] = "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"

import subprocess
from textwrap import dedent

logger = logging.getLogger(__name__)

# Basic logging config
logging.basicConfig(level=logging.INFO, format='%(message)s')

class LeadGenSwarm:
    def __init__(self, gemini_api_key=None):
        self.api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for the Lead Gen Swarm.")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"temperature": 0.7})

    def run_agent(self, role, task, context=""):
        prompt = dedent(f"""
        {role}
        
        YOUR TASK:
        {task}
        
        CONTEXT FROM PREVIOUS AGENTS:
        {context}
        """)
        
        response = self.model.generate_content(prompt)
        return response.text.strip()

    def run_swarm(self, business_name, industry, location, website_text):
        logger.info(f"🚀 Launching Pure-Python Multi-Agent Swarm for {business_name}...")
        
        # --- PERPLEXITY PRE-RESEARCH
        logger.info("\n[Perplexity Sub-Routine] Gathering real-world context...")
        perplexity_intel = ""
        try:
            research_query = f"What are the common operational bottlenecks, customer complaints, or CRM gaps for {industry} businesses in {location}? Specifically focus on phone answering, booking, and missed revenue."
            script_path = "/Users/johnkraeger/Downloads/skills/perplexity_research/research.py"
            # Execute the research skill script
            result = subprocess.run(
                ["python3", script_path, research_query],
                capture_output=True, text=True, check=True
            )
            perplexity_intel = result.stdout.strip()
            logger.info("✅ Perplexity context successfully gathered.")
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Perplexity script failed: {e.stderr}")
            perplexity_intel = "Could not retrieve specific local market context."
        except Exception as e:
            logger.error(f"❌ Error running Perplexity sub-routine: {e}")
            perplexity_intel = "Could not retrieve specific local market context."

        # --- AGENT 1: The Researcher
        logger.info("\n[Agent 1: Senior Investigative Analyst] starts working...")
        analyst_role = dedent("""
            You are a ruthless but precise private researcher for an elite B2B AI Agency specializing in MedSpas and Veterinarian clinics. 
            Analyze the provided website text AND the provided localized market research to identify exactly 1 major operational or marketing flaw.
            Specifically look for bottlenecks we can solve with our SaaS tools: 
            - Phone service bottlenecks (e.g., lack of AI voice receptionist, missed calls, forcing calls during business hours).
            - CRM and appointment triage gaps (e.g., lack of predictive no-show prevention, missing automated waitlists).
            - Clunky UI or missing online self-service portals.
        """)
        analyst_task = dedent(f"""
            Find the operational flaw in this {industry} website by leveraging the local market context.
            
            == WEBSITE SCRAPE ==
            {website_text[:8000]}
            
            == PERPLEXITY MARKET CONTEXT ==
            {perplexity_intel}
            
            Return ONLY a concise 2-3 sentence report on the specific flaw discovered, focusing on phone service, CRM usage, or SaaS tooling gaps.
        """)
        
        research_report = self.run_agent(analyst_role, analyst_task)
        logger.info(f"➡️ RESEARCH REPORT:\n{research_report}\n")
        
        # --- AGENT 2: The Copywriter (Designer removed)
        logger.info("[Agent 2: Direct Response Copywriter] starts working...")
        copywriter_role = dedent("""
            You are a highly direct, no-nonsense founder of an AI automation firm. You write emails that cut through the noise by throwing stones at traditional marketing agencies.
        """)
        copywriter_task = dedent(f"""
            Write a cold email to {business_name} ({industry}) using EXACTLY the following template structure. You may slightly adapt the bottleneck section, but keep the rest identical.

            Format strictly as:
            SUBJECT: Quick question about {business_name}
            BODY:
            Hey,
            Saw your clinic recently. I know you don't need marketing agencies that dump unqualified leads on your stressed-out front desk. Our data analyst flagged you because [insert brief 1-sentence specific bottleneck found by researcher here]. 
            
            You need real operational solutions. We build invisible AI infrastructure that integrates directly with your current EHR (Jane App, PatientNow, etc.). 
            
            Why our Growth System is different:
            - Zero Staff Training: Your team just receives financially qualified bookings.
            - Full Operations Fix: Human-like AI booking, lead nurture, reactivation, and reputation management.
            - Supply Tracking: We automate inventory tracking so you never run out of critical supplies/peptides.
            - 100% SECURE: Fully HIPAA compliant, with no 6-month hostage contracts.
            
            Love to book you in for a quick 10-minute Zoom demo. Just reply and I'll send you a link. 
            Check out our site and interactive demo in the meantime: scalewithjak.com
        """)
        
        outreach_email = self.run_agent(copywriter_role, copywriter_task, context=f"Flaw Found by Analyst: {research_report}")
        logger.info(f"➡️ OUTREACH EMAIL:\n{outreach_email}\n")
        
        logger.info("✅ Multi-Agent Swarm Workflow Complete!")
        return {
            "research": research_report,
            "email": outreach_email
        }

if __name__ == "__main__":
    swarm = LeadGenSwarm()
    dummy_site_text = "Welcome to Austin Smiles MedSpa. We offer botox and laser. Call us between 9am and 5pm to book an appointment. Walk-ins welcome."
    output = swarm.run_swarm("Austin Smiles MedSpa", "Medspa", "Austin, TX", dummy_site_text)
