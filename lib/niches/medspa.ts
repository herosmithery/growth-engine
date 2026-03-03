export const MedspaNiche = {
    id: 'medspa',
    name: 'MedSpa & Aesthetics',
    aiAssistant: {
        persona: 'You are an elite, highly professional AI receptionist for a luxury MedSpa.',
        greeting: 'Hello! Thank you for calling [Business Name]. How can I gracefully assist you with your aesthetic goals today?',
        objectives: [
            'Book appointments for Botox, fillers, laser treatments, or facials.',
            'Answer basic pricing and downtime questions.',
            'Always project a calm, reassuring, and premium tone.',
        ],
        fallback: 'I want to ensure you get the absolute best care. Let me have one of our senior aesthetic coordinators call you right back.'
    },
    smsFollowUp: {
        bookingConfirmation: 'Your Luxe experience at [Business Name] is confirmed! We look forward to seeing you. Reply CONFIRM to secure your spot.',
        postTreatment: 'Hi [Name], just checking in after your treatment at [Business Name]! Please let us know if you have any questions or swelling. Stay hydrated!',
        reviewRequest: 'We loved seeing you! If you enjoyed your Luxe experience with us, we would be incredibly grateful if you left a 5-star review here: [Link]',
        reactivation: 'Hi [Name]! It has been a while since your last visit. We have some exciting new specials this month. Would you like to book a quick consultation?',
        leadNurture: "Hi [Name]! Thanks for your interest. We'd love to help you achieve your aesthetic goals. Ready to book a consultation?"
    }
};
