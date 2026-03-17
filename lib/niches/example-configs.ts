/**
 * Example Business Configurations
 *
 * These are ready-to-use templates for different industries.
 * SaaS clients can copy and customize these for their businesses.
 */

import { BusinessConfig } from './universal-business-config';

// ============================================================================
// DENTAL PRACTICE
// ============================================================================

export const DentalPracticeConfig: BusinessConfig = {
  id: 'dental_example',
  name: 'Smile Dental Care',
  industry: 'dental',
  tagline: 'Your family\'s smile is our priority',
  phone: '(555) 123-4567',
  email: 'hello@smiledentalcare.com',
  website: 'www.smiledentalcare.com',
  address: '123 Main Street, Anytown, USA',
  hours: {
    monday: '8am-5pm',
    tuesday: '8am-5pm',
    wednesday: '8am-5pm',
    thursday: '8am-5pm',
    friday: '8am-3pm',
    saturday: 'Closed',
    sunday: 'Closed'
  },
  aiAssistant: {
    name: 'Sarah',
    personality: 'warm',
    greeting: 'Thank you for calling Smile Dental Care, this is Sarah! How can I help you with your dental care today?',
    objectives: [
      'Schedule appointments for cleanings, exams, and treatments',
      'Answer insurance and pricing questions',
      'Handle emergency dental situations with urgency',
      'Verify insurance coverage'
    ],
    fallbackMessage: 'Let me have one of our dental coordinators call you right back with the exact details on that.'
  },
  services: [
    {
      name: 'Routine Cleaning & Exam',
      category: 'Preventive Care',
      priceRange: { min: 150, max: 250 },
      duration: 60
    },
    {
      name: 'Teeth Whitening',
      category: 'Cosmetic',
      priceRange: { min: 400, max: 800 },
      duration: 90
    },
    {
      name: 'Dental Implants',
      category: 'Restorative',
      priceRange: { min: 3000, max: 6000 },
      consultationRequired: true
    },
    {
      name: 'Emergency Visit',
      category: 'Emergency Care',
      description: 'Same-day emergency appointments available',
      priceRange: { min: 200 }
    }
  ],
  booking: {
    requiresConsultation: false,
    consultationFree: true,
    consultationDuration: 15,
    acceptsWalkIns: false,
    typicalBookingWindow: '1-2 weeks'
  },
  payment: {
    acceptsInsurance: true,
    insuranceProviders: ['Delta Dental', 'MetLife', 'Cigna', 'Aetna', 'Blue Cross'],
    financingAvailable: true,
    financingProviders: ['CareCredit']
  },
  faq: [
    {
      question: 'Do you take my insurance?',
      answer: 'We accept most major dental insurance plans including Delta Dental, MetLife, Cigna, Aetna, and Blue Cross. We can verify your specific coverage when you book your appointment.'
    },
    {
      question: 'How much is a cleaning?',
      answer: 'A routine cleaning and exam typically runs between $150 and $250 depending on your needs. If you have insurance, your plan may cover most or all of this.'
    },
    {
      question: 'Do you handle dental emergencies?',
      answer: 'Absolutely! We reserve time every day for emergency appointments. If you\'re in pain or have a dental emergency, we\'ll get you in as soon as possible — often same-day.'
    }
  ],
  commonObjections: [
    {
      trigger: 'too expensive',
      response: 'I totally understand dental care is an investment. The good news is we accept most insurance plans, and we also offer CareCredit financing with interest-free payment plans. Many patients pay as little as $50/month. Would you like me to check your insurance benefits?'
    },
    {
      trigger: 'nervous',
      response: 'You\'re definitely not alone — dental anxiety is really common! Our team specializes in gentle care, and Dr. Smith is known for making nervous patients feel comfortable. We also offer sedation options if that would help. Would you like to start with just a consultation to meet the team first?'
    },
    {
      trigger: 'in pain',
      response: 'I\'m so sorry you\'re in pain. Let\'s get you in right away. We have emergency slots available today. What time works best for you — morning or afternoon?'
    }
  ],
  messaging: {
    bookingConfirmation: 'You\'re all set at Smile Dental Care! Your appointment is confirmed. Reply CONFIRM or call us to reschedule. See you soon! 😊',
    postService: 'Hi [Name], thanks for visiting Smile Dental Care! How are you feeling? Let us know if you have any questions. Have a great day! 🦷',
    reviewRequest: 'We loved seeing you! If you had a great experience at Smile Dental Care, we\'d be so grateful for a review: [Link] ⭐',
    reactivation: 'Hi [Name]! It\'s been 6 months since your last cleaning. Ready to book your next appointment? Reply YES and we\'ll get you scheduled! 🦷',
    leadNurture: 'Hi [Name]! Thanks for reaching out to Smile Dental Care. Ready to schedule your appointment? We\'d love to help with your dental care. Reply BOOK to get started!'
  }
};

// ============================================================================
// HOME SERVICES (HVAC, PLUMBING, ELECTRICAL)
// ============================================================================

export const HomeServicesConfig: BusinessConfig = {
  id: 'home_services_example',
  name: 'ProFix Home Services',
  industry: 'home services',
  tagline: 'Fast, reliable HVAC, plumbing & electrical',
  phone: '(555) 987-6543',
  email: 'service@profixhome.com',
  website: 'www.profixhome.com',
  address: 'Serving Greater Metro Area',
  hours: {
    monday: '7am-7pm',
    tuesday: '7am-7pm',
    wednesday: '7am-7pm',
    thursday: '7am-7pm',
    friday: '7am-7pm',
    saturday: '8am-4pm',
    sunday: 'Emergency calls only'
  },
  aiAssistant: {
    name: 'Alex',
    personality: 'friendly',
    greeting: 'Thanks for calling ProFix Home Services, this is Alex! What can I help you with today?',
    objectives: [
      'Schedule service appointments quickly',
      'Triage emergency vs routine calls',
      'Provide rough pricing estimates',
      'Dispatch technicians efficiently'
    ],
    fallbackMessage: 'Let me get one of our service coordinators on the line to help you with that.'
  },
  services: [
    {
      name: 'AC Repair',
      category: 'HVAC',
      priceRange: { min: 150, max: 800 },
      duration: 120
    },
    {
      name: 'Furnace Maintenance',
      category: 'HVAC',
      priceRange: { min: 99, unit: 'service call' },
      duration: 60
    },
    {
      name: 'Plumbing Repair',
      category: 'Plumbing',
      priceRange: { min: 125, max: 500 },
      duration: 90
    },
    {
      name: 'Electrical Troubleshooting',
      category: 'Electrical',
      priceRange: { min: 150 },
      duration: 60
    },
    {
      name: 'Emergency Service',
      description: '24/7 emergency response',
      priceRange: { min: 200, unit: 'service call' }
    }
  ],
  booking: {
    requiresConsultation: false,
    consultationFree: false,
    acceptsWalkIns: false,
    typicalBookingWindow: 'same day'
  },
  faq: [
    {
      question: 'How quickly can you get here?',
      answer: 'For emergencies, we can usually have a technician to you within 2-4 hours. For routine service, we can often get you scheduled same-day or next-day depending on availability.'
    },
    {
      question: 'Do you charge for estimates?',
      answer: 'Our service call fee is $99, which includes diagnosis and a written estimate. If you approve the repair, that fee goes toward the work.'
    },
    {
      question: 'Are you licensed and insured?',
      answer: 'Absolutely! All our techn are fully licensed, bonded, and insured. We\'re also A+ rated with the Better Business Bureau.'
    }
  ],
  commonObjections: [
    {
      trigger: 'expensive',
      response: 'I get it — home repairs can add up. The good news is we offer upfront pricing before any work starts, and we have financing available through Synchrony with 0% interest options. Plus, our repairs come with a 1-year warranty. Would you like to hear your options?'
    },
    {
      trigger: 'emergency',
      response: 'No problem — we handle emergencies all the time. I can get a technician dispatched to you right away. What\'s your address? And just to confirm, is this for HVAC, plumbing, or electrical?'
    }
  ],
  messaging: {
    bookingConfirmation: 'Your ProFix service call is confirmed! Our technician will arrive during your scheduled window. Reply with questions anytime. 🔧',
    postService: 'Hi [Name]! Thanks for choosing ProFix. How did everything go with your service today? Let us know if you need anything else! 👍',
    reviewRequest: 'Thanks for trusting ProFix with your home! If we did a great job, we\'d love a review: [Link] ⭐',
    reactivation: 'Hi [Name]! Time for your seasonal HVAC tune-up? Book now and save $20 on maintenance. Reply BOOK to schedule! 🔧',
    leadNurture: 'Hi [Name]! Thanks for reaching out to ProFix. Ready to get your home fixed up? Reply YES and we\'ll get a technician scheduled ASAP! 🛠️'
  }
};

// ============================================================================
// LAW FIRM
// ============================================================================

export const LawFirmConfig: BusinessConfig = {
  id: 'law_firm_example',
  name: 'Smith & Associates Law',
  industry: 'law',
  tagline: 'Experienced representation you can trust',
  phone: '(555) 234-5678',
  email: 'contact@smithlawfirm.com',
  website: 'www.smithlawfirm.com',
  address: '456 Legal Plaza, Downtown',
  hours: {
    monday: '9am-6pm',
    tuesday: '9am-6pm',
    wednesday: '9am-6pm',
    thursday: '9am-6pm',
    friday: '9am-5pm',
    saturday: 'By appointment',
    sunday: 'Closed'
  },
  aiAssistant: {
    name: 'Jordan',
    personality: 'professional',
    greeting: 'Thank you for calling Smith & Associates Law, this is Jordan. How may I assist you today?',
    objectives: [
      'Schedule consultations with appropriate attorney',
      'Screen for case type and urgency',
      'Collect preliminary case information',
      'Maintain confidentiality and professionalism'
    ],
    fallbackMessage: 'I\'d like to connect you with one of our attorneys who can discuss the specific details of your case.'
  },
  services: [
    {
      name: 'Personal Injury Consultation',
      category: 'Personal Injury',
      description: 'Car accidents, slip & fall, workplace injuries',
      priceRange: { min: 0, unit: 'free consultation' },
      consultationRequired: true
    },
    {
      name: 'Family Law Consultation',
      category: 'Family Law',
      description: 'Divorce, custody, child support',
      priceRange: { min: 250, unit: 'initial consultation' },
      consultationRequired: true
    },
    {
      name: 'Estate Planning',
      category: 'Estate Planning',
      description: 'Wills, trusts, probate',
      priceRange: { min: 500, max: 3000 }
    },
    {
      name: 'Business Law',
      category: 'Business',
      description: 'Contracts, formation, disputes',
      consultationRequired: true
    }
  ],
  booking: {
    requiresConsultation: true,
    consultationFree: false, // Varies by practice area
    consultationDuration: 30,
    acceptsWalkIns: false,
    typicalBookingWindow: '1 week'
  },
  faq: [
    {
      question: 'How much do you charge?',
      answer: 'Our fees vary depending on the type of case. Personal injury cases are handled on contingency — you don\'t pay unless we win. For other matters, we can discuss fees during your initial consultation. Would you like to schedule a consultation to discuss your case?'
    },
    {
      question: 'Do I have a case?',
      answer: 'That\'s exactly what we\'ll determine during your consultation. I\'ll need to have you speak with one of our attorneys who can review the details and give you an honest assessment. Can I schedule you for a consultation?'
    }
  ],
  commonObjections: [
    {
      trigger: 'too expensive',
      response: 'I understand legal fees are a concern. For personal injury cases, we work on contingency — you pay nothing unless we win your case. For other matters, we offer flexible payment plans. The consultation will help us understand your needs and provide transparent pricing. Would you like to schedule?'
    },
    {
      trigger: 'not sure if I need a lawyer',
      response: 'That\'s a fair question. The consultation is designed exactly for that — to help you understand your options and whether legal representation makes sense for your situation. Many clients wish they\'d come in sooner. Would you like to schedule a consultation to explore your options?'
    }
  ],
  messaging: {
    bookingConfirmation: 'Your consultation with Smith & Associates Law is confirmed. Please bring any relevant documents. Reply with questions anytime.',
    postService: 'Hi [Name], thank you for meeting with us. Your attorney will follow up shortly with next steps. Please don\'t hesitate to reach out with questions.',
    reviewRequest: 'Thank you for trusting Smith & Associates Law. If you were satisfied with our service, we\'d appreciate a review: [Link]',
    reactivation: 'Hi [Name], this is Smith & Associates Law. We wanted to check in regarding your case. Please call us when you have a moment.',
    leadNurture: 'Hi [Name], thank you for your inquiry to Smith & Associates Law. We\'d like to schedule a consultation to discuss your case. Are you available this week?'
  }
};

// ============================================================================
// REAL ESTATE AGENCY
// ============================================================================

export const RealEstateConfig: BusinessConfig = {
  id: 'real_estate_example',
  name: 'Prestige Realty Group',
  industry: 'real estate',
  tagline: 'Your dream home awaits',
  phone: '(555) 345-6789',
  email: 'info@prestigerealty.com',
  website: 'www.prestigerealty.com',
  address: '789 Market Street',
  hours: {
    monday: '9am-7pm',
    tuesday: '9am-7pm',
    wednesday: '9am-7pm',
    thursday: '9am-7pm',
    friday: '9am-7pm',
    saturday: '10am-6pm',
    sunday: '12pm-5pm'
  },
  aiAssistant: {
    name: 'Taylor',
    personality: 'friendly',
    greeting: 'Thanks for calling Prestige Realty Group, this is Taylor! Are you looking to buy, sell, or just explore your options?',
    objectives: [
      'Qualify buyer/seller leads',
      'Schedule property showings',
      'Connect prospects with the right agent',
      'Capture property preferences and budget'
    ],
    fallbackMessage: 'Let me connect you with one of our experienced agents who can help you with that.'
  },
  services: [
    {
      name: 'Home Buying Services',
      description: 'Find your perfect home with expert guidance',
      priceRange: { min: 0, unit: 'no fee to buyers' }
    },
    {
      name: 'Home Selling Services',
      description: 'Professional marketing and negotiation',
      priceRange: { min: 0, unit: 'commission-based' }
    },
    {
      name: 'Property Valuation',
      description: 'Free home market analysis',
      priceRange: { min: 0, unit: 'complimentary' }
    },
    {
      name: 'Investment Property Consultation',
      description: 'Build wealth through real estate',
      consultationRequired: true
    }
  ],
  booking: {
    requiresConsultation: true,
    consultationFree: true,
    consultationDuration: 30,
    acceptsWalkIns: false,
    typicalBookingWindow: 'same day'
  },
  faq: [
    {
      question: 'How much do your services cost?',
      answer: 'For buyers, our services are completely free — seller pays our commission. For sellers, we work on commission which we\'ll discuss during your free consultation. There are no upfront fees.'
    },
    {
      question: 'Can I see a property today?',
      answer: 'Absolutely! We often arrange same-day showings. Which property are you interested in, and what time works best for you?'
    },
    {
      question: 'What\'s my home worth?',
      answer: 'Great question! We offer free home valuations. One of our agents can come take a look and provide you with a comprehensive market analysis — usually within 24 hours. When works for you?'
    }
  ],
  commonObjections: [
    {
      trigger: 'just looking',
      response: 'No problem at all — that\'s the perfect time to start! Most buyers explore for a few months before finding the right home. Would you like us to send you new listings that match what you\'re looking for? We can also schedule showings whenever you\'re ready.'
    },
    {
      trigger: 'working with another agent',
      response: 'I totally understand. If things don\'t work out or if you\'d like a second opinion, we\'re always here. Can I grab your info so we can keep in touch?'
    }
  ],
  messaging: {
    bookingConfirmation: 'Your showing with Prestige Realty is confirmed! Your agent will meet you at the property. Reply with any questions. 🏡',
    postService: 'Hi [Name]! What did you think of the property? Would you like to schedule more showings? We\'re here to help! 🔑',
    reviewRequest: 'Thanks for choosing Prestige Realty! If you loved working with us, we\'d be so grateful for a review: [Link] ⭐',
    reactivation: 'Hi [Name]! Haven\'t heard from you in a while. See anything you like lately? We have some great new listings. Want to schedule a showing? 🏡',
    leadNurture: 'Hi [Name]! Thanks for reaching out to Prestige Realty. Ready to start your home search? We\'d love to help you find the perfect place! Reply YES to get started. 🔑'
  }
};

// ============================================================================
// FITNESS/GYM
// ============================================================================

export const FitnessConfig: BusinessConfig = {
  id: 'fitness_example',
  name: 'Peak Performance Gym',
  industry: 'fitness',
  tagline: 'Transform your body, transform your life',
  phone: '(555) 456-7890',
  email: 'hello@peakperformance.com',
  website: 'www.peakperformance.com',
  address: '321 Fitness Boulevard',
  hours: {
    monday: '5am-10pm',
    tuesday: '5am-10pm',
    wednesday: '5am-10pm',
    thursday: '5am-10pm',
    friday: '5am-9pm',
    saturday: '7am-7pm',
    sunday: '7am-7pm'
  },
  aiAssistant: {
    name: 'Casey',
    personality: 'friendly',
    greeting: 'Hey! Thanks for calling Peak Performance, this is Casey. Are you looking to start your fitness journey or do you have questions about membership?',
    objectives: [
      'Book free trial workouts',
      'Schedule membership tours',
      'Answer membership and class questions',
      'Convert trials to paid memberships'
    ],
    fallbackMessage: 'Let me have one of our membership advisors call you back to go over all the details.'
  },
  services: [
    {
      name: 'Monthly Membership',
      description: 'Unlimited access to gym and group classes',
      priceRange: { min: 49, max: 99, unit: 'per month' }
    },
    {
      name: 'Personal Training',
      description: '1-on-1 coaching with certified trainers',
      priceRange: { min: 60, max: 120, unit: 'per session' }
    },
    {
      name: 'Group Fitness Classes',
      description: 'Yoga, spin, HIIT, kickboxing & more',
      priceRange: { min: 0, unit: 'included with membership' }
    },
    {
      name: 'Free Trial Workout',
      priceRange: { min: 0, unit: 'complimentary' }
    }
  ],
  booking: {
    requiresConsultation: false,
    consultationFree: true,
    acceptsWalkIns: true,
    typicalBookingWindow: 'same day'
  },
  faq: [
    {
      question: 'How much is a membership?',
      answer: 'Our memberships start at $49/month for basic access, and go up to $99/month for our all-access plan with unlimited classes and amenities. We also have personal training add-ons. Want to come in for a free trial workout to check out the gym first?'
    },
    {
      question: 'Can I try it before joining?',
      answer: 'Absolutely! We offer a free trial workout — no commitment, no credit card required. You can try out the equipment, take a class, and see if it\'s a good fit. When works for you?'
    },
    {
      question: 'Do you have classes?',
      answer: 'Yes! We have over 50 classes per week — yoga, spin, HIIT, kickboxing, Zumba, and more. All included with membership. Want me to send you the class schedule?'
    }
  ],
  commonObjections: [
    {
      trigger: 'too expensive',
      response: 'I totally get it. The good news is we have plans starting at just $49/month — that\'s less than $2 per day for unlimited access. Plus, no hidden fees or long-term contracts. And honestly, most members say their energy and health improvements are worth way more. Want to try a free workout and see for yourself?'
    },
    {
      trigger: 'don\'t have time',
      response: 'That\'s exactly why our members love it here — we\'re open from 5am to 10pm, so you can fit in a workout whenever works for you. Even 30 minutes makes a difference. Plus, we have express classes that are only 30-45 minutes. Want to see the schedule?'
    },
    {
      trigger: 'haven\'t worked out in a while',
      response: 'You\'re in good company — most of our members started exactly where you are! Our trainers specialize in helping beginners, and we have classes for all fitness levels. No judgment, just support. How about a free trial so you can ease in at your own pace?'
    }
  ],
  messaging: {
    bookingConfirmation: 'Your free trial at Peak Performance is confirmed! Wear comfortable clothes and bring water. Reply with questions anytime. Let\'s do this! 💪',
    postService: 'Hey [Name]! How was your workout at Peak Performance? Ready to join and keep the momentum going? Let us know! 🔥',
    reviewRequest: 'Thanks for working out at Peak Performance! If you had a great experience, we\'d love a review: [Link] ⭐💪',
    reactivation: 'Hey [Name]! We miss seeing you at the gym! Ready to get back into your routine? First week back is on us. Reply YES to restart your membership! 💪',
    leadNurture: 'Hey [Name]! Ready to start your fitness journey at Peak Performance? We\'d love to get you in for a free trial workout. Reply BOOK to schedule! 🔥'
  }
};

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export const ExampleBusinessConfigs = {
  dental: DentalPracticeConfig,
  home_services: HomeServicesConfig,
  law: LawFirmConfig,
  real_estate: RealEstateConfig,
  fitness: FitnessConfig,
};
