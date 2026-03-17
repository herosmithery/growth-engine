import os
import requests
import json
import time
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment from the Next.js app
# Note the trailing space in the directory name
load_dotenv(dotenv_path="/Users/johnkraeger/Downloads/growth engine /.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
WEBHOOK_URL = "http://localhost:3000/api/vapi/webhook"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in ../.env.local")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def mock_vapi_call(caller_name, caller_phone, summary, assistant_id=None):
    """Simulates an end-of-call report from Vapi."""
    payload = {
        "message": {
            "type": "end-of-call-report",
            "assistantId": assistant_id,
            "call": {
                "id": f"test-call-{int(time.time())}",
                "startedAt": str(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))),
                "endedAt": str(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
                "customer": {
                    "number": caller_phone,
                    "name": caller_name
                },
                "status": "ended"
            },
            "summary": summary,
            "analysis": {
                "summary": summary
            },
            "endedReason": "customer-ended-call"
        }
    }
    
    print(f"Sending mock call to {WEBHOOK_URL} for {caller_name}...")
    response = requests.post(WEBHOOK_URL, json=payload)
    if response.status_code == 200:
        print("Webhook accepted.")
        return payload["message"]["call"]["id"]
    else:
        print(f"Webhook failed: {response.status_code} - {response.text}")
        return None

def validate_sync(call_id, expected_phone, target_business_id):
    """Checks if the data correctly propagated to Supabase across admin/client views."""
    print(f"Validating sync for Call ID: {call_id}...")
    
    # Check Call Logs
    time.sleep(3) 
    call_res = supabase.table("call_logs").select("*").eq("vapi_call_id", call_id).execute()
    
    if not call_res.data:
        print("FAIL: No call log found in database.")
        return 0
    
    log = call_res.data[0]
    actual_business_id = log.get("business_id")
    print(f"SUCCESS: Call log found. Linked Business: {actual_business_id}")
    
    # Check Cross-Visibility
    if actual_business_id != target_business_id:
        print(f"FAIL: Call linked to WRONG business. Expected {target_business_id}, got {actual_business_id}")
        return 0
    
    # Check Clients
    client_res = supabase.table("clients").select("*").eq("phone", expected_phone).execute()
    if not client_res.data:
        print("FAIL: No client record found for phone.")
        return 0
    
    client = client_res.data[0]
    print(f"SUCCESS: Client '{client.get('first_name')}' found in Business {client.get('business_id')}")
    
    # Calculate score
    score = 100
    if client.get("business_id") != target_business_id:
        print("FAIL: Client record linked to wrong business.")
        score = 0
            
    print(f"visibility_sync_score: {score}")
    return score

def main():
    # Test Case: Mocking a call for a specific signed client
    # First, let's get a real business_id from the DB to test with
    biz_res = supabase.table("businesses").select("id, name").limit(1).execute()
    if not biz_res.data:
        print("Error: No businesses found in DB to test with.")
        return
        
    target_biz = biz_res.data[0]
    print(f"Testing sync for signed client: {target_biz['name']} ({target_biz['id']})")

    call_id = mock_vapi_call(
        "Jane Smith", 
        "+15559876543", 
        f"Jane Smith called {target_biz['name']} to book a consultation. Aria confirmed it.",
        assistant_id=target_biz.get('vapi_assistant_id')
    )
    
    if call_id:
        validate_sync(call_id, "+15559876543", target_biz['id'])

if __name__ == "__main__":
    main()
