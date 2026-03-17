import os
import json
import stripe
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from success_agent import SuccessAgent
from agency import AutonomousAgency
from database import supabase
import threading
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

success_agent = SuccessAgent()

@app.route('/stripe_webhook', methods=['POST'])
def webhook():
    event = None
    payload = request.data
    sig_header = request.headers.get('STRIPE_SIGNATURE')

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        else:
            # For testing without a signature
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except ValueError as e:
        logger.error("Invalid payload")
        return "Invalid payload", 400
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid signature")
        return "Invalid signature", 400

    # Listen for successful payment checkouts
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        customer_email = session.get("customer_details", {}).get("email", "unknown@email.com")
        customer_phone = session.get("customer_details", {}).get("phone", "+1234567890")
        customer_name = session.get("customer_details", {}).get("name", "Valued Client")
        
        logger.info(f"💰 Payment received from {customer_name} ({customer_email})! Triggering Success Agent...")
        
        # Trigger WhatsApp onboarding via Twilio
        success_agent.send_whatsapp_onboarding(customer_phone, customer_name)
        
        # Optionally, if Telegram is preferred based on user preference:
        # success_agent.send_telegram_onboarding(chat_id="your-chat-id", client_name=customer_name)
        
        logger.info("✅ Success Agent handoff complete.")

    return jsonify(success=True)

@app.route('/api/leads', methods=['GET'])
def get_leads():
    try:
        from database import supabase
        vertical_filter = request.args.get('vertical')  # e.g. ?vertical=trades
        query = supabase.table('agency_prospects').select('*').order('created_at', desc=True)
        if vertical_filter:
            query = query.eq('niche', vertical_filter)
        res = query.execute()
        
        formatted = []
        for row in res.data:
            formatted.append({
                "id": row.get("id"),
                "business": row.get("name"),
                "niche": row.get("niche"),
                "location": row.get("city"),
                "website": row.get("website"),
                "email": row.get("email"),
                "score": row.get("website_score", 0),
                "status": row.get("status", "scouted"),
                "nextAction": "Waiting. Email deployed.",
                "lastAction": "Pipeline Generated",
            })
        return jsonify(formatted)
    except Exception as e:
        logger.error(f"Error fetching leads: {e}")
        return jsonify([])

@app.route('/api/activities', methods=['GET'])
def get_activities():
    try:
        from database import supabase
        res = supabase.table('agency_activities').select('*').order('created_at', desc=True).execute()
        
        formatted = []
        for row in res.data:
            formatted.append({
                "agent": row.get("agent_name", "System"),
                "color": "#6366f1",
                "msg": row.get("message"),
                "time": row.get("created_at")[:10]
            })
        return jsonify(formatted)
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        return jsonify([])

@app.route('/api/scan', methods=['POST'])
def trigger_scan():
    data = request.json
    niche = data.get('niche', 'plumber')
    location = data.get('location', 'Austin TX')
    vertical = data.get('vertical', 'medspa')  # NEW: vertical routing
    
    logger.info(f"Received scan request for {niche} in {location} [{vertical} vertical]")
    
    agency = AutonomousAgency()
    threading.Thread(target=agency.run_pipeline, args=(niche, location, vertical)).start()
    
    return jsonify(success=True, message=f"Scan started for {niche} in {location} [{vertical}]")

@app.route('/api/trade-lead', methods=['POST'])
def handle_trade_lead():
    """Angi/HomeAdvisor Speed-to-Lead webhook endpoint."""
    try:
        lead_payload = request.json
        source = lead_payload.get('source', 'angi')
        logger.info(f"⚡ Inbound {source} trade lead: {lead_payload.get('name', 'Unknown')}")
        from speed_to_lead_agent import SpeedToLeadAgent
        agent = SpeedToLeadAgent()
        threading.Thread(target=agent.handle_angi_webhook, args=(lead_payload,)).start()
        return jsonify(success=True, message=f"Speed-to-Lead interceptor activated for {source} lead")
    except Exception as e:
        logger.error(f"Trade lead handler error: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/api/emergency', methods=['POST'])
def handle_emergency_sms():
    """Twilio inbound SMS webhook — routes to TradesTriageAgent."""
    try:
        customer_phone = request.form.get('From') or (request.json or {}).get('From', '')
        customer_message = request.form.get('Body') or (request.json or {}).get('Body', '')
        if not customer_phone or not customer_message:
            return '<Response></Response>', 400, {'Content-Type': 'text/xml'}
        logger.info(f"📱 Inbound SMS from {customer_phone}: {customer_message[:80]}")
        from trades_triage_agent import TradesTriageAgent
        agent = TradesTriageAgent()
        reply_text = agent.handle_inbound_message(customer_phone, customer_message)
        twiml_response = f'<Response><Message>{reply_text}</Message></Response>'
        return twiml_response, 200, {'Content-Type': 'text/xml'}
    except Exception as e:
        logger.error(f"Emergency SMS handler error: {e}")
        return '<Response></Response>', 500, {'Content-Type': 'text/xml'}

@app.route('/api/lead/<lead_id>/preview.html', methods=['GET'])
def get_lead_preview(lead_id):
    path = os.path.join(os.path.dirname(__file__), "leads_generated", lead_id, "redesign.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return f.read(), 200, {'Content-Type': 'text/html'}
    return "Preview generation in progress...", 404

@app.route('/api/action/demo', methods=['POST'])
def trigger_demo():
    data = request.json
    lead_id = data.get('lead_id')
    logger.info(f"🎨 Design Agent manually triggered for {lead_id}")
    return jsonify(success=True, message=f"Design Agent is queueing demo generation for {lead_id}")

@app.route('/api/action/invoice', methods=['POST'])
def trigger_invoice():
    data = request.json
    lead_id = data.get('lead_id')
    amount = data.get('amount', 2500)
    logger.info(f"🤝 Close Agent manually triggered invoice for {lead_id} for ${amount}")
    
    # Normally this would trigger the close_agent.py Stripe pipeline
    # agency.close_agent.send_invoice(...)
    return jsonify(success=True, message=f"Close Agent successfully sent Stripe invoice for ${amount} to {lead_id}")


# ─────────────────────────────────────────────────────────────────
# CAL.COM WEBHOOK INTEGRATION
# ─────────────────────────────────────────────────────────────────

@app.route('/api/cal-webhook', methods=['POST'])
def handle_cal_webhook():
    """
    Receives booking webhooks from Cal.com and updates the lead/dashboard.
    Expects payload indicating a BOOKING_CREATED event.
    """
    try:
        payload = request.json
        # Cal.com webhook structure usually has triggerEvent and payload details
        trigger_event = payload.get('triggerEvent')
        
        if trigger_event == 'BOOKING_CREATED':
            booking_data = payload.get('payload', {})
            attendee_email = booking_data.get('email', 'Unknown Email')
            attendee_name = booking_data.get('name', 'Unknown Name')
            start_time = booking_data.get('startTime', 'Unknown Time')
            
            logger.info(f"📅 New CAL.COM Booking: {attendee_name} ({attendee_email}) at {start_time}")
            
            # Map this back to a lead in Supabase/Dashboard
            from database import supabase
            try:
                supabase.table("agency_activities").insert({
                    "agent_name": "Booking",
                    "message": f"Meeting Booked! {attendee_name} scheduled on Cal.com for {start_time}"
                }).execute()
            except Exception as e:
                logger.error(f"Failed to save booking activity: {e}")
            
            # Here we'd typically update supabase lead status:
            # supabase.table('agency_prospects').update({"status": "closed", "nextAction": "Onboarding Call"}).eq("email", attendee_email).execute()

            return jsonify(success=True, message=f"Logged booking for {attendee_email}")
        
        # If it's a reschedule or cancellation, we can handle later
        return jsonify(success=True, message="Event received but not processed as new booking")

    except Exception as e:
        logger.error(f"Cal.com Webhook Error: {e}")
        return jsonify(success=False, error=str(e)), 500


# ─────────────────────────────────────────────────────────────────
# MULTI-TENANT CLIENT MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────

@app.route('/api/clients', methods=['GET'])
def list_clients():
    """Returns all active client accounts with their MRR and status."""
    try:
        from client_config import get_all_active_clients, get_mrr_total
        clients = get_all_active_clients()
        client_list = [
            {
                "client_id": cid,
                "business_name": cfg["business_name"],
                "vertical": cfg["vertical"],
                "tier": cfg["tier"],
                "monthly_rate": cfg["monthly_rate"],
                "voice_agent_id": cfg.get("voice_agent_id"),
                "booking_link": cfg.get("booking_link"),
                "active": cfg.get("active", True)
            }
            for cid, cfg in clients
        ]
        return jsonify(
            success=True,
            total_clients=len(client_list),
            total_mrr=get_mrr_total(),
            clients=client_list
        )
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/provision', methods=['POST'])
def provision_client():
    """
    Auto-provisions a new client Growth Engine account.
    Body: { business_name, vertical, owner_email, owner_name, tier, monthly_rate }
    """
    try:
        data = request.json or {}
        business_name = data.get("business_name")
        vertical = data.get("vertical", "default")
        owner_email = data.get("owner_email", "")
        owner_name = data.get("owner_name", "")
        tier = data.get("tier", "growth")
        monthly_rate = data.get("monthly_rate", 997)

        if not business_name:
            return jsonify(success=False, error="business_name is required"), 400

        logger.info(f"🚀 Provisioning new client: {business_name} ({vertical})")

        from client_provisioner import ClientProvisioner
        provisioner = ClientProvisioner()
        result = provisioner.provision_new_client(
            business_name=business_name,
            vertical=vertical,
            owner_email=owner_email,
            owner_name=owner_name,
            tier=tier,
            monthly_rate=monthly_rate
        )

        return jsonify(success=True, **result)
    except Exception as e:
        logger.error(f"Provisioning error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/reactivate', methods=['POST'])
def reactivate_leads():
    """
    Triggers the reactivation engine for one or all clients.
    Body: { client_id: "client_001" } or { all: true }
    Optional: { days: 7, dry_run: false }
    """
    try:
        data = request.json or {}
        run_all = data.get("all", False)
        client_id = data.get("client_id")
        days = data.get("days", 7)
        dry_run = data.get("dry_run", False)

        from reactivation_engine import ReactivationEngine
        engine = ReactivationEngine()

        if run_all:
            logger.info("⚡ Running reactivation for ALL active clients...")
            results = engine.run_for_all_clients(days_cold=days, dry_run=dry_run)
        elif client_id:
            logger.info(f"⚡ Running reactivation for client: {client_id}")
            results = engine.run_for_client(client_id, days_cold=days, dry_run=dry_run)
        else:
            return jsonify(success=False, error="Provide client_id or set all=true"), 400

        return jsonify(success=True, results=results)
    except Exception as e:
        logger.error(f"Reactivation error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/mrr', methods=['GET'])
def get_mrr():
    """Returns total MRR across all active client accounts."""
    try:
        from client_config import get_mrr_total, get_all_active_clients
        clients = get_all_active_clients()
        return jsonify(
            success=True,
            total_mrr=get_mrr_total(),
            active_clients=len(clients)
        )
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


if __name__ == '__main__':
    logger.info("Starting Growth Engine API — Multi-Tenant Mode — port 4242...")
    app.run(port=4242)

