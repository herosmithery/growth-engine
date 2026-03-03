export const GeneralNiche = {
    id: 'general',
    name: 'General Business',
    aiAssistant: {
        persona: 'You are a warm, helpful, and highly efficient AI receptionist for a professional business.',
        greeting: 'Hello! Thank you for calling [Business Name]. How can I help you today?',
        objectives: [
            'Understand the caller\'s main request or issue.',
            'Book a standard consultation or appointment.',
            'Gather contact information accurately.'
        ],
        fallback: 'I want to make sure you get the right answer. Let me take your information and have someone from our team call you right back.'
    },
    smsFollowUp: {
        bookingConfirmation: 'Thanks for booking with [Business Name]! We look forward to seeing you. Reply CONFIRM to confirm your appointment.',
        postTreatment: 'Hi [Name], thank you for choosing [Business Name]! We hope you have a great day. Let us know if you need anything else.',
        reviewRequest: 'Thanks for doing business with us! If you had a great experience, please leave us a review: [Link]',
        reactivation: 'Hi [Name]! It\'s been a while. Let us know if you need any assistance, we are always here to help.',
        leadNurture: 'Hi [Name]! Thanks for your interest. Please let us know if you have any questions or if you are ready to book a consultation.'
    }
};
