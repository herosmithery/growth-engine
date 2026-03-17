import os
import json
import logging
import google.generativeai as genai
import requests
import base64
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Competitive Market Intelligence (sourced from 2025-2026 research) ────────
# Injected directly into AI prompts so every email uses real, specific data.
NICHE_INTEL = {
    "medspa": {
        "market_stat": "81% of the 12,000+ US medspas are single-location independents",
        "competitor_platforms": [
            "Zenoti ($300-$600/mo, built for chains not independents, AI is a $180-$1,500 add-on)",
            "Boulevard ($421-$468/mo, requires annual contract, no real AI voice or reactivation)",
            "Aesthetic Record (Capterra 3.4/5 — users are actively migrating away in 2025)",
            "PatientNow (expensive, dated UX, weak AI outreach)",
            "Vagaro ($23/mo but NOT HIPAA-compliant — a liability for medical aesthetics)",
        ],
        "avg_software_cost": "$421-$600/month plus annual contract",
        "key_gaps": [
            "No platform natively combines AI voice booking + no-show recovery + lapsed client reactivation",
            "Post-treatment follow-up automation (Botox 2-week check, laser recovery) is not native to any top platform",
            "Inventory AI — Zenoti tracks stock but has zero predictive forecasting for injectables",
            "Most lapsed reactivation is still done manually via phone calls or basic drip sequences",
            "GoHighLevel white-label agencies sell generic funnels — zero medspa clinical workflow depth",
        ],
        "roi_stats": [
            "Lapsed client reactivation campaigns generate $18K-$35K/quarter for a mid-size medspa",
            "No-show rate for medspas averages 15-20%; recovering 5 appointments/week = $2,500-$5,000/mo",
            "Botox retention: clients who receive a 2-week follow-up text rebook at 68% vs 31% without",
            "Average medspa client LTV: $3,200/year — one reactivated client covers a month of retainer",
        ],
        "pain_points": [
            "Paying $421-$600/mo for software that still requires a full-time front desk to run",
            "Alle loyalty program controversy (2025) — owners want independence from vendor lock-in",
            "Staff churn at front desk means manual follow-ups constantly slip",
            "Corporate medspa chains (Ideal Image, etc.) are taking market share with polished AI booking",
        ],
        "pitch_angle": "You're running a business that should be generating 2-3x what it does on autopilot. The corporate chains have AI doing their follow-ups, confirmations, and reactivations 24/7. I built something that gives independent medspas the same system.",
    },
    "veterinary clinic": {
        "market_stat": "~30,000 independent vet clinics in the US — 93% independently owned but corporate is taking over fast",
        "competitor_platforms": [
            "Cornerstone/IDEXX (server-based, dated UI, zero AI — most widely used but widely complained about)",
            "ezyVet ($150-$1,200/mo + $2K-$20K implementation cost, 1-3 month onboarding wait)",
            "Shepherd ($299/mo, cleanest UX but weak analytics and no AI layer at all)",
            "AVImark (10,000+ users, legacy architecture, no AI features)",
            "ImproMed/Covetrus (dated interface, support issues, no native AI voice or reactivation)",
        ],
        "avg_software_cost": "$299-$1,200/month plus implementation fees",
        "key_gaps": [
            "No practice management system has native AI voice — bolt-on only, requires separate VoIP setup",
            "Lapsed patient reactivation (pet hasn't been in 18+ months) is still done by human callers",
            "One clinic used human callers and generated $26,600 in 3 months — AI could do this automatically",
            "Preventive care compliance (vaccines, heartworm, dental) is batch email blasts, not AI-personalized",
            "Inventory prediction and auto-ordering does not exist in any indie-clinic-priced software",
        ],
        "roi_stats": [
            "A single lapsed patient reactivation campaign generates $8K-$26K per quarter for a 2-3 doctor practice",
            "After-hours missed calls = 23% of all vet calls go to voicemail — an AI voice agent captures all of them",
            "Heartworm prevention reminder compliance: AI follow-up sequences increase compliance by 40-60%",
            "Average vet client LTV: $1,400-$2,800/year per pet — one campaign recoups months of investment",
        ],
        "pain_points": [
            "'Silver tsunami' — 2,500 independent vet practices go up for sale annually as owners retire; corporate consolidators are winning because they have better systems",
            "Front desk turnover is brutal — manual follow-up tasks fall apart every time staff changes",
            "Corporate vet groups (VCA, Banfield, BluePearl) use centralized AI systems independents can't afford",
            "ezyVet's $20K implementation cost and 3-month wait kills small clinic ROI before it starts",
        ],
        "pitch_angle": "Corporate vet groups like VCA and Banfield have centralized AI handling their reminders, reactivations, and after-hours calls. Independent clinics are competing on charm alone. I built a system that levels the playing field for under what you pay for your front desk software.",
    },
}

# ─── ROI Anchor Numbers (used across all sequences) ──────────────────────────
ROI_ANCHORS = {
    "medspa": {
        "no_show_monthly": "$2,500-$5,000/mo recovered from no-show reduction",
        "reactivation_quarterly": "$18,000-$35,000/quarter from lapsed client campaigns",
        "ltv": "$3,200 average client LTV",
        "software_savings": "Replaces Zenoti ($468/mo) + SMS platform ($150/mo) + manual follow-up staff time",
    },
    "veterinary clinic": {
        "reactivation_quarterly": "$8,000-$26,600/quarter from lapsed patient reactivation",
        "missed_calls": "23% of calls go to voicemail — AI captures every one after hours",
        "ltv": "$1,400-$2,800 average client LTV per pet",
        "software_savings": "Replaces ezyVet ($800+/mo) + separate AI voice bolt-on + manual outreach staff",
    },
}

class OutreachAgent:
    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.instantly_webhook = os.environ.get("INSTANTLY_WEBHOOK_URL")
        self.resend_api_key = os.environ.get("RESEND_API_KEY")
        self.from_email = os.environ.get("SMTP_EMAIL", "hello@scalewithjak.com")
        
    def generate_email_sequence(self, business_name, niche, text_content):
        """Generates a market-intelligence-powered 3-email cold sequence."""
        logger.info(f"Generating intel-powered 3-email sequence for {business_name} ({niche})...")
        if not self.gemini_key:
            logger.error("GEMINI_API_KEY missing.")
            return None

        # Pull niche-specific competitive intel
        niche_key = "medspa" if "spa" in niche.lower() or "aesthetic" in niche.lower() or "med" in niche.lower() else "veterinary clinic"
        intel = NICHE_INTEL.get(niche_key, NICHE_INTEL["medspa"])
        roi = ROI_ANCHORS.get(niche_key, ROI_ANCHORS["medspa"])

        top_gaps = "\n".join(f"- {g}" for g in intel["key_gaps"][:3])
        top_roi = "\n".join(f"- {r}" for r in intel["roi_stats"][:3])
        competitors = ", ".join([p.split(" (")[0] for p in intel["competitor_platforms"][:3]])

        prompt = f'''
You are writing cold emails for an AI automation agency that specifically serves {niche} businesses.
The agency built a full AI operations system — not a GoHighLevel white-label — with real clinical workflow depth.

TARGET BUSINESS: {business_name} ({niche})
THEIR SITE CONTEXT: {text_content[:800]}

MARKET INTELLIGENCE TO USE (weave this in naturally — don't quote it verbatim):
Competitors they're likely using or evaluating: {competitors}
Key gaps in existing software:
{top_gaps}
Real ROI numbers you can reference:
{top_roi}
Pitch angle: {intel["pitch_angle"]}

EMAIL RULES (non-negotiable):
- No em dashes. No bullet points inside email bodies. No "I hope this finds you well."
- Sound like a real human who did their research, not a marketing email.
- Be specific. Name a competitor. Name a dollar amount. Name a real behavior.
- Email 1: 4-6 sentences. One specific observation about their situation. Attach the audit. One soft CTA.
- Email 2 (Day 3): 3-4 sentences. Add one real ROI number. "Did you get a chance to look at the audit?"
- Email 3 (Day 7): 2-3 sentences. Reference the money they're leaving on the table. Clean breakup.

Return ONLY valid JSON (no markdown, no code fences):
{{
    "email_1_subject": "...",
    "email_1_body": "...",
    "email_2_subject": "...",
    "email_2_body": "...",
    "email_3_subject": "...",
    "email_3_body": "..."
}}
'''

        try:
            response = self.model.generate_content(
                contents=f"Output ONLY valid JSON. No markdown code fences.\n\n{prompt}"
            )
            clean_json = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_json)
        except Exception as e:
            logger.error(f"Failed to generate sequence: {e}")
            return None

    def generate_email_sequence_with_audit(self, business_name, niche, text_content, audit_gaps, opportunities):
        """Generates a 3-email sequence powered by the competitive audit + market intel."""
        logger.info(f"Generating audit+intel-powered email sequence for {business_name}...")
        if not self.gemini_key:
            return self.generate_email_sequence(business_name, niche, text_content)

        # Pull niche-specific competitive intel
        niche_key = "medspa" if "spa" in niche.lower() or "aesthetic" in niche.lower() or "med" in niche.lower() else "veterinary clinic"
        intel = NICHE_INTEL.get(niche_key, NICHE_INTEL["medspa"])
        roi = ROI_ANCHORS.get(niche_key, ROI_ANCHORS["medspa"])

        gaps_text = ", ".join(audit_gaps[:3]) if audit_gaps else intel["key_gaps"][0]
        opp_text = opportunities[0].get("estimated_monthly_value", roi["reactivation_quarterly"]) if opportunities else roi["reactivation_quarterly"]
        top_roi_stat = intel["roi_stats"][0]
        competitor_names = ", ".join([p.split(" (")[0] for p in intel["competitor_platforms"][:2]])

        prompt = f'''
You are writing cold emails for an AI automation agency targeting {niche} businesses.
This is NOT a GoHighLevel reseller. This is a purpose-built system with real clinical workflow depth.

TARGET: {business_name} — a {niche}
SITE CONTEXT: {text_content[:800]}

THEIR SPECIFIC AUDIT GAPS (from analysis of their site vs top 3 competitors):
{gaps_text}

REVENUE THEY'RE LEAVING ON THE TABLE: {opp_text}

MARKET CONTEXT TO USE NATURALLY:
- Common platforms in their space: {competitor_names}
- Industry ROI benchmark: {top_roi_stat}
- Big picture: {intel["pitch_angle"]}

RULES (strict):
- No em dashes. No "I hope this email finds you." No "Certainly." No bullet points in the body.
- Be specific. Use the actual audit gap. Use the actual dollar number. Reference a real competitor.
- Email 1 (Day 0): 4-6 sentences. Lead with what you found in THEIR specific audit. Attach the report. CTA = "15 min call this week?"
- Email 2 (Day 3): 3-4 sentences. One industry ROI stat that makes the math obvious. "Worth a quick look?"
- Email 3 (Day 7): 2-3 sentences. State exactly what they're leaving behind monthly. No hard pitch, just math. Clean close.

Return ONLY valid JSON (no markdown, no code fences):
{{
    "email_1_subject": "...",
    "email_1_body": "...",
    "email_2_subject": "...",
    "email_2_body": "...",
    "email_3_subject": "...",
    "email_3_body": "..."
}}
'''

        try:
            response = self.model.generate_content(
                contents=f"Output ONLY valid JSON. No markdown code fences.\n\n{prompt}"
            )
            clean = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except Exception as e:
            logger.error(f"Audit-powered sequence failed, falling back: {e}")
            return self.generate_email_sequence(business_name, niche, text_content)

    def send_initial_outreach(self, to_email, business_name, blurred_preview_path,
                              sequence=None, audit_report_path=None):
        """Sends email via Resend (with image + audit attachment) OR pushes to Instantly.ai"""
        logger.info(f"Preparing outreach to {to_email}...")
        
        # Ensure we have a sequence to send
        if not sequence:
            logger.error("No email sequence provided to send.")
            return False

        # 1. Try Resend if configured
        if self.resend_api_key:
            return self._send_via_resend(to_email, business_name, blurred_preview_path, sequence, audit_report_path)
            
        # 2. Fallback to Instantly Webhook if configured
        if self.instantly_webhook:
            return self._send_via_instantly(to_email, business_name, blurred_preview_path, sequence)
            
        logger.warning("No RESEND_API_KEY or INSTANTLY_WEBHOOK_URL found. Outreach simulated and saved to DB.")
        return True

    def _send_via_resend(self, to_email, business_name, blurred_preview_path, sequence, audit_report_path=None):
        logger.info(f"Sending via Resend API to {to_email}...")
        try:
            attachments = []

            # Attach blurred website preview
            if blurred_preview_path and os.path.exists(blurred_preview_path):
                with open(blurred_preview_path, "rb") as img_file:
                    attachments.append({
                        "filename": "website_preview_blurred.png",
                        "content": base64.b64encode(img_file.read()).decode("utf-8")
                    })

            # Attach competitive audit HTML report
            if audit_report_path and os.path.exists(audit_report_path):
                with open(audit_report_path, "rb") as audit_file:
                    attachments.append({
                        "filename": "competitive_audit_report.html",
                        "content": base64.b64encode(audit_file.read()).decode("utf-8")
                    })
                logger.info("Competitive audit attached to email.")

            email_body = sequence.get("email_1_body", "Here is a preview of your new site!")
            html_body = f"<p>{email_body.replace(chr(10), '<br>')}</p>"
            if attachments:
                html_body += "<br><p><i>See attached: your website preview + full competitive audit report.</i></p>"

            payload = {
                "from": f"Jak <{self.from_email}>",
                "to": [to_email],
                "subject": sequence.get("email_1_subject", f"Quick question about {business_name}"),
                "html": html_body
            }

            if attachments:
                payload["attachments"] = attachments
            
            headers = {
                "Authorization": f"Bearer {self.resend_api_key}",
                "Content-Type": "application/json"
            }
            
            response = requests.post("https://api.resend.com/emails", json=payload, headers=headers)
            if response.status_code in [200, 201]:
                logger.info("✅ Resend email successfully dispatched!")
                return True
            else:
                logger.error(f"Resend Error: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Resend failed: {e}")
            return False

    def _send_via_instantly(self, to_email, business_name, blurred_preview_path, sequence):
        logger.info("Pushing lead to Instantly.ai Campaign...")
        # Instantly API allows adding leads to campaigns with custom variables
        payload = {
            "email": to_email,
            "first_name": business_name.split()[0], # Best guess
            "company_name": business_name,
            "lead_custom_fields": {
                # In production, image is pushed to S3/Firebase and public URL mapped here:
                "blurred_preview_url": f"https://s3.amazonaws.com/your-bucket/{os.path.basename(blurred_preview_path)}",
                "email_1_subject": sequence.get("email_1_subject", ""),
                "email_1_body": sequence.get("email_1_body", "").replace("\n", "<br>"),
                "email_2_body": sequence.get("email_2_body", "").replace("\n", "<br>"),
                "email_3_body": sequence.get("email_3_body", "").replace("\n", "<br>")
            }
        }
        
        try:
            r = requests.post(self.instantly_webhook, json=payload)
            if r.status_code in [200, 201]:
                logger.info("✅ Successfully pushed lead and variables to Instantly.ai")
                return True
            else:
                logger.error(f"Instantly Webhook Error: {r.text}")
        except Exception as e:
            logger.error(f"Instantly Webhook failed: {e}")
            
        return False
