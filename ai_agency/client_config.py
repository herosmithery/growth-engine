"""
client_config.py — Multi-Client Account Registry
==================================================
The single source of truth for all deployed Growth Engine client accounts.
Each client entry stores everything needed to run their entire AI system
autonomously: vertical config, voice agent ID, CRM webhook, Twilio number,
calendar link, and onboarding status.

HOW TO ADD A NEW CLIENT:
  Option 1: Use client_provisioner.py --name "Biz" --vertical trades
  Option 2: Manually add an entry below following the schema

SCHEMA:
  client_id        : Unique string ID (e.g. "client_001")
  business_name    : Full business name for AI personalization
  owner_name       : Decision maker's first name
  owner_email      : For onboarding and alerts
  vertical         : One of: "trades", "medspa", "vet", "wellness", "restaurant",
                     "law_firm", "real_estate", "fitness", "ecommerce", "default"
  phone_number     : The Twilio/Bland.ai inbound number for this client
  booking_link     : Their Cal.com or Calendly link
  voice_agent_id   : Bland.ai or Vapi agent ID (set after provisioning)
  crm_webhook      : Optional CRM push URL (Jobber, GHL, HubSpot, etc.)
  on_call_phone    : Phone to page for emergencies (trades only)
  timezone         : IANA timezone string
  tier             : "starter", "growth", or "scale"
  monthly_rate     : Client MRR for your records
  active           : Set to False to pause without deleting
  onboarded_date   : ISO date string
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# CLIENT ACCOUNTS REGISTRY
# ─────────────────────────────────────────────

CLIENT_ACCOUNTS = {

    # ── DEMO/TEST ACCOUNT ──
    "client_demo": {
        "business_name": "Growth Engine Demo",
        "owner_name": "Demo",
        "owner_email": "demo@scalewithjak.com",
        "vertical": "default",
        "phone_number": os.environ.get("DEMO_TWILIO_NUMBER", "+15005550006"),
        "booking_link": "https://cal.com/scalewithjak",
        "voice_agent_id": None,
        "crm_webhook": None,
        "on_call_phone": None,
        "timezone": "America/New_York",
        "tier": "growth",
        "monthly_rate": 0,
        "active": True,
        "onboarded_date": "2026-03-11"
    },

    # ── ADD REAL CLIENTS BELOW ──
    # "client_001": {
    #     "business_name": "Austin Best Foundation Repair",
    #     "owner_name": "Mike",
    #     "owner_email": "mike@austinfoundation.com",
    #     "vertical": "trades",
    #     "phone_number": "+15125550001",
    #     "booking_link": "https://cal.com/austinfoundation",
    #     "voice_agent_id": "bland_XXXXXXXX",
    #     "crm_webhook": "https://hooks.zapier.com/XXXXX",
    #     "on_call_phone": "+15125559999",
    #     "timezone": "America/Chicago",
    #     "tier": "growth",
    #     "monthly_rate": 997,
    #     "active": True,
    #     "onboarded_date": "2026-03-11"
    # },
}


# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────

def get_client(client_id: str) -> dict:
    """Returns the config dict for a given client. Raises if not found."""
    client = CLIENT_ACCOUNTS.get(client_id)
    if not client:
        raise ValueError(f"Client '{client_id}' not found in registry.")
    return client


def get_all_active_clients() -> list:
    """Returns a list of (client_id, config) for all active clients."""
    return [
        (cid, cfg)
        for cid, cfg in CLIENT_ACCOUNTS.items()
        if cfg.get("active", True)
    ]


def get_clients_by_vertical(vertical: str) -> list:
    """Returns all active clients in a specific vertical."""
    return [
        (cid, cfg)
        for cid, cfg in CLIENT_ACCOUNTS.items()
        if cfg.get("vertical") == vertical and cfg.get("active", True)
    ]


def get_client_by_phone(phone_number: str) -> tuple:
    """
    Looks up a client by their inbound Twilio phone number.
    Used by the webhook server to route inbound SMS/calls to the right client.
    Returns (client_id, config_dict) or (None, None) if not found.
    """
    clean_phone = phone_number.strip().replace(" ", "")
    for cid, cfg in CLIENT_ACCOUNTS.items():
        if cfg.get("phone_number") == clean_phone and cfg.get("active", True):
            return cid, cfg
    return None, None


def add_client(client_id: str, config: dict) -> bool:
    """
    Programmatically adds a client to the registry at runtime.
    Used by client_provisioner.py after provisioning is complete.
    Note: Changes are in-memory only unless you also write to a DB.
    """
    if client_id in CLIENT_ACCOUNTS:
        raise ValueError(f"Client '{client_id}' already exists.")
    CLIENT_ACCOUNTS[client_id] = config
    return True


def get_mrr_total() -> float:
    """Returns total monthly recurring revenue across all active clients."""
    return sum(
        cfg.get("monthly_rate", 0)
        for _, cfg in CLIENT_ACCOUNTS.items()
        if cfg.get("active", True)
    )


def print_client_summary():
    """Prints a CLI summary of all client accounts."""
    active = get_all_active_clients()
    print(f"\n{'='*60}")
    print(f"  GROWTH ENGINE — CLIENT ACCOUNTS ({len(active)} active)")
    print(f"  Total MRR: ${get_mrr_total():,.0f}/month")
    print(f"{'='*60}")
    for cid, cfg in active:
        status = "🟢" if cfg["active"] else "🔴"
        print(f"  {status} [{cid}] {cfg['business_name']}")
        print(f"       Vertical: {cfg['vertical']} | Tier: {cfg['tier']} | MRR: ${cfg['monthly_rate']}")
        print(f"       Phone: {cfg['phone_number']} | Booked: {cfg['booking_link']}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    print_client_summary()
