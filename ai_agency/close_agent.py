import os
import imaplib
import email
import smtplib
from email.message import EmailMessage
import logging
import google.generativeai as genai
import stripe
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta
from database import supabase

load_dotenv()
logger = logging.getLogger(__name__)
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

class CloseAgent:
    def __init__(self):
        self.smtp_email = os.environ.get("SMTP_EMAIL")
        self.smtp_password = os.environ.get("SMTP_PASSWORD")
        self.imap_server = "imap.gmail.com"
        self.smtp_server = "smtp.gmail.com"
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
    def check_inbox_and_classify(self):
        """Connects to IMAP, reads unread emails, and uses AI to classify the prospect's intent."""
        logger.info("Close Agent monitoring inbox for replies...")
        if not self.smtp_email or not self.smtp_password:
            logger.error("Missing SMTP/IMAP credentials.")
            return

        try:
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.smtp_email, self.smtp_password)
            mail.select('inbox')
            
            _, search_data = mail.search(None, 'UNSEEN')
            
            for num in search_data[0].split():
                _, data = mail.fetch(num, '(RFC822)')
                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                sender = msg.get("From")
                body = ""
                
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            body = part.get_payload(decode=True).decode()
                            break
                else:
                    body = msg.get_payload(decode=True).decode()
                    
                self._handle_reply(sender, body)
                    
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"IMAP check failed: {e}")

    def _handle_reply(self, sender, email_body):
        """Uses Claude to determine if a reply is interested, an objection, or an unsubscribe."""
        logger.info(f"Classifying reply from {sender}...")
        if not self.gemini_key: return
        
        prompt = f'''
        You are a sales closer. Analyze this email reply from a cold email prospect.
        Email: "{email_body}"
        
        Classify the intent as exactly one of these words:
        INTERESTED (they want to see the demo or book a call)
        OBJECTION (they are asking a question like "how much?" or "do I know you?")
        UNSUBSCRIBE (they are saying no, stop emailing, or take me off list)
        READY_TO_BUY (they explicitly asked for an invoice or to start immediately)
        '''
        
        try:
            response = self.model.generate_content(
                contents=f"You must output ONLY one of the exact intent words.\n\n{prompt}"
            )
            intent = response.text.strip().upper()
            logger.info(f"Intent classified as: {intent}")
            
            if "READY_TO_BUY" in intent:
                self.send_invoice(sender, "AI Website Build & Growth Engine")
            elif "INTERESTED" in intent:
                self._send_full_demo(sender)
            elif "OBJECTION" in intent:
                self._handle_objection(sender, email_body)
            else:
                logger.info("Marking as unsubscribe/not interested.")
                
        except Exception as e:
            logger.error(f"Claude classification failed: {e}")

    def _send_full_demo(self, to_email):
        logger.info(f"Sending Full Demo link + Calendly to {to_email}")
        subject = "Here is your full interactive demo"
        body = "Hey,\n\nAwesome. Here is the link to the full interactive demo:\nhttps://demo.scalewithjak.com/your-preview\n\nIf you want to move forward, you can book a 15 min call here to go over the final handoff details: https://cal.com/scalewithjak\n\nTalk soon."
        self._dispatch_email(to_email, subject, body)

    def _handle_objection(self, to_email, objection_body):
        logger.info(f"Handling objection for {to_email}")
        # In production, pass objection_body to Claude to generate a smooth response countering it
        subject = "Re: Your question"
        body = "Hey,\n\nI completely understand. We typically charge $1,200 for the build + $500/mo for the full Growth Engine hosting (which includes an AI Receptionist). I'd love to just show you the demo first so you can decide if it's even worth your time.\n\nLet me know if you want the link."
        self._dispatch_email(to_email, subject, body)

    def send_invoice(self, to_email, product_name, amount=120000):
        """Generates a Stripe Payment Link and emails it to the client."""
        logger.info(f"Sending Stripe Invoice to {to_email}...")
        if not stripe.api_key:
            logger.error("STRIPE_SECRET_KEY missing.")
            return False
            
        try:
            product = stripe.Product.create(name=product_name)
            price = stripe.Price.create(unit_amount=amount, currency="usd", product=product.id)
            payment_link = stripe.PaymentLink.create(line_items=[{"price": price.id, "quantity": 1}])
            
            subject = f"Invoice for {product_name}"
            body = f"Hey,\n\nLet's get building. Complete payment to start onboarding:\n{payment_link.url}\n\nOur Client Success manager will drop you a line on WhatsApp immediately after.\n\nTalk soon."
            
            self._dispatch_email(to_email, subject, body)
            return True
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            return False

    def _dispatch_email(self, to_email, subject, body):
        try:
            msg = EmailMessage()
            msg['Subject'] = subject
            msg['From'] = self.smtp_email
            msg['To'] = to_email
            msg.set_content(body)
            with smtplib.SMTP_SSL(self.smtp_server, 465) as smtp:
                smtp.login(self.smtp_email, self.smtp_password)
                smtp.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"Email dispatch failed: {e}")
            return False

    def trigger_ai_call(self, lead):
        """Uses Bland.ai (or similar Vapi) to call a prospect with an AI Voice Assistant."""
        logger.info(f"📞 Triggering AI Cold Call to {lead.business} at {lead.phone}...")
        api_key = os.environ.get("BLAND_API_KEY")
        if not api_key:
            logger.error("BLAND_API_KEY missing - skipping call.")
            return False
            
        try:
            # Note: Bland.ai API example payload
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "phone_number": lead.phone,
                "task": f"You are calling the owner of {lead.business}. We sent them a free website redesign mockup 7 days ago to their email {lead.email}. Your goal is to get their feedback on the design and book a 15-minute Zoom call with Jak.",
                "voice": "maya",
                "reduce_latency": True
            }
            
            response = requests.post("https://api.bland.ai/v1/calls", json=payload, headers=headers)
            if response.status_code == 200:
                logger.info(f"✅ AI Voice Call successfully placed to {lead.business}.")
                return True
            else:
                logger.error(f"Bland.ai API Error: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to trigger AI call: {e}")
            return False

    def check_stale_leads_and_call(self):
        """Cron job: Scans the Supabase Database for leads in 'outreach' > 7 days old, and calls them."""
        logger.info("Checking database for leads unresponsive after 7 days...")
        try:
            # We will use Supabase for this in the future
            logger.info("Skipping stale lead check. Supabase migration pending for cron jobs.")
            pass
        except Exception as e:
            logger.error(f"Error checking stale leads: {e}")

if __name__ == "__main__":
    pass
