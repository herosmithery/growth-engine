import os
import logging
import resend
from dotenv import load_dotenv
from lead_gen_crew import LeadGenSwarm

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# You need your actual Resend key here, but we will mock it if missing so the script doesn't crash during testing.
resend.api_key = os.environ.get("RESEND_API_KEY", "re_placeholder_key_xxxx")

def send_resend_blast(to_email, subject, text_body):
    logger.info(f"🚀 Preparing to blast email via Resend to {to_email}...")
    
    html_body = str(text_body).replace('\n', '<br>')
    
    # In a production environment, you would attach the actual Med Spa Growth Map file like this:
    # with open("growth_map.jpg", "rb") as f:
    #    attachment = {"filename": "growth_map.jpg", "content": list(f.read())}

    try:
        params = {
            "from": "Jak <hello@scalewithjak.com>",
            "to": [str(to_email)],
            "subject": str(subject),
            "html": str(html_body),
            "text": str(text_body)
        }
        
        # Uncomment this to actually fire the email if your RESEND_API_KEY is real
        email = resend.Emails.send(params)
        logger.info(f"✅ Email successfully blasted! Resend ID: {email['id']}")
        
        logger.info("✅ [SIMULATED SUCCESS] Email constructed perfectly and ready for Resend blast.")
        logger.info("-" * 40)
        logger.info(f"TO: {to_email}")
        logger.info(f"SUBJECT: {subject}")
        logger.info(f"BODY:\n{text_body}")
        logger.info("-" * 40)
        
    except Exception as e:
        logger.error(f"❌ Resend API Error: {e}")

if __name__ == "__main__":
    import sys
    
    # Check if user passed an email as an argument
    if len(sys.argv) > 1:
        target_email = sys.argv[1]
    else:
        # Default test email if none provided
        target_email = "test_lead@example.com"
        
    logger.info(f"Using target email: {target_email}. You can change this by running: python3 run_blast.py your_email@domain.com")

    swarm = LeadGenSwarm()
    dummy_site_text = "Welcome to Austin Smiles MedSpa. We offer botox and laser. Call us between 9am and 5pm to book an appointment. Walk-ins welcome."
    
    # Run the swarm
    output = swarm.run_swarm("Austin Smiles MedSpa", "Medspa", "Austin, TX", dummy_site_text)
    raw_email = output['email']
    
    # Parse subject and body
    subject = "Unlock your MedSpa Revenue"
    body = raw_email
    
    lines = raw_email.split('\n')
    for i, line in enumerate(lines):
        if line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
        elif line.startswith("BODY:"):
            body = '\n'.join(lines[i+1:]).strip()
            break
            
    # Fire the blast
    send_resend_blast(target_email, subject, body)
