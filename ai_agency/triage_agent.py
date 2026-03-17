import os
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

class TriageAgent:
    """
    Predictive No-Show Preventer for MedSpas & Vets.
    Treats appointment triage as a predictive problem by computing
    Flight Risk Scores and auto-negotiating reschedules via AI SMS.
    """
    
    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
    def calculate_flight_risk(self, patient_history, appointment_type):
        """
        Calculates the probability of a no-show based on risk factors.
        (MVP uses a mock calculation for demo purposes)
        """
        # In a real app, this would use ML on historical clinic CRM data
        risk_score = 0
        if "new_patient" in patient_history:
            risk_score += 40
        if "laser" in appointment_type.lower() or "surgery" in appointment_type.lower():
            risk_score += 30 # high-anxiety procedures
        if "previously_cancelled" in patient_history:
            risk_score += 25
            
        return min(risk_score, 99) # return score out of 100
        
    def draft_proactive_sms(self, patient_name, appointment_time, procedure):
        """
        Drafts a conversational, low-friction SMS to engage a high-risk patient
        and uncover hidden objections/cancellations before they happen.
        """
        prompt = f"""
        You are the friendly front desk AI for a premium MedSpa/Vet clinic.
        Draft a short, engaging SMS to an appointment scheduled for {appointment_time} for a {procedure}.
        The patient's name is {patient_name}.
        
        DO NOT send a generic "Reply C to confirm or X to cancel."
        INSTEAD, ask an engaging question to gauge their readiness, such as:
        "Just checking if you had any last-minute questions about the {procedure}?" or
        "Did you get the pre-care instructions for tomorrow?"
        
        Keep it under 2 sentences. No emojis.
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Failed to draft SMS: {e}")
            return f"Hi {patient_name}, checking in on your {procedure} appointment for {appointment_time}. Any questions?"
            
    def handle_cancellation_response(self, patient_response):
        """
        If the patient indicates they can't make it, the AI generates a negotiation 
        response to lock them into a new time slot instantly.
        """
        prompt = f"""
        A patient just texted back indicating they cannot make their appointment:
        "{patient_response}"
        
        Draft a polite, empathetic text back offering to reschedule them. 
        Invent 2 specific alternative times (e.g., "Would tomorrow at 3 PM or Thursday at 10 AM work better?").
        Keep it under 3 sentences.
        """
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return "No worries at all! Would you like to reschedule for tomorrow afternoon or sometime next week?"

if __name__ == "__main__":
    agent = TriageAgent()
    
    # Simulate the pipeline
    risk = agent.calculate_flight_risk(["new_patient"], "Laser Hair Removal")
    print(f"Calculated Flight Risk Score: {risk}%")
    
    if risk > 60:
        print("\n[AI] Triggering proactive triage SMS...")
        sms = agent.draft_proactive_sms("Sarah", "Tomorrow @ 2 PM", "Laser Hair Removal")
        print(f"SMS Draft: {sms}")
        
        # Simulate patient saying they can't make it
        print("\n[Patient Response]: Actually I got called into work, so sorry!")
        rebook_sms = agent.handle_cancellation_response("Actually I got called into work, so sorry!")
        print(f"[AI Rebook Negotiation]: {rebook_sms}")
