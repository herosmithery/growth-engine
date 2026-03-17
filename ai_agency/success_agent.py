import os
import logging
from twilio.rest import Client
from telegram import Bot
import asyncio
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class SuccessAgent:
    def __init__(self):
        # Twilio WhatsApp config
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        self.twilio_sandbox_number = os.environ.get("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        
        # Telegram config
        self.telegram_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        
        if self.twilio_sid and self.twilio_token:
            self.twilio_client = Client(self.twilio_sid, self.twilio_token)
        else:
            self.twilio_client = None
            
        if self.telegram_token:
            self.telegram_bot = Bot(token=self.telegram_token)
        else:
            self.telegram_bot = None

    def send_whatsapp_onboarding(self, to_number, client_name):
        """Sends an automated WhatsApp onboarding message."""
        logger.info(f"Sending WhatsApp onboarding to {client_name}...")
        if not self.twilio_client:
            logger.error("Twilio credentials missing.")
            return False
            
        msg = f"Hey {client_name}! 🚀 Your AI Website is officially live.\n\nI'm your dedicated Client Success Agent.\n\nTo get your 24/7 AI Receptionist (Tier 1 Growth Engine) fully trained, please reply with your FAQ document or pricing list."
        
        try:
            # Twilio requires numbers in "whatsapp:+1234567890" format
            formatted_number = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
            message = self.twilio_client.messages.create(
                from_=self.twilio_sandbox_number,
                body=msg,
                to=formatted_number
            )
            logger.info(f"WhatsApp message sent! SID: {message.sid}")
            return True
        except Exception as e:
            logger.error(f"WhatsApp failed: {e}")
            return False

    async def send_telegram_onboarding(self, chat_id, client_name):
        """Sends a Telegram onboarding message."""
        logger.info(f"Sending Telegram onboarding to {client_name}...")
        if not self.telegram_bot:
            logger.error("Telegram token missing.")
            return False
            
        msg = f"Hey {client_name}! 🚀 Your AI Website is officially live.\n\nI'm your dedicated Client Success Agent.\n\nTo get your 24/7 AI Receptionist fully trained, please upload your FAQ document or pricing list here."
        
        try:
            await self.telegram_bot.send_message(chat_id=chat_id, text=msg)
            logger.info("Telegram message sent!")
            return True
        except Exception as e:
            logger.error(f"Telegram failed: {e}")
            return False
            
    def upsell_tier_2(self, to_number):
        """Sends an automated follow-up to upsell Fulltime AI Employees (Tier 2)."""
        if not self.twilio_client: return False
        msg = "Are you ready to scale further? Our Tier 2 'Fulltime AI Employees' package includes a free AI audit call, AEO/SEO optimization, and a dedicated content team. Let me know if you want to hop on a call."
        try:
            self.twilio_client.messages.create(
                from_=self.twilio_sandbox_number,
                body=msg,
                to=f"whatsapp:{to_number}"
            )
            return True
        except Exception as e:
            logger.error(f"Tier 2 Upsell failed: {e}")
            return False

if __name__ == "__main__":
    pass
