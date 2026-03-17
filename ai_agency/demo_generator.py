import os
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

class DemoGenerator:
    """
    Spins up personalized 'Agentic AI Studio' sandbox demos for prospects.
    This creates the competitive edge needed for high-ticket AIAA sales.
    """
    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            
    def generate_sandbox_config(self, business_name, niche, target_pain_point):
        """
        Generates a custom prompt / AgentOps configuration file that mimics
        how the AI would be configured for their specific business.
        """
        prompt = f"""
        Generate a JSON configuration file for an 'Agentic AI Studio' tailored to a {niche} called '{business_name}'.
        The business's biggest pain point is: {target_pain_point}.
        
        The configuration should define 3 local autonomous agents that will be deployed for them:
        1. A customer-facing booking bot (handles incoming triage).
        2. A Predictive No-Show Preventer (scans calendar 48h out and auto-texts high flight-risk appointments).
        3. A Waitlist Manager (instantly blasts SMS offers to waitlisted patients when a slot opens).
        
        Include a mock metric array showing: "Recovered Revenue Last 7 Days: $4,250", "Prevented No-Shows: 5".
        
        Return ONLY valid JSON.
        """
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(prompt)
            return response.text.replace("```json", "").replace("```", "").strip()
        except Exception as e:
            logger.error(f"Sandbox generation failed: {e}")
            return None

if __name__ == "__main__":
    generator = DemoGenerator()
    demo_json = generator.generate_sandbox_config("Reliant Plumbing", "Plumber", "Missing after-hours emergency calls")
    print(demo_json)
