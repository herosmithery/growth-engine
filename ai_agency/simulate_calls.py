import os
import time
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv("../.env")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Personas to test against
PERSONAS = [
    "A highly skeptical plumber who thinks AI is a scam.",
    "A Med Spa owner who is currently driving and very busy. She wants to know the price immediately.",
    "A successful electrician who has 50 leads a day but complains about low quality. He's cocky.",
    "A cosmetic surgeon looking for high-ticket ROI. Very analytical, wants to see math.",
    "A roofing contractor who just got burned by an agency. Very defensive.",
    "A generic small business owner who doesn't understand technology at all.",
    "A business owner who says 'I need to think about it' no matter what you say.",
    "An eager but broke starter trying to get the service for cheap.",
    "A busy HVAC company dispatcher who is technically not the owner but is the gatekeeper.",
    "A friendly but overly talkative vet clinic owner who keeps changing the subject."
]

def load_prompt():
    with open("target_prompt.md", "r") as f:
        return f.read()

def try_send(chat, text):
    """Sends a message with exponential backoff for 429 ResourceExhausted errors."""
    from google.api_core.exceptions import ResourceExhausted
    import time
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return chat.send_message(text)
        except ResourceExhausted:
            print(f"  [Rate Limit] Sleeping for 15s before retry {attempt+1}/{max_retries}...")
            time.sleep(15)
        except Exception as e:
            raise e
    raise Exception("Max retries exceeded for rate limit.")

def run_simulation(persona_desc):
    """Runs a simulated conversation between the Voice Agent and the Persona."""
    agent_prompt = load_prompt()
    
    # Initialize the LLMs
    agent_model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction=agent_prompt
    )
    
    prospect_model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction=f"You are a prospect on the phone with a sales rep. You are: {persona_desc}. Keep your responses under 2 sentences. Act naturally. If the rep makes a truly compelling, risk-free point, you can agree. But default to your persona. Do NOT break character."
    )
    
    agent_chat = agent_model.start_chat()
    prospect_chat = prospect_model.start_chat()
    
    # Start the conversation
    agent_msg = try_send(agent_chat, "The prospect answered the phone. Go.")
    
    success = False
    
    # Run for up to 6 turns
    for _ in range(6):
        try:
            prospect_reply = try_send(prospect_chat, agent_msg.text)
            
            # If the prospect agreed to book, count it!
            if "sounds good" in prospect_reply.text.lower() or "let's do it" in prospect_reply.text.lower() or "book" in prospect_reply.text.lower() or "tuesday" in prospect_reply.text.lower() or "thursday" in prospect_reply.text.lower():
                if "no" not in prospect_reply.text.lower() and "don't" not in prospect_reply.text.lower():
                    success = True
                    break
                
            agent_msg = try_send(agent_chat, prospect_reply.text)
        except Exception as e:
            # Handle rate limits or errors
            break
            
    return 1 if success else 0

def main():
    print(f"Starting simulation against {len(PERSONAS)} tough personas...")
    start_time = time.time()
    
    success_count = 0
    total = len(PERSONAS)
    
    # Run sequentially to avoid 429 Rate Limits
    for persona in PERSONAS:
        time.sleep(2) # Small delay to prevent blowing past standard RPM quotas
        res = run_simulation(persona)
        results.append(res)
        
    success_count = sum(results)
    
    end_time = time.time()
    
    print("-" * 30)
    print(f"conversion_score: {success_count}/{total} ({(success_count/total)*100:.1f}%)")
    print(f"time_seconds: {end_time - start_time:.1f}")
    print("-" * 30)
    
    if success_count == 0:
        print("WARN: Score is 0. Is the prompt completely broken or missing the booking link?")

if __name__ == "__main__":
    main()
