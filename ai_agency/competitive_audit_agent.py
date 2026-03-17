import os
import json
import logging
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import google.generativeai as genai
from database import get_db

load_dotenv()
logger = logging.getLogger(__name__)

# Niche-specific audit focus areas
NICHE_CONFIG = {
    "medspa": {
        "search_terms": ["med spa", "medical spa", "aesthetics", "botox", "fillers"],
        "audit_focus": [
            "Do they list Botox/filler pricing?",
            "Do they have online booking?",
            "Do they show before/after photos?",
            "Do they have a membership or loyalty program?",
            "Do they mention specific injectors or staff credentials?",
            "Do they have client reviews/testimonials visible?",
            "Do they offer a consultation funnel?",
            "Do they have active social media links?"
        ],
        "pain_points": [
            "no online booking",
            "no pricing transparency",
            "no before/after gallery",
            "no membership program",
            "no after-hours contact"
        ]
    },
    "veterinary clinic": {
        "search_terms": ["veterinarian", "animal hospital", "vet clinic", "pet care"],
        "audit_focus": [
            "Do they offer 24/7 or after-hours emergency care?",
            "Do they have online appointment booking?",
            "Do they list their services and specialties?",
            "Do they have a wellness/preventive care plan?",
            "Do they show staff bios and credentials?",
            "Do they have a client portal for records/prescriptions?",
            "Do they mention telemedicine or remote consults?",
            "Do they have visible reviews and ratings?"
        ],
        "pain_points": [
            "no after-hours emergency line",
            "no online booking",
            "no wellness plan",
            "no client portal",
            "no prescription refill system"
        ]
    }
}

# ── Market intelligence pulled from competitive research ─────────────────────
NICHE_INTEL = {
    "medspa": {
        "market_stat": "81% of the 12,000+ US medspas are single-location independents",
        "market_stat_num": "81%",
        "competitor_platforms": [
            "Zenoti ($300-$600/mo, built for chains — AI is a $180-$1,500 add-on)",
            "Boulevard ($421-$468/mo, annual contract required, no real AI voice)",
            "Aesthetic Record (Capterra 3.4/5 — users migrating away in 2025)",
            "Vagaro ($23/mo but NOT HIPAA-compliant — a medical liability)",
        ],
        "main_competitor_label": "Zenoti / Boulevard",
        "avg_software_cost": "$421-$600/month plus annual contract",
        "key_gaps": [
            "No platform natively combines AI voice + no-show recovery + lapsed client reactivation",
            "Post-treatment follow-up (Botox 2-week check, laser recovery) is not native to any top platform",
            "GoHighLevel agencies sell generic funnels — zero medspa clinical workflow depth",
        ],
        "roi_stats": [
            ("Lapsed client reactivation campaigns", "$18,000-$35,000/quarter for a mid-size medspa"),
            ("No-show recovery (5 appts/wk recovered)", "$2,500-$5,000/mo in recovered revenue"),
            ("Botox retention lift with 2-week follow-up text", "68% rebook rate vs 31% without"),
        ],
        "roi_total": "$8,000 – $35,000+/month",
        "pain_points": [
            "Paying $421-$600/mo for software that still needs full-time front desk to run",
            "Alle loyalty controversy (2025) — owners want out of vendor lock-in",
            "Corporate chains (Ideal Image) are winning with AI booking independents don't have",
        ],
    },
    "veterinary clinic": {
        "market_stat": "~30,000 independent vet clinics in the US — 93% independent but corporate is consolidating fast",
        "market_stat_num": "93%",
        "competitor_platforms": [
            "Cornerstone/IDEXX (server-based, dated UI, zero AI — most widely used but hated)",
            "ezyVet ($150-$1,200/mo + $2K-$20K impl. cost, 1-3 month onboarding wait)",
            "Shepherd ($299/mo, clean UX but no AI layer at all)",
            "AVImark (10,000+ users, legacy architecture, no AI features)",
        ],
        "main_competitor_label": "Cornerstone / ezyVet",
        "avg_software_cost": "$299-$1,200/month plus implementation fees",
        "key_gaps": [
            "No practice management system has native AI voice — bolt-on only, requires separate VoIP",
            "Lapsed patient reactivation (18+ months) is still done by human callers everywhere",
            "Inventory prediction and auto-ordering does not exist in any indie-clinic-priced software",
        ],
        "roi_stats": [
            ("Lapsed patient reactivation campaign", "$8,000-$26,600/quarter for a 2-3 doctor practice"),
            ("After-hours missed calls captured by AI voice", "23% of all vet calls go to voicemail today"),
            ("Preventive care compliance with AI follow-ups", "40-60% improvement in heartworm/vaccine compliance"),
        ],
        "roi_total": "$8,000 – $26,600+/quarter",
        "pain_points": [
            "'Silver tsunami' — 2,500 indie practices sold annually; corporate wins with better systems",
            "Front desk turnover kills manual follow-up workflows — AI never quits",
            "Corporate groups (VCA, Banfield) use centralized AI independents can't afford yet",
        ],
    },
}

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

HTML_REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Growth Audit — {business_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Inter', 'Segoe UI', sans-serif; background: #07070f; color: #e2e8f0; line-height: 1.6; }}
  .wrapper {{ max-width: 820px; margin: 0 auto; padding: 40px 24px; }}

  /* ── Header ── */
  .header {{ background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%); padding: 40px; border-radius: 16px; margin-bottom: 32px; position: relative; overflow: hidden; }}
  .header::before {{ content: ''; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%); }}
  .header-top {{ display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }}
  .brand {{ font-size: 11px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.5); text-transform: uppercase; }}
  .score-badge {{ background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 50px; padding: 6px 16px; font-size: 13px; color: white; font-weight: 600; }}
  .header h1 {{ font-size: 28px; font-weight: 800; color: white; margin-bottom: 6px; }}
  .header-meta {{ display: flex; gap: 20px; flex-wrap: wrap; }}
  .header-meta span {{ font-size: 13px; color: rgba(255,255,255,0.65); }}
  .header-meta strong {{ color: white; }}
  .report-date {{ font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 12px; }}

  /* ── Alert Bar ── */
  .alert-bar {{ background: linear-gradient(135deg, #7f1d1d, #991b1b); border: 1px solid #dc2626; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; display: flex; align-items: center; gap: 12px; }}
  .alert-bar .icon {{ font-size: 20px; flex-shrink: 0; }}
  .alert-bar p {{ font-size: 14px; color: #fca5a5; }}
  .alert-bar strong {{ color: #fef2f2; }}

  /* ── Section ── */
  .section {{ background: #0f0f1e; border: 1px solid #1e1e35; border-radius: 14px; padding: 24px; margin-bottom: 24px; }}
  .section-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }}
  .section-icon {{ width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }}
  .icon-red {{ background: rgba(220,38,38,0.15); }}
  .icon-amber {{ background: rgba(217,119,6,0.15); }}
  .icon-green {{ background: rgba(22,163,74,0.15); }}
  .icon-blue {{ background: rgba(59,130,246,0.15); }}
  .icon-purple {{ background: rgba(139,92,246,0.15); }}
  .section h2 {{ font-size: 15px; font-weight: 700; color: #e2e8f0; }}
  .section-sub {{ font-size: 12px; color: #64748b; margin-top: 2px; }}

  /* ── Gap Checklist ── */
  .gap-row {{ display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #1a1a2e; }}
  .gap-row:last-child {{ border-bottom: none; }}
  .gap-label {{ flex: 1; font-size: 14px; color: #cbd5e1; }}
  .gap-label small {{ display: block; font-size: 11px; color: #475569; margin-top: 2px; }}
  .badge {{ display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }}
  .b-miss {{ background: rgba(220,38,38,0.15); color: #f87171; border: 1px solid rgba(220,38,38,0.3); }}
  .b-win {{ background: rgba(22,163,74,0.15); color: #4ade80; border: 1px solid rgba(22,163,74,0.3); }}
  .b-warn {{ background: rgba(217,119,6,0.15); color: #fbbf24; border: 1px solid rgba(217,119,6,0.3); }}

  /* ── Competitor Cards ── */
  .comp-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }}
  .comp-card {{ background: #0a0a18; border: 1px solid #1e1e35; border-radius: 10px; padding: 16px; }}
  .comp-name {{ font-size: 14px; font-weight: 700; color: #c4b5fd; margin-bottom: 4px; }}
  .comp-meta {{ font-size: 12px; color: #64748b; margin-bottom: 10px; }}
  .comp-score-row {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }}
  .comp-score-label {{ font-size: 11px; color: #64748b; }}
  .comp-score-val {{ font-size: 13px; font-weight: 700; color: #e2e8f0; }}
  .score-bar {{ height: 6px; background: #1e1e35; border-radius: 3px; overflow: hidden; }}
  .score-fill {{ height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px; transition: width 0.3s; }}
  .score-yours {{ background: linear-gradient(90deg, #dc2626, #ef4444); }}
  .comp-gaps {{ margin-top: 10px; }}
  .comp-gap-tag {{ display: inline-block; font-size: 10px; background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); border-radius: 4px; padding: 2px 6px; margin: 2px 2px 0 0; }}
  .comp-win-tag {{ display: inline-block; font-size: 10px; background: rgba(22,163,74,0.1); color: #4ade80; border: 1px solid rgba(22,163,74,0.2); border-radius: 4px; padding: 2px 6px; margin: 2px 2px 0 0; }}

  /* ── Market Context ── */
  .market-stat {{ background: #0a0a18; border: 1px solid #1e1e35; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 14px; }}
  .market-stat-num {{ font-size: 26px; font-weight: 800; color: #818cf8; line-height: 1; flex-shrink: 0; min-width: 70px; }}
  .market-stat-text {{ font-size: 13px; color: #94a3b8; }}
  .market-stat-text strong {{ color: #e2e8f0; display: block; margin-bottom: 2px; }}

  /* ── Revenue Opportunities ── */
  .opp-card {{ background: linear-gradient(135deg, #0a1a0a, #0f2d1a); border: 1px solid rgba(22,163,74,0.25); border-radius: 10px; padding: 18px; margin-bottom: 12px; }}
  .opp-header {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }}
  .opp-title {{ font-size: 15px; font-weight: 700; color: #4ade80; }}
  .opp-value {{ font-size: 18px; font-weight: 800; color: #22c55e; white-space: nowrap; }}
  .opp-problem {{ font-size: 13px; color: #86efac; margin-bottom: 8px; }}
  .opp-fix {{ font-size: 13px; color: #6ee7b7; background: rgba(22,163,74,0.08); border-radius: 6px; padding: 8px 12px; }}
  .opp-fix::before {{ content: '→ '; font-weight: 700; }}

  /* ── ROI Calculator ── */
  .roi-table {{ width: 100%; border-collapse: collapse; }}
  .roi-table tr {{ border-bottom: 1px solid #1a1a2e; }}
  .roi-table tr:last-child {{ border-bottom: none; border-top: 2px solid #3730a3; }}
  .roi-table td {{ padding: 11px 8px; font-size: 14px; }}
  .roi-table td:first-child {{ color: #94a3b8; }}
  .roi-table td:last-child {{ text-align: right; font-weight: 600; color: #e2e8f0; }}
  .roi-total td {{ color: white !important; font-size: 16px !important; font-weight: 800 !important; }}
  .roi-total td:last-child {{ color: #4ade80 !important; }}

  /* ── What We Build ── */
  .build-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }}
  .build-card {{ background: #0a0a18; border: 1px solid #1e1e35; border-radius: 10px; padding: 14px; text-align: center; }}
  .build-card .b-icon {{ font-size: 22px; margin-bottom: 8px; }}
  .build-card .b-title {{ font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }}
  .build-card .b-desc {{ font-size: 11px; color: #64748b; }}

  /* ── Platform Comparison ── */
  .vs-table {{ width: 100%; border-collapse: collapse; }}
  .vs-table th {{ padding: 10px 12px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #64748b; text-align: left; border-bottom: 1px solid #1e1e35; }}
  .vs-table th:not(:first-child) {{ text-align: center; }}
  .vs-table td {{ padding: 10px 12px; font-size: 13px; color: #94a3b8; border-bottom: 1px solid #0f0f1e; }}
  .vs-table td:first-child {{ font-weight: 500; color: #cbd5e1; }}
  .vs-table td:not(:first-child) {{ text-align: center; }}
  .vs-table tr:last-child td {{ border-bottom: none; }}
  .vs-check {{ color: #4ade80; font-size: 16px; }}
  .vs-x {{ color: #f87171; font-size: 16px; }}
  .vs-ours {{ background: rgba(99,102,241,0.06); }}
  .vs-ours td:nth-child(3) {{ color: #818cf8 !important; font-weight: 700; }}

  /* ── CTA ── */
  .cta {{ background: linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95); border-radius: 16px; padding: 40px; text-align: center; margin-top: 32px; position: relative; overflow: hidden; }}
  .cta::before {{ content: ''; position: absolute; bottom: -80px; left: -80px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%); }}
  .cta h2 {{ font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px; }}
  .cta .cta-sub {{ font-size: 15px; color: rgba(255,255,255,0.7); margin-bottom: 6px; }}
  .offer-box {{ background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 16px 24px; display: inline-block; margin: 20px 0; text-align: left; }}
  .offer-line {{ display: flex; align-items: center; gap: 8px; font-size: 14px; color: #c4b5fd; padding: 4px 0; }}
  .offer-line::before {{ content: '✓'; color: #4ade80; font-weight: 700; }}
  .cta-btn {{ display: inline-block; background: white; color: #312e81; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 15px; margin-top: 8px; letter-spacing: -0.3px; }}
  .cta-btn:hover {{ background: #e0e7ff; }}
  .cta-note {{ font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 12px; }}

  /* ── Footer ── */
  .footer {{ text-align: center; padding: 24px 0 8px; font-size: 11px; color: #1e293b; }}
</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-top">
      <div class="brand">Scale With Jak &mdash; AI Growth Intelligence</div>
      <div class="score-badge">Digital Score: {prospect_score}/100</div>
    </div>
    <h1>AI Growth Audit: {business_name}</h1>
    <div class="header-meta">
      <span><strong>{niche_label}</strong> in {location}</span>
      <span>Analyzed vs. <strong>3 local competitors</strong></span>
      <span><strong>{gap_count} revenue gaps</strong> identified</span>
    </div>
    <p class="report-date">Report generated {report_date} &mdash; Confidential</p>
  </div>

  <!-- ALERT BAR -->
  {alert_bar_html}

  <!-- YOUR GAPS -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-red">🔍</div>
      <div>
        <h2>What You're Missing vs. Your Competitors</h2>
        <div class="section-sub">These gaps are what's letting revenue walk out the door every week</div>
      </div>
    </div>
    {gaps_html}
  </div>

  <!-- COMPETITOR BREAKDOWN -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-amber">📊</div>
      <div>
        <h2>Your Top 3 Local Competitors</h2>
        <div class="section-sub">Scored on digital presence, automation, and booking experience</div>
      </div>
    </div>
    <div class="comp-grid">
      {competitors_html}
    </div>
  </div>

  <!-- MARKET CONTEXT -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-blue">📈</div>
      <div>
        <h2>The Market Reality for {niche_label}s in 2025</h2>
        <div class="section-sub">Why the window to act is right now</div>
      </div>
    </div>
    {market_context_html}
  </div>

  <!-- REVENUE OPPORTUNITIES -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-green">💰</div>
      <div>
        <h2>Revenue You're Leaving on the Table</h2>
        <div class="section-sub">Specific opportunities with estimated monthly value</div>
      </div>
    </div>
    {opportunities_html}
  </div>

  <!-- ROI CALCULATOR -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-green">🧮</div>
      <div>
        <h2>Conservative ROI Projection for {business_name}</h2>
        <div class="section-sub">Based on industry benchmarks for similar practices</div>
      </div>
    </div>
    <table class="roi-table">
      {roi_rows_html}
    </table>
  </div>

  <!-- PLATFORM COMPARISON -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-purple">⚡</div>
      <div>
        <h2>How We Compare to What You're Probably Using</h2>
        <div class="section-sub">Why generic software leaves a $30K/year gap on the table</div>
      </div>
    </div>
    <table class="vs-table">
      <thead>
        <tr>
          <th>Capability</th>
          <th>{platform_competitor_1}</th>
          <th>Growth Engine</th>
        </tr>
      </thead>
      <tbody>
        {vs_table_rows_html}
      </tbody>
    </table>
  </div>

  <!-- WHAT WE BUILD -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon icon-purple">🛠</div>
      <div>
        <h2>What We Deploy for {business_name}</h2>
        <div class="section-sub">Full AI infrastructure — live in 7 business days</div>
      </div>
    </div>
    <div class="build-grid">
      {build_cards_html}
    </div>
  </div>

  <!-- CTA -->
  <div class="cta">
    <h2>Ready to Capture This Revenue?</h2>
    <p class="cta-sub">Your free audit is already done. Here's what comes next:</p>
    <div class="offer-box">
      <div class="offer-line">Free custom website mockup built for your brand (no templates)</div>
      <div class="offer-line">Full AI system demo on a live 15-minute strategy call</div>
      <div class="offer-line">Deployment in 7 business days or we refund your first month</div>
      <div class="offer-line">No contracts on Tier 1 &mdash; cancel anytime</div>
    </div>
    <br>
    <a href="https://cal.com/scalewithjak" class="cta-btn">Book Your Free Strategy Call</a>
    <p class="cta-note">No pitch, no pressure. 15 minutes to show you exactly what this looks like for {business_name}.</p>
  </div>

  <div class="footer">Confidential report prepared by Scale With Jak &mdash; scalewithjak.com &mdash; Not for redistribution.</div>
</div>
</body>
</html>"""


class CompetitiveAuditAgent:
    """
    Generates a hyper-personalized competitive audit report for MedSpas and Vet Clinics.
    Used as a lead magnet — attached to cold outreach to demonstrate immediate value.
    """

    def __init__(self):
        self.google_key = os.environ.get("GOOGLE_PLACES_API_KEY")
        self.firecrawl_key = os.environ.get("FIRECRAWL_API_KEY")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
        self.model = genai.GenerativeModel(
            "gemini-2.5-flash",
            generation_config={"response_mime_type": "application/json"}
        )
        self.db = get_db()

    def _scrape(self, url):
        """Scrapes a website, preferring Firecrawl, falling back to requests."""
        if self.firecrawl_key:
            try:
                from firecrawl import FirecrawlApp
                app = FirecrawlApp(api_key=self.firecrawl_key)
                result = app.scrape(url, formats=["markdown"])
                if hasattr(result, "get"):
                    return result.get("markdown", "")[:8000]
                return str(result)[:8000]
            except Exception as e:
                logger.warning(f"Firecrawl failed for {url}: {e}")

        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.extract()
            return soup.get_text(separator=" ", strip=True)[:8000]
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            return ""

    def _find_competitors(self, niche, location, exclude_name):
        """Finds top 3 local competitors via Google Places."""
        if not self.google_key:
            logger.warning("No Google Places key — skipping competitor search.")
            return []

        config = NICHE_CONFIG.get(niche.lower(), NICHE_CONFIG["veterinary clinic"])
        search_term = config["search_terms"][0]

        try:
            headers = {
                "X-Goog-Api-Key": self.google_key,
                "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.rating,places.userRatingCount"
            }
            payload = {
                "textQuery": f"{search_term} in {location}",
                "languageCode": "en",
                "pageSize": 8
            }
            res = requests.post(
                "https://places.googleapis.com/v1/places:searchText",
                json=payload, headers=headers
            )
            res.raise_for_status()
            places = res.json().get("places", [])

            competitors = []
            for p in places:
                name = p.get("displayName", {}).get("text", "")
                url = p.get("websiteUri", "")
                if not url or exclude_name.lower() in name.lower():
                    continue
                if any(x in url.lower() for x in ["yelp.", "facebook.", "google."]):
                    continue
                competitors.append({
                    "name": name,
                    "website": url,
                    "rating": p.get("rating", 0),
                    "reviews": p.get("userRatingCount", 0)
                })
                if len(competitors) >= 3:
                    break

            return competitors
        except Exception as e:
            logger.error(f"Competitor search failed: {e}")
            return []

    def _analyze_website(self, business_name, niche, website_text):
        """Uses Gemini to analyze a business website against niche-specific criteria."""
        config = NICHE_CONFIG.get(niche.lower(), NICHE_CONFIG["veterinary clinic"])
        focus = "\n".join(f"- {q}" for q in config["audit_focus"])

        prompt = f"""
        You are an expert digital marketing auditor for {niche} businesses.
        Analyze this website content for "{business_name}" and answer each question with true/false + a brief note.

        Audit Questions:
        {focus}

        Website content:
        {website_text[:5000]}

        Return JSON with this exact structure:
        {{
          "has_online_booking": bool,
          "has_pricing_info": bool,
          "has_after_hours": bool,
          "has_social_proof": bool,
          "has_loyalty_program": bool,
          "has_staff_bios": bool,
          "has_mobile_friendly": bool,
          "has_clear_cta": bool,
          "overall_score": int (0-100),
          "biggest_gaps": ["gap1", "gap2", "gap3"],
          "strengths": ["strength1", "strength2"]
        }}
        """

        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Analysis failed for {business_name}: {e}")
            return {}

    def _generate_opportunities(self, niche, prospect_analysis, competitor_analyses):
        """Uses Gemini to identify the top revenue opportunities for the prospect."""
        prompt = f"""
        You are a Growth Strategist specializing in {niche} businesses.

        Prospect's audit result: {json.dumps(prospect_analysis)}
        Competitor audits: {json.dumps(competitor_analyses)}

        Identify the top 3 specific revenue opportunities where the prospect is losing money
        compared to their competitors. Be specific with dollar estimates.

        Return JSON array of 3 objects:
        [
          {{
            "title": "short opportunity title",
            "problem": "what they're losing and why",
            "solution": "what we deploy to fix it",
            "estimated_monthly_value": "$X,XXX/mo in recovered revenue"
          }}
        ]
        """
        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Opportunity generation failed: {e}")
            return []

    def _build_html_report(self, business_name, niche, location,
                           prospect_analysis, competitors, opportunities):
        """Assembles the branded HTML audit report with all market intel injected."""
        from datetime import date

        niche_key = "medspa" if any(w in niche.lower() for w in ("med", "spa", "aesthetic")) else "veterinary clinic"
        intel = NICHE_INTEL.get(niche_key, NICHE_INTEL["medspa"])
        niche_label = "MedSpa" if niche_key == "medspa" else "Veterinary Clinic"
        report_date = date.today().strftime("%B %d, %Y")
        prospect_score = prospect_analysis.get("overall_score", 42)

        # ── Gap checklist ──────────────────────────────────────────────────────
        gap_map = {
            "has_online_booking":    ("Online booking system",              "Competitors convert 3x more walk-ins with instant booking"),
            "has_pricing_info":      ("Pricing transparency",               "60% of clients decide before calling — no pricing = lost lead"),
            "has_after_hours":       ("After-hours / 24-7 contact",         "23% of calls go unanswered after hours"),
            "has_social_proof":      ("Reviews & testimonials visible",      "4.5+ star visibility drives 35% more organic inquiries"),
            "has_loyalty_program":   ("Membership / loyalty program",        "Retention programs increase LTV by 40-60%"),
            "has_staff_bios":        ("Staff credentials & bios",            "Trust signals reduce price sensitivity"),
            "has_clear_cta":         ("Clear call-to-action on every page",  "Weak CTAs cost 20-30% of potential conversions"),
        }

        gaps_html = ""
        gap_count = 0
        for key, (label, note) in gap_map.items():
            has_it = prospect_analysis.get(key, False)
            if not has_it:
                gap_count += 1
            badge = (
                '<span class="badge b-win">&#10003; Present</span>' if has_it
                else '<span class="badge b-miss">&#10007; Missing</span>'
            )
            gaps_html += (
                f'<div class="gap-row">'
                f'<div class="gap-label">{label}<small>{note}</small></div>'
                f'{badge}</div>'
            )

        # ── Alert bar ──────────────────────────────────────────────────────────
        if gap_count >= 4:
            alert_msg = (f"<strong>{business_name} is missing {gap_count} of 7 revenue systems</strong> "
                         f"that top-ranked {niche_label}s in your market are already running.")
            alert_note = "Competitors who automate first own the market — this gap is costing you monthly."
        elif gap_count >= 2:
            alert_msg = (f"<strong>{business_name} has {gap_count} critical gaps</strong> "
                         f"actively sending clients to competitors.")
            alert_note = "Each missing system is a revenue leak closeable in under 7 days."
        else:
            alert_msg = f"<strong>{business_name} has a solid foundation</strong> but is leaving significant revenue unlocked."
            alert_note = "AI automation on your existing presence could add $8K-$35K/quarter."

        alert_bar_html = (
            f'<div class="alert-bar">'
            f'<div class="icon">&#9888;&#65039;</div>'
            f'<p>{alert_msg} {alert_note}</p>'
            f'</div>'
        )

        # ── Competitor cards ───────────────────────────────────────────────────
        competitors_html = ""
        for comp in competitors:
            score  = comp.get("analysis", {}).get("overall_score", 55)
            rating = comp.get("rating", "N/A")
            reviews = comp.get("reviews", 0)
            gap_tags = "".join(
                f'<span class="comp-gap-tag">{g}</span>'
                for g in comp.get("analysis", {}).get("biggest_gaps", [])[:3]
            )
            win_tags = "".join(
                f'<span class="comp-win-tag">{s}</span>'
                for s in comp.get("analysis", {}).get("strengths", [])[:2]
            )
            rating_str = f"&#11088; {rating} &middot; {reviews} reviews" if rating != "N/A" else ""
            competitors_html += (
                f'<div class="comp-card">'
                f'<div class="comp-name">{comp["name"]}</div>'
                f'<div class="comp-meta">{rating_str}</div>'
                f'<div class="comp-score-row">'
                f'<span class="comp-score-label">Digital Score</span>'
                f'<span class="comp-score-val">{score}/100</span>'
                f'</div>'
                f'<div class="score-bar"><div class="score-fill" style="width:{score}%"></div></div>'
                f'<div class="comp-gaps">{gap_tags}{win_tags}</div>'
                f'</div>'
            )
        # Pad to 3 cards if fewer competitors were found
        found = len(competitors)
        for _ in range(max(0, 3 - found)):
            competitors_html += (
                '<div class="comp-card">'
                '<div class="comp-name" style="color:#475569">Competitor Data</div>'
                '<div class="comp-meta" style="font-size:11px;color:#334155">Unavailable — limited API access in demo mode</div>'
                '</div>'
            )

        # ── Market context ─────────────────────────────────────────────────────
        market_context_html = (
            f'<div class="market-stat">'
            f'<div class="market-stat-num">{intel["market_stat_num"]}</div>'
            f'<div class="market-stat-text"><strong>{niche_label} Market Reality</strong>{intel["market_stat"]}</div>'
            f'</div>'
        )
        for gap in intel["key_gaps"]:
            market_context_html += (
                f'<div class="market-stat">'
                f'<div class="market-stat-num" style="font-size:20px">&#9889;</div>'
                f'<div class="market-stat-text"><strong>Industry Gap</strong>{gap}</div>'
                f'</div>'
            )

        # ── Revenue opportunities ──────────────────────────────────────────────
        opportunities_html = ""
        for opp in opportunities:
            opportunities_html += (
                f'<div class="opp-card">'
                f'<div class="opp-header">'
                f'<div class="opp-title">{opp.get("title", "")}</div>'
                f'<div class="opp-value">{opp.get("estimated_monthly_value", "")}</div>'
                f'</div>'
                f'<div class="opp-problem">{opp.get("problem", "")}</div>'
                f'<div class="opp-fix">{opp.get("solution", "")}</div>'
                f'</div>'
            )

        # ── ROI table ──────────────────────────────────────────────────────────
        roi_rows_html = ""
        for label, value in intel["roi_stats"]:
            roi_rows_html += f'<tr><td>{label}</td><td>{value}</td></tr>'
        roi_rows_html += f'<tr class="roi-total"><td>Conservative Monthly Upside</td><td>{intel["roi_total"]}</td></tr>'

        # ── Platform comparison table ──────────────────────────────────────────
        platform_competitor_1 = intel["main_competitor_label"]

        if niche_key == "medspa":
            vs_rows = [
                ("Online booking",                     "&#10003;",               "&#10003;"),
                ("AI voice — after-hours booking",     "&#10007;",               "&#10003;"),
                ("No-show recovery automation",        "&#10007;",               "&#10003;"),
                ("Lapsed client reactivation",         "Basic email drips only", "AI-personalized SMS + email"),
                ("Inventory AI forecasting",           "Manual tracking only",   "Predictive auto-alerts"),
                ("Field reports + voice notes",        "&#10007;",               "&#10003;"),
                ("Post-treatment follow-up flows",     "&#10007;",               "&#10003;"),
                ("Monthly cost",                       "$421-$600 + contract",   "Custom &mdash; no contract"),
                ("Deployment time",                    "1-3 months",             "7 business days"),
            ]
        else:
            vs_rows = [
                ("Appointment scheduling",             "&#10003;",                  "&#10003;"),
                ("AI voice — after-hours & booking",   "&#10007;",                  "&#10003;"),
                ("No-show recovery SMS",               "&#10007;",                  "&#10003;"),
                ("Lapsed patient reactivation",        "Manual phone calls",         "AI-personalized campaigns"),
                ("Inventory AI forecasting",           "&#10007;",                  "Predictive auto-alerts"),
                ("Field reports + voice notes",        "&#10007;",                  "&#10003;"),
                ("Preventive care compliance flows",   "Batch emails only",         "AI-timed sequences"),
                ("Monthly cost",                       "$299-$1,200 + impl. fees",  "Custom &mdash; no contract"),
                ("Deployment time",                    "1-3 months + training",     "7 business days"),
            ]

        vs_table_rows_html = ""
        for feature, theirs, ours in vs_rows:
            def _cell(val, is_ours=False):
                if val == "&#10003;":
                    return '<span class="vs-check">&#10003;</span>'
                if val == "&#10007;":
                    return '<span class="vs-x">&#10007;</span>'
                if is_ours:
                    return f'<strong style="color:#818cf8">{val}</strong>'
                return val

            vs_table_rows_html += (
                f'<tr>'
                f'<td>{feature}</td>'
                f'<td>{_cell(theirs)}</td>'
                f'<td>{_cell(ours, is_ours=True)}</td>'
                f'</tr>'
            )

        # ── What We Build cards ────────────────────────────────────────────────
        build_cards = [
            ("&#128222;", "AI Voice Agent",       "Books, confirms, and recovers after hours — zero staff needed"),
            ("&#128197;", "Smart Dispatch",        "Live schedule with risk scoring + bulk SMS confirmations"),
            ("&#128230;", "Inventory Brain",       "AI-forecasted stock levels tied to today's appointment load"),
            ("&#128203;", "Field Reports",         "Voice notes → structured reports + Stripe invoices in 60 seconds"),
            ("&#128227;", "Campaign Engine",       "Lapsed client reactivation that actually converts"),
            ("&#128200;", "Revenue Analytics",     "Real-time dashboard — revenue, no-shows, upsells, LTV"),
        ]
        build_cards_html = ""
        for icon, title, desc in build_cards:
            build_cards_html += (
                f'<div class="build-card">'
                f'<div class="b-icon">{icon}</div>'
                f'<div class="b-title">{title}</div>'
                f'<div class="b-desc">{desc}</div>'
                f'</div>'
            )

        return HTML_REPORT_TEMPLATE.format(
            business_name=business_name,
            niche_label=niche_label,
            location=location,
            prospect_score=prospect_score,
            gap_count=gap_count,
            report_date=report_date,
            alert_bar_html=alert_bar_html,
            gaps_html=gaps_html,
            competitors_html=competitors_html,
            market_context_html=market_context_html,
            opportunities_html=opportunities_html,
            roi_rows_html=roi_rows_html,
            platform_competitor_1=platform_competitor_1,
            vs_table_rows_html=vs_table_rows_html,
            build_cards_html=build_cards_html,
        )

    def generate_audit(self, business_name, business_url, niche, location, out_dir=None):
        """
        Full pipeline: scrape prospect + 3 competitors → analyze → generate HTML report.
        Returns path to the saved HTML report.
        """
        logger.info(f"Starting competitive audit for {business_name} ({niche}) in {location}")

        # 1. Analyze prospect
        prospect_text = self._scrape(business_url)
        prospect_analysis = self._analyze_website(business_name, niche, prospect_text)
        logger.info(f"Prospect score: {prospect_analysis.get('overall_score', 'N/A')}/100")

        # 2. Find + analyze competitors
        competitors = self._find_competitors(niche, location, business_name)
        for comp in competitors:
            comp_text = self._scrape(comp["website"])
            comp["analysis"] = self._analyze_website(comp["name"], niche, comp_text)
            logger.info(f"Competitor '{comp['name']}' score: {comp['analysis'].get('overall_score', 'N/A')}/100")

        # 3. Generate revenue opportunities
        opportunities = self._generate_opportunities(niche, prospect_analysis, competitors)

        # 4. Build HTML report
        html = self._build_html_report(
            business_name, niche, location,
            prospect_analysis, competitors, opportunities
        )

        # 5. Save HTML report + companion JSON
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        else:
            safe_name = business_name.lower().replace(" ", "_")
            out_dir = f"./leads_generated/{safe_name}"
            os.makedirs(out_dir, exist_ok=True)

        report_path = os.path.join(out_dir, "competitive_audit.html")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"Audit HTML saved: {report_path}")

        # ── Antigravity handoff JSON ───────────────────────────────────────────
        from datetime import date
        niche_key = "medspa" if any(w in niche.lower() for w in ("med", "spa", "aesthetic")) else "veterinary clinic"
        intel = NICHE_INTEL.get(niche_key, NICHE_INTEL["medspa"])
        handoff = {
            "meta": {
                "business_name": business_name,
                "niche": niche,
                "niche_label": "MedSpa" if niche_key == "medspa" else "Veterinary Clinic",
                "location": location,
                "report_date": date.today().isoformat(),
                "report_path": report_path,
            },
            "prospect": {
                "overall_score": prospect_analysis.get("overall_score"),
                "has_online_booking": prospect_analysis.get("has_online_booking"),
                "has_pricing_info": prospect_analysis.get("has_pricing_info"),
                "has_after_hours": prospect_analysis.get("has_after_hours"),
                "has_social_proof": prospect_analysis.get("has_social_proof"),
                "has_loyalty_program": prospect_analysis.get("has_loyalty_program"),
                "has_staff_bios": prospect_analysis.get("has_staff_bios"),
                "has_clear_cta": prospect_analysis.get("has_clear_cta"),
                "biggest_gaps": prospect_analysis.get("biggest_gaps", []),
                "strengths": prospect_analysis.get("strengths", []),
            },
            "competitors": [
                {
                    "name": c.get("name"),
                    "website": c.get("website"),
                    "rating": c.get("rating"),
                    "reviews": c.get("reviews"),
                    "overall_score": c.get("analysis", {}).get("overall_score"),
                    "biggest_gaps": c.get("analysis", {}).get("biggest_gaps", []),
                    "strengths": c.get("analysis", {}).get("strengths", []),
                }
                for c in competitors
            ],
            "opportunities": opportunities,
            "market_intel": {
                "market_stat": intel["market_stat"],
                "key_gaps": intel["key_gaps"],
                "roi_stats": [{"label": l, "value": v} for l, v in intel["roi_stats"]],
                "roi_total": intel["roi_total"],
                "avg_software_cost": intel["avg_software_cost"],
                "main_competitor": intel["main_competitor_label"],
            },
            "offer": {
                "free_mockup": True,
                "free_call": True,
                "call_link": "https://cal.com/scalewithjak",
                "deployment_days": 7,
                "contract_required": False,
            },
        }

        json_path = os.path.join(out_dir, "audit_handoff.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(handoff, f, indent=2)
        logger.info(f"Antigravity handoff JSON saved: {json_path}")

        # 6. Log to Supabase if available
        if self.db:
            try:
                self.db.table("audit_reports").insert({
                    "business_name": business_name,
                    "niche": niche,
                    "location": location,
                    "prospect_score": prospect_analysis.get("overall_score"),
                    "gaps": json.dumps(prospect_analysis.get("biggest_gaps", [])),
                    "report_path": report_path,
                    "json_path": json_path,
                }).execute()
            except Exception as e:
                logger.warning(f"Supabase log failed (non-critical): {e}")

        return report_path, json_path, prospect_analysis, opportunities


if __name__ == "__main__":
    agent = CompetitiveAuditAgent()
    html_path, json_path, analysis, opps = agent.generate_audit(
        business_name="Austin Urban Veterinary Center",
        business_url="https://austinurbanvet.com",
        niche="veterinary clinic",
        location="Austin TX"
    )
    print(f"HTML Report : {html_path}")
    print(f"Handoff JSON: {json_path}")
    print(f"Score       : {analysis.get('overall_score')}/100")
    print(f"Gaps        : {analysis.get('biggest_gaps')}")
    print(f"Opps        : {[o.get('title') for o in opps]}")
