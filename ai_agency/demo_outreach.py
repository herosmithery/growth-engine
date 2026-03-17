import sys
import json
import base64
import os

# Set dummy env vars for demonstration
os.environ["INSTANTLY_WEBHOOK_URL"] = "https://mock-instantly-webhook.com/catch"
os.environ["RESEND_API_KEY"] = "mock_resend_key"

from outreach_agent import OutreachAgent

def run_demonstration():
    print("=== 🚀 AI Campaign Injection Demonstration ===\n")
    
    # 1. Provide generated mock data from previous steps
    sequence = {
        "email_1_subject": "Quick question about Pet Specialists of Austin",
        "email_1_body": "Hey,\n\nI noticed your site is looking a bit outdated.\nI just built a modern, high-converting mockup for you in my free time.\nLet me know what you think!",
        "email_2_body": "Hey again,\n\nJust floating this to the top of your inbox. A premium website can increase visitor conversion by up to 30%.",
        "email_3_body": "Last email from me. If you ever want to upgrade your online presence, you know where to find me."
    }
    
    # 2. Show the Resend payload (What happens when we attach the blurred image)
    print("--------------------------------------------------")
    print("SCENARIO 1: Sending directly via Resend API")
    print("--------------------------------------------------")
    print("The agent takes the blurred Playwright screenshot (`blurred_preview.png`) and Base64 encodes it.")
    print("It then fires an email directly containing the image attachment.\n")
    
    # Simulate Base64 encoding snippet
    dummy_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    
    resend_payload = {
        "from": "Jak <hello@scalewithjak.com>",
        "to": ["dr.smith@petsaustin.com"],
        "subject": sequence["email_1_subject"],
        "html": f"<p>{sequence['email_1_body'].replace(chr(10), '<br>')}</p><br><p><i>I attached a blurred preview image of what I built.</i></p>",
        "attachments": [
            {
                "filename": "website_preview_blurred.png",
                "content": dummy_b64[:30] + "... (truncated base64 string)"
            }
        ]
    }
    print(json.dumps(resend_payload, indent=4))
    print("\n")
    
    
    # 3. Show the Instantly.ai payload
    print("--------------------------------------------------")
    print("SCENARIO 2: Injecting into an Instantly.ai Campaign")
    print("--------------------------------------------------")
    print("The agent uploads the image to S3, gets a public URL, and pushes the lead + variables into Instantly.")
    print("Instantly.ai then handles the 3-day drip sequence automatically using these custom fields.\n")
    
    instantly_payload = {
        "email": "dr.smith@petsaustin.com",
        "first_name": "Pet",
        "company_name": "Pet Specialists of Austin",
        "lead_custom_fields": {
            "blurred_preview_url": "https://s3.amazonaws.com/your-bucket/blurred_preview.png",
            "email_1_subject": sequence["email_1_subject"],
            "email_1_body": sequence["email_1_body"].replace("\n", "<br>"),
            "email_2_body": sequence["email_2_body"].replace("\n", "<br>"),
            "email_3_body": sequence["email_3_body"].replace("\n", "<br>")
        }
    }
    print(json.dumps(instantly_payload, indent=4))
    print("--------------------------------------------------\n")
    print("✅ Demonstration Complete. Both methods are fully wired up in 'outreach_agent.py'.")

if __name__ == "__main__":
    run_demonstration()
