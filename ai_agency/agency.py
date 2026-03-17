import logging
import time
from research_agent import ScoutAgent
from design_agent import DesignAgent
from outreach_agent import OutreachAgent
from close_agent import CloseAgent
from success_agent import SuccessAgent

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AutonomousAgency:
    def __init__(self):
        self.scout_agent = ScoutAgent()
        self.design_agent = DesignAgent()
        self.outreach_agent = OutreachAgent()
        self.close_agent = CloseAgent()
        self.success_agent = SuccessAgent()

    def run_pipeline(self, industry, location, vertical="medspa"):
        logger.info(f"=== Starting Autonomous Agency Pipeline for {industry} in {location} [{vertical}] ===")
        
        # 1. Scout
        leads = self.scout_agent.find_businesses(industry, location)
        
        for biz in leads:
            b_name = biz['name']
            url = biz['website']
            safe_name = b_name.lower().replace(" ", "_")
            out_dir = f"./leads_generated/{safe_name}"
            
            logger.info(f"--- Processing {b_name} ---")
            analysis = self.scout_agent.evaluate_lead(biz)
            
            if not analysis: continue
            
            if analysis.get('tag') == 'HOT':
                logger.info(f"🔥 HOT Lead Qualified: {b_name} score is {analysis.get('score')}")
                
                # Fetch email or fallback to test email so the Resend pipeline doesn't crash on null
                contact_email = analysis.get('analysis', {}).get('owner_email')
                if not contact_email or "None" in str(contact_email):
                    contact_email = "test-lead-" + safe_name + "@example.com"
                
                # 2. RUN SWARM BASED ON VERTICAL
                scraped_text = analysis.get('website_text', f"We are {b_name} offering the best {industry} services in {location}.")
                
                try:
                    # Route to the correct swarm based on vertical
                    if vertical == "trades":
                        from trades_lead_gen_crew import TradesLeadGenSwarm
                        from run_blast import send_resend_blast
                        swarm = TradesLeadGenSwarm()
                        logger.info(f"🏗️ Routing to Trades swarm for {b_name}")
                    else:
                        from lead_gen_crew import LeadGenSwarm
                        from run_blast import send_resend_blast
                        swarm = LeadGenSwarm()
                        logger.info(f"🏥 Routing to MedSpa/Vet swarm for {b_name}")
                    
                    import os, json
                    swarm_output = swarm.run_swarm(b_name, industry, location, scraped_text)
                    
                    # 3. PARSE AND SEND VIA RESEND
                    raw_email = swarm_output['email']
                    subject = "Unlock Your Revenue"
                    body = raw_email
                    lines = raw_email.split('\n')
                    for i, line in enumerate(lines):
                        if line.startswith("SUBJECT:"):
                            subject = line.replace("SUBJECT:", "").strip()
                        elif line.startswith("BODY:"):
                            body = '\n'.join(lines[i+1:]).strip()
                            break
                    
                    send_resend_blast(contact_email, subject, body)
                    
                    # Save to Supabase
                    from database import supabase
                    try:
                        res = supabase.table('agency_prospects').select('id').eq('website', url).execute()
                        existing = res.data
                        if not existing:
                            new_lead = {
                                "name": b_name,
                                "niche": industry,
                                "city": location,
                                "website": url,
                                "website_score": analysis["score"],
                                "status": "emailed", 
                                "email": contact_email,
                                "mockup_html": "Waiting for reply..."
                            }
                            supabase.table('agency_prospects').insert(new_lead).execute()
                            logger.info(f"✅ Saved {b_name} to Supabase agency_prospects")
                        else:
                            lead_id = existing[0]['id']
                            supabase.table('agency_prospects').update({"status": "emailed", "website_score": analysis["score"]}).eq('id', lead_id).execute()
                            logger.info(f"✅ Updated {b_name} in Supabase agency_prospects")
                    except Exception as e:
                        logger.error(f"❌ Supabase DB Error: {e}")
                        
                except Exception as e:
                    logger.error(f"❌ Error in Swarm/Resend pipeline: {e}")
            else:
                logger.info(f"❌ Lead Discarded: Site looks fine or no email found.")
            
            # Sleep briefly to avoid Google PageSpeed Insights 429 Rate Limits
            time.sleep(3)
                
        logger.info("Pipeline complete. Now launching Close Agent background listener...")
        
        # In a real daemon process, this would run infinitely via cron:
        # while True:
        #     self.close_agent.check_inbox_and_classify()
        #     time.sleep(300)

if __name__ == "__main__":
    agency = AutonomousAgency()
    # Run the test:
    agency.run_pipeline("plumber", "Austin TX")
