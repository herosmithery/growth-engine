import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment from the Next.js app
load_dotenv(dotenv_path="/Users/johnkraeger/Downloads/growth engine /.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def audit():
    print("--- BUSINESSES SCHEMA ---")
    res = supabase.table("businesses").select("*").limit(1).execute()
    if res.data:
        print(f"Columns: {list(res.data[0].keys())}")
        for biz in res.data:
            print(f"ID: {biz['id']} | Name: {biz['name']} | Assistant ID: {biz.get('vapi_assistant_id')}")
    
    print("\n--- APPOINTMENTS SCHEMA ---")
    res = supabase.table("appointments").select("*").limit(1).execute()
    if res.data:
        print(f"Columns: {list(res.data[0].keys())}")
    else:
        print("No appointments found to inspect schema.")

if __name__ == "__main__":
    audit()
