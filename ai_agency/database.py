import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load main .env.local for Next.js vars
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
load_dotenv(env_path)

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Client = create_client(url, key) if url and key else None

def get_db():
    return supabase
