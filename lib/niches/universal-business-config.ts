/**
 * Universal Business Configuration System
 *
 * This is the foundation for Scale with Jak's Growth Engine SaaS.
 * Any business type can use this system by filling in their details.
 *
 * Architecture:
 * - Business-agnostic AI caller script with dynamic variables
 * - Customizable persona, services, pricing, and workflows
 * - Multi-tenant ready for SaaS clients
 */

// ============================================================================
// BUSINESS CONFIGURATION INTERFACE
// ============================================================================

export interface BusinessConfig {
  // Core Business Identity
  id: string;
  name: string;
  industry: string; // e.g., "dental", "medspa", "law", "real estate", "home services"
  tagline?: string;

  // Contact & Location
  phone: string;
  email?: string;
  website?: string;
  address?: string;

  // Operating Hours
  hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };

  // AI Assistant Configuration
  aiAssistant: {
    name: string; // e.g., "Aria", "Alex", "Sarah"
    voiceId?: string; // ElevenLabs voice ID
    personality: 'professional' | 'warm' | 'casual' | 'luxury' | 'friendly';
    greeting: string;
    objectives: string[]; // What should the AI accomplish?
    fallbackMessage: string; // When AI needs to escalate
  };

  // Services & Pricing
  services: BusinessService[];

  // Booking Configuration
  booking: {
    requiresConsultation: boolean;
    consultationFree: boolean;
    consultationDuration?: number; // minutes
    acceptsWalkIns: boolean;
    typicalBookingWindow: string; // e.g., "same day", "1-2 weeks", "1 month+"
  };

  // Common Questions & Answers
  faq?: {
    question: string;
    answer: string;
  }[];

  // Objection Handling
  commonObjections?: {
    trigger: string; // e.g., "expensive", "nervous", "pain"
    response: string;
  }[];

  // Follow-up Messaging
  messaging: {
    bookingConfirmation: string;
    postService: string;
    reviewRequest: string;
    reactivation: string;
    leadNurture: string;
  };

  // Payment & Financing
  payment?: {
    acceptsInsurance: boolean;
    insuranceProviders?: string[];
    financingAvailable: boolean;
    financingProviders?: string[]; // e.g., "CareCredit", "Cherry"
  };
}

export interface BusinessService {
  name: string;
  category?: string;
  description?: string;
  priceRange?: {
    min: number;
    max?: number;
    unit?: string; // e.g., "per unit", "per session", "per hour"
  };
  duration?: number; // minutes
  consultationRequired?: boolean;
}

// ============================================================================
// UNIVERSAL AI VOICE PROMPT GENERATOR
// ============================================================================

export function generateUniversalVoicePrompt(config: BusinessConfig): string {
  const servicesText = generateServicesSection(config.services);
  const faqText = generateFAQSection(config.faq || []);
  const objectionsText = generateObjectionsSection(config.commonObjections || []);
  const hoursText = generateHoursText(config.hours);
  const personalityStyle = getPersonalityStyle(config.aiAssistant.personality);

  return `
[IDENTITY]
Your name is ${config.aiAssistant.name}. You are the AI front desk receptionist for ${config.name}${config.tagline ? ` — ${config.tagline}` : ''}. You speak with ${personalityStyle}. You are not a robot. You are ${config.aiAssistant.name}.

[VOICE STYLE]
${getVoiceStyleInstructions(config.aiAssistant.personality)}
- Never say "As an AI" or "I\'m a virtual assistant"
- If you don\'t know something specific, say: "${config.aiAssistant.fallbackMessage}"

[BUSINESS DETAILS]
Business: ${config.name}
${config.tagline ? `Tagline: "${config.tagline}"` : ''}
Industry: ${config.industry}

${servicesText}

${config.booking.requiresConsultation ? `
Consultation: ${config.booking.consultationFree ? 'Free' : 'Paid'} ${config.booking.consultationDuration || 15}-minute ${config.booking.consultationFree ? 'complimentary ' : ''}consultation available
` : ''}
Booking: Appointments ${config.booking.acceptsWalkIns ? 'preferred, walk-ins accepted based on availability' : 'required'}.
Hours: ${hoursText}
${config.address ? `Location: ${config.address}` : ''}
${config.phone ? `Phone: ${config.phone}` : ''}
${config.website ? `Website: ${config.website}` : ''}

[GREETING — USE THIS EXACT FLOW]
Answer within 2 rings:
"${config.aiAssistant.greeting}"

If they pause or seem unsure:
"Are you looking to book an appointment, get some pricing info, or just have some questions?"

[BOOKING FLOW]

Step 1 — Understand what they want:
"What brings you in today? ${generateServicePrompt(config.services)}"

Step 2 — First-time caller:
"Have you worked with ${config.name} before, or would this be your first visit with us?"
  → First-timer: ${generateFirstTimeResponse(config)}
  → Returning: "Welcome back! ${generateReturningClientResponse(config)}"

Step 3 — Collect their info:
"Can I get your first and last name?"
"And the best number to reach you — I\'ll text you a confirmation."
${config.email ? '"And your email for your appointment summary?"' : ''}

Step 4 — Find a time:
"Are you more of a morning person or do afternoons work better?"
"We have availability ${config.booking.typicalBookingWindow}. Does [DAY] at [TIME] work for you?"

Step 5 — Confirm:
"Perfect! I\'ve got you scheduled for [SERVICE] on [DATE] at [TIME]. You\'ll get a text confirmation shortly. Is there anything else I can help you with?"

${objectionsText}

${faqText}

[AFTER HOURS]
"Thanks for calling ${config.name}! Our team is currently unavailable — we\'re open ${hoursText}. Leave me your name and number and I\'ll make sure someone calls you first thing when we open. Or if you\'d like, I can book you right now and we\'ll confirm everything in the morning!"

[ESCALATION — TRANSFER TO HUMAN]
Trigger when:
- Caller asks for a specific person by name
- ${config.industry === 'dental' || config.industry === 'medspa' || config.industry === 'law' ? 'Complex questions beyond general information' : 'Technical or specialized questions'}
- Complaints or billing disputes
- Caller explicitly asks to speak to someone

Response: "Absolutely — let me get one of our team members on the line for you. One moment, please don\'t hang up."

[DO NOT DO]
${getIndustrySpecificRestrictions(config.industry)}
- Never pressure or hard-sell
- Never put someone on hold for more than 30 seconds without checking back in
`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPersonalityStyle(personality: string): string {
  const styles = {
    professional: 'professionalism, clarity, and confidence',
    warm: 'warmth, empathy, and friendliness',
    casual: 'a relaxed, conversational, and approachable tone',
    luxury: 'sophistication, elegance, and premium service',
    friendly: 'enthusiasm, positivity, and genuine care'
  };
  return styles[personality as keyof typeof styles] || styles.professional;
}

function getVoiceStyleInstructions(personality: string): string {
  const instructions = {
    professional: `- Clear and articulate — like a seasoned professional
- Confident and knowledgeable
- Use phrases like: "Absolutely", "I\'d be happy to help", "Let me check that for you"`,

    warm: `- Conversational and caring — like a helpful friend
- Empathetic and understanding
- Use phrases like: "Of course!", "I totally understand", "That\'s a great question"`,

    casual: `- Laid-back and approachable
- Use natural, everyday language
- Use phrases like: "Sure thing!", "No problem", "Sounds good"`,

    luxury: `- Polished and refined — like a concierge at a 5-star hotel
- Graceful and attentive
- Use phrases like: "It would be my pleasure", "Wonderful", "Certainly"`,

    friendly: `- Upbeat and enthusiastic
- Positive and encouraging
- Use phrases like: "Great!", "Awesome!", "That\'s perfect"`
  };
  return instructions[personality as keyof typeof instructions] || instructions.professional;
}

function generateServicesSection(services: BusinessService[]): string {
  if (services.length === 0) return 'Services: Available upon request';

  let text = 'Services:\n';

  // Group by category if available
  const categorized = services.reduce((acc, service) => {
    const category = service.category || 'Main Services';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, BusinessService[]>);

  for (const [category, categoryServices] of Object.entries(categorized)) {
    if (Object.keys(categorized).length > 1) {
      text += `\n${category}:\n`;
    }

    categoryServices.forEach(service => {
      let line = `  - ${service.name}`;
      if (service.description) line += ` (${service.description})`;
      if (service.priceRange) {
        const { min, max, unit } = service.priceRange;
        line += ` — from $${min}${max ? ` to $${max}` : ''}${unit ? `/${unit}` : ''}`;
      }
      text += `${line}\n`;
    });
  }

  return text;
}

function generateServicePrompt(services: BusinessService[]): string {
  if (services.length === 0) return 'What can I help you with?';

  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

  if (categories.length >= 2) {
    return `Are you interested in ${categories.slice(0, -1).join(', ')}, or ${categories[categories.length - 1]}?`;
  }

  if (services.length <= 3) {
    return `Are you thinking about ${services.map(s => s.name.toLowerCase()).join(', or ')}?`;
  }

  return 'What service are you interested in?';
}

function generateFirstTimeResponse(config: BusinessConfig): string {
  if (config.booking.requiresConsultation) {
    return `"Perfect — we\'d love to have you! For new clients, we ${config.booking.consultationFree ? 'actually recommend' : 'require'} starting with a ${config.booking.consultationFree ? 'complimentary' : ''} ${config.booking.consultationDuration || 15}-minute consultation so we can ${getIndustryConsultationGoal(config.industry)}. ${config.booking.consultationFree ? 'It\'s totally free and ' : ''}No pressure."`;
  }
  return `"Excellent! We\'re excited to work with you. Let\'s get you scheduled."`;
}

function generateReturningClientResponse(config: BusinessConfig): string {
  return `"Great to hear from you again! What can we help you with today?"`;
}

function getIndustryConsultationGoal(industry: string): string {
  const goals: Record<string, string> = {
    dental: 'assess your needs and create a personalized treatment plan',
    medspa: 'customize a plan just for you',
    law: 'understand your case and explain your options',
    'real estate': 'understand your needs and find the perfect property',
    'home services': 'assess the job and provide an accurate quote',
    default: 'understand your needs and provide the best solution'
  };
  return goals[industry] || goals.default;
}

function generateFAQSection(faqs: { question: string; answer: string }[]): string {
  if (faqs.length === 0) return '';

  let text = '\n[COMMON QUESTIONS & ANSWERS]\n\n';

  faqs.forEach(faq => {
    text += `"${faq.question}"\n→ "${faq.answer}"\n\n`;
  });

  return text;
}

function generateObjectionsSection(objections: { trigger: string; response: string }[]): string {
  if (objections.length === 0) return '';

  let text = '\n[COMMON OBJECTIONS & RESPONSES]\n\n';

  objections.forEach(obj => {
    text += `"${obj.trigger}"\n→ "${obj.response}"\n\n`;
  });

  return text;
}

function generateHoursText(hours: BusinessConfig['hours']): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule: string[] = [];

  days.forEach(day => {
    const time = hours[day as keyof typeof hours];
    if (time) {
      schedule.push(`${day.charAt(0).toUpperCase() + day.slice(1)} ${time}`);
    }
  });

  if (schedule.length === 0) return 'Please call for hours';

  // Consolidate consecutive days with same hours
  return schedule.join(', ');
}

function getIndustrySpecificRestrictions(industry: string): string {
  const restrictions: Record<string, string> = {
    dental: '- Never diagnose conditions\n- Never quote specific medical procedures without consultation\n- Never guarantee specific results',
    medspa: '- Never quote specific medical dosages\n- Never diagnose skin conditions\n- Never guarantee specific results',
    law: '- Never provide legal advice\n- Never quote exact fees without consultation\n- Never guarantee case outcomes',
    medical: '- Never diagnose or prescribe\n- Never provide medical advice beyond scheduling\n- Never guarantee treatment outcomes',
    default: '- Never make promises you cannot keep\n- Never quote prices outside established ranges'
  };
  return restrictions[industry] || restrictions.default;
}

// ============================================================================
// EXAMPLE UNIVERSAL BUSINESS CONFIGS
// ============================================================================

export const UniversalBusinessTemplate: BusinessConfig = {
  id: 'template',
  name: '[Your Business Name]',
  industry: 'general',
  tagline: '[Optional Tagline]',
  phone: '[Your Phone Number]',
  email: '[Your Email]',
  website: '[Your Website]',
  address: '[Your Address]',
  hours: {
    monday: '9am-5pm',
    tuesday: '9am-5pm',
    wednesday: '9am-5pm',
    thursday: '9am-5pm',
    friday: '9am-5pm',
    saturday: 'Closed',
    sunday: 'Closed'
  },
  aiAssistant: {
    name: '[AI Name]',
    personality: 'professional',
    greeting: 'Thank you for calling [Your Business Name], this is [AI Name]! How can I help you today?',
    objectives: [
      'Book appointments efficiently',
      'Answer common questions',
      'Capture lead information',
      'Provide excellent customer service'
    ],
    fallbackMessage: 'Let me have one of our team members call you right back with the exact details on that.'
  },
  services: [
    {
      name: '[Service 1]',
      category: '[Category]',
      description: '[Brief description]',
      priceRange: { min: 100, max: 500 }
    }
  ],
  booking: {
    requiresConsultation: false,
    consultationFree: true,
    consultationDuration: 15,
    acceptsWalkIns: true,
    typicalBookingWindow: '1-2 weeks'
  },
  messaging: {
    bookingConfirmation: 'You\'re all set with [Business Name]! We look forward to seeing you. Reply CONFIRM to confirm your appointment.',
    postService: 'Hi [Name], thank you for choosing [Business Name]! We hope everything went well. Let us know if you need anything.',
    reviewRequest: 'Thanks for working with us! If you had a great experience, we\'d love a review: [Link]',
    reactivation: 'Hi [Name]! It\'s been a while. We\'d love to see you again. Ready to book?',
    leadNurture: 'Hi [Name]! Thanks for your interest in [Business Name]. Let us know if you have any questions or if you\'re ready to schedule.'
  }
};

// Export conversation flows (business-agnostic)
export const UniversalConversationFlows = {
  inbound_booking: {
    name: "Inbound Booking",
    steps: [
      { id: 1, label: "Greeting", script: "Answer with configured greeting" },
      { id: 2, label: "Identify Intent", script: "Are you looking to book, get pricing, or have questions?", branches: ["booking", "pricing", "info"] },
      { id: 3, label: "New vs Returning", script: "First visit or returning client?", branches: ["new_client", "returning_client"] },
      { id: 4, label: "Collect Info", script: "Name, phone, email" },
      { id: 5, label: "Find Time", script: "Availability check + scheduling" },
      { id: 6, label: "Confirm", script: "Confirmation + SMS notification" },
    ]
  },
  pricing_inquiry: {
    name: "Pricing Inquiry",
    steps: [
      { id: 1, label: "Identify Service", script: "Which service are you interested in?" },
      { id: 2, label: "Provide Range", script: "Give starting price + typical range from config" },
      { id: 3, label: "Soft Offer", script: "Would you like to schedule?" },
      { id: 4, label: "Book or Follow Up", script: "Book appointment or capture lead" },
    ]
  },
  objection_handling: {
    name: "Objection Handling",
    triggers: ["nervous", "expensive", "think about it", "not sure", "need to check"],
    response_style: "empathize, then educate, then soft offer"
  },
  after_hours: {
    name: "After Hours",
    steps: [
      { id: 1, label: "Acknowledge", script: "We\'re currently closed..." },
      { id: 2, label: "Offer Self-Serve", script: "I can book you for when we open" },
      { id: 3, label: "Capture Lead", script: "Leave name + number for callback" },
    ]
  }
};
