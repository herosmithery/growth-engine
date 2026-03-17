"""
Growth Engine - Simple API Server for Render
"""
from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("PORT", 4242))

@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "service": "Growth Engine API",
        "version": "1.0.0"
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

@app.route('/api/clients')
def get_clients():
    """Return demo client data"""
    return jsonify({
        "success": True,
        "clients": [
            {
                "client_id": "demo_001",
                "business_name": "Growth Engine Demo",
                "active": True,
                "monthly_rate": 497,
                "tier": "growth",
                "vertical": "default"
            }
        ],
        "total_clients": 1,
        "total_mrr": 497
    })

if __name__ == '__main__':
    print(f"🚀 Starting Growth Engine API on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
