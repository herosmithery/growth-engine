import os
import logging
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
from textwrap import dedent

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(message)s')

class HandleReplySwarm:
    def __init__(self, gemini_api_key=None):
        self.api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for the Reply Swarm.")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"temperature": 0.5})

    def run_agent(self, role, task, context=""):
        prompt = dedent(f"""
        {role}
        
        YOUR TASK:
        {task}
        
        CONTEXT:
        {context}
        """)
        
        response = self.model.generate_content(prompt)
        return response.text.strip()

    def run_swarm(self, business_name, original_bottleneck_report, lead_reply_text):
        logger.info(f"🚀 Launching Reply-Handling Swarm for {business_name}...")
        
        # --- AGENT 1: The UI/UX Designer
        logger.info("\n[Agent 1: Silicon Valley UI/UX Architect] starts working...")
        designer_role = dedent("""
            You are an award-winning UI/UX frontend engineer for a top AI Agency. 
            You design modern, sleek, "Silicon Valley" style React/Tailwind code.
            You use dark mode, glassmorphism, and neon accents.
        """)
        designer_task = dedent(f"""
            We previously identified this bottleneck for the client:
            {original_bottleneck_report}
            
            They have just replied to our email. 
            Write a React/Tailwind Hero section component for {business_name}.
            It MUST include a headline directly addressing their bottleneck, and an integrated "24/7 AI Booking Widget" placeholder.
            Output ONLY valid React/JSX code with Tailwind classes. NO markdown. NO explanation. just the raw code block.
        """)
        
        design_code = self.run_agent(designer_role, designer_task)
        logger.info(f"➡️ DESIGN MOCKUP GENERATED! (First 150 chars):\n{design_code[:150]}...\n")
        
        # --- AGENT 2: The Closer
        logger.info("[Agent 2: The Deal Closer] starts working...")
        closer_role = dedent("""
            You are a master deal-closer for a B2B AI Agency. 
            A lead has just replied to your initial cold email.
            Your job is to cleanly lock in the Zoom call by offering them the custom mockup we just generated.
            Keep it extremely brief and human.
        """)
        closer_task = dedent(f"""
            The lead ({business_name}) replied to our initial email with:
            "{lead_reply_text}"
            
            Draft a very short reply email that:
            1. Acknowledges their message warmly.
            2. Tells them you had your engineering team build a custom 3D AI-powered website mockup to fix their exact bottleneck.
            3. Mentions the mockup is attached.
            4. Pushes for the 15-minute Zoom call using the link: [Insert Calendar Link]
        """)
        
        reply_email = self.run_agent(closer_role, closer_task)
        logger.info(f"➡️ WARM REPLY EMAIL:\n{reply_email}\n")
        
        logger.info("✅ Reply-Handling Swarm Workflow Complete!")
        return {
            "mockup_code": design_code,
            "reply_email": reply_email
        }

if __name__ == "__main__":
    swarm = HandleReplySwarm()
    dummy_bottleneck = "Austin Smiles MedSpa's strict 9am-5pm call-only booking window is a major operational flaw. This limited availability is severely compounded by the market context, where staff are frequently diverted by Texas's complex compliance, supervision, and medical director instability, leading to unanswered calls and missed revenue opportunities."
    dummy_reply = "Hey Jak, yeah we definitely miss a lot of calls when the front desk is busy with compliance paperwork. How exactly does this AI system work?"
    
    output = swarm.run_swarm("Austin Smiles", dummy_bottleneck, dummy_reply)
