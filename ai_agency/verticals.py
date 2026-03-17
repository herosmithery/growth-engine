"""
verticals.py — Cross-Vertical Configuration Registry
=====================================================
This is the single source of truth for all verticals in the Growth Engine.
To add a new vertical (e.g., Dental, Auto Repair, Chiropractic), simply add
a new key to the VERTICALS dict below. All agents will automatically adapt.
"""

VERTICALS = {
    "medspa": {
        "display_name": "Medical Spa",
        "crm_names": "Mindbody / Jane App / Boulevard",
        "compliance": "SOC 2 and HIPAA compliant",
        "emergency_keywords": [],  # No true emergencies in this vertical
        "lead_qualifier_questions": [
            "Are you looking for a supervised medical treatment protocol?",
            "Our premium plans start at $300/month. Does that align with your budget?"
        ],
        "analyst_focus": [
            "Phone service bottlenecks (no after-hours booking)",
            "CRM and appointment no-show prevention gaps",
            "Clunky UI or missing online self-service portals"
        ],
        "email_crm_mention": "Mindbody / Jane App",
        "email_differentiator": "No staff training required, fully HIPAA compliant, and we do it without holding you hostage to a 6-month contract.",
        "email_features_bullets": [
            "Zero Staff Training: Your team just receives financially qualified bookings.",
            "Full Operations Fix: Human-like AI booking, lead nurture, reactivation, and reputation management.",
            "Supply Tracking: We automate inventory tracking so you never run out of critical supplies/peptides.",
            "100% SECURE: Fully HIPAA compliant, with no 6-month hostage contracts."
        ]
    },

    "vet": {
        "display_name": "Veterinary Clinic",
        "crm_names": "Cornerstone / AVImark / ezyVet",
        "compliance": "SOC 2 and HIPAA compliant",
        "emergency_keywords": ["emergency", "not breathing", "seizure", "bleeding", "unresponsive"],
        "lead_qualifier_questions": [
            "Is this an emergency situation or a routine wellness visit?",
            "Do you have an existing relationship with a primary vet?"
        ],
        "analyst_focus": [
            "After-hours emergency call routing failures",
            "Online booking gaps for walk-in triage",
            "No automated appointment reminder/rebook system"
        ],
        "email_crm_mention": "Cornerstone / AVImark",
        "email_differentiator": "No staff training required, fully HIPAA compliant, and we do it without holding you hostage to a 6-month contract.",
        "email_features_bullets": [
            "Zero Staff Training: Your team just receives pre-triaged, qualified appointments.",
            "24/7 Emergency Routing: AI answers after-hours calls and pages your on-call vet tech.",
            "No-Show Prevention: Predictive AI texts high-risk patients before they ghost.",
            "100% SECURE: Fully HIPAA compliant, with no 6-month hostage contracts."
        ]
    },

    "trades": {
        "display_name": "Home Services & Restoration",
        "crm_names": "ServiceTitan / Jobber / Housecall Pro",
        "compliance": "Licensed contractor compliant (EPA Lead-Safe, State Contractor Licensing)",
        "emergency_keywords": [
            "flood", "flooding", "burst pipe", "water damage", "fire damage",
            "foundation crack", "sewage", "mold", "emergency", "urgent", "leak"
        ],
        "lead_qualifier_questions": [
            "Is this an emergency situation, or are you looking to schedule a free estimate?",
            "Are you a homeowner or a property manager?",
            "What is the approximate square footage of the affected area?"
        ],
        "analyst_focus": [
            "After-hours missed calls during emergency events",
            "Slow response to Angi/HomeAdvisor shared leads (>90 seconds = lost job)",
            "No automated estimate follow-up sequence for cold leads",
            "Missing Google review reactivation after job completion"
        ],
        "email_crm_mention": "ServiceTitan / Jobber / Housecall Pro",
        "email_differentiator": "We don't replace your CRM. We build the pre-CRM triage layer — intercepting leads before your competitor even opens the email.",
        "email_features_bullets": [
            "Speed-to-Lead: We text the homeowner in under 5 seconds via your Angi webhook — before your competitor does.",
            "24/7 Emergency Dispatch: AI voice agent handles the 3 AM flood call & pages your on-call tech automatically.",
            "Dead Lead Reactivation: We re-engage every old Angi lead you haven't closed yet.",
            "Zero Data Entry: Qualified jobs are dropped directly into your ServiceTitan/Jobber board — no copy-paste.",
            "Licensed Contractor Compliant: No HIPAA complexity. Built for the trades."
        ],
        "crm_integration_targets": ["jobber", "housecall_pro", "service_titan"],
        "lead_sources": ["angi", "homeadvisor", "thumbtack", "google_lsa", "direct"]
    },

    "wellness": {
        "display_name": "Wellness & TRT/Peptide Clinic",
        "crm_names": "Jane App / PatientNow / GoHighLevel",
        "compliance": "SOC 2 and HIPAA compliant",
        "emergency_keywords": [],
        "lead_qualifier_questions": [
            "Our optimization programs start at $300/month. Are you looking for a comprehensive medical supervision protocol?",
            "Have you had bloodwork done in the last 6 months?"
        ],
        "analyst_focus": [
            "Phone funnel driving unqualified 'cheap prescription' seekers",
            "No automated pre-qualification sequence for blood panel requirement",
            "Missing online intake form gating the provider calendar",
            "No database reactivation of old unconverted leads"
        ],
        "email_crm_mention": "Jane App / PatientNow",
        "email_differentiator": "No staff training required, fully HIPAA compliant, and we do it without holding you hostage to a 6-month contract.",
        "email_features_bullets": [
            "AI Bouncer: Filters out unqualified leads before they ever reach your providers.",
            "Multi-Step Intake Automation: Lab payment gates the calendar — zero tire-kickers on your NP's schedule.",
            "Database Reactivation: We re-engage your cold leads from the last 18 months.",
            "100% SECURE: Fully HIPAA compliant. Zero risk to your medical license.",
            "No 6-Month Contracts: Cancel any time after the first 30 days."
        ]
    }
}


def get_vertical(vertical_key: str) -> dict:
    """Returns the config for a given vertical key. Defaults to medspa."""
    return VERTICALS.get(vertical_key, VERTICALS["medspa"])


def list_verticals() -> list:
    """Returns all available vertical keys."""
    return list(VERTICALS.keys())
