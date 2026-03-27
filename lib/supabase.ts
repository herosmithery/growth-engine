import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient reads the session from cookies and attaches the user's
// JWT to every request, so RLS policies work correctly in the dashboard.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// =============================================================================
// Database Types
// =============================================================================

export interface Business {
    id: string;
    owner_id?: string;
    name: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    vapi_phone_number?: string;
    vapi_assistant_id?: string;
    twilio_phone_number?: string;
    timezone?: string;
    created_at: string;
    updated_at?: string;
}

export interface Client {
    id: string;
    business_id: string;
    first_name: string;
    last_name?: string;
    phone?: string;
    email?: string;
    date_of_birth?: string;
    source?: string;
    status?: 'active' | 'inactive' | 'vip' | 'churned';
    notes?: string;
    total_visits?: number;
    total_revenue?: number;
    last_visit_at?: string;
    created_at: string;
    updated_at?: string;
}

export interface Appointment {
    id: string;
    business_id: string;
    client_id?: string;
    treatment_name?: string;
    treatment_type?: string;
    treatment_category?: string;
    provider_name?: string;
    appointment_date?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
    price?: number;
    amount?: number;
    notes?: string;
    source?: string;
    confirmed_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    created_at: string;
    updated_at?: string;
    // Joined relations
    clients?: Client;
}

export interface Lead {
    id: string;
    business_id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    source?: string;
    source_details?: string;
    status: 'new' | 'contacted' | 'qualified' | 'appointment_scheduled' | 'converted' | 'lost' | 'nurturing';
    interest?: string;
    notes?: string;
    last_contacted_at?: string;
    converted_client_id?: string;
    converted_at?: string;
    lost_reason?: string;
    created_at: string;
    updated_at?: string;
}

export interface Campaign {
    id: string;
    business_id: string;
    name: string;
    type?: 'reactivation' | 'nurture' | 'review_request' | 'promotion' | 'birthday' | 'appointment_reminder';
    status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
    channel?: 'sms' | 'email' | 'both';
    message_template?: string;
    subject_line?: string;
    target_criteria?: Record<string, unknown>;
    scheduled_at?: string;
    started_at?: string;
    completed_at?: string;
    target_count: number;
    sent_count: number;
    delivered_count?: number;
    opened_count?: number;
    clicked_count?: number;
    replied_count: number;
    converted_count?: number;
    created_at: string;
    updated_at?: string;
}

export interface Message {
    id: string;
    business_id: string;
    client_id?: string;
    lead_id?: string;
    campaign_id?: string;
    channel: 'sms' | 'email';
    direction: 'inbound' | 'outbound';
    message_type?: string;
    from_number?: string;
    to_number?: string;
    from_email?: string;
    to_email?: string;
    subject?: string;
    content: string;
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'replied';
    external_id?: string;
    error_message?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    sent_at?: string;
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    replied_at?: string;
    created_at: string;
    // Joined relations
    clients?: Client;
}

export interface CallLog {
    id: string;
    business_id: string;
    client_id?: string;
    lead_id?: string;
    caller_phone?: string;
    vapi_call_id?: string;
    direction?: 'inbound' | 'outbound';
    duration_seconds: number;
    outcome?: 'booked' | 'callback_requested' | 'info_only' | 'dropped' | 'voicemail' | 'transferred' | 'no_answer';
    summary?: string;
    transcript?: Record<string, unknown>[];
    recording_url?: string;
    appointment_id?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    tags?: string[];
    created_at: string;
    // Joined relations
    clients?: Client;
}

export interface FollowUp {
    id: string;
    business_id: string;
    client_id: string;
    appointment_id?: string;
    type: 'post_treatment' | 'booking_reminder' | 'reactivation' | 'review_request' | 'birthday' | 'custom';
    status: 'pending' | 'scheduled' | 'sent' | 'completed' | 'skipped' | 'failed';
    channel?: 'sms' | 'email' | 'call';
    message_template?: string;
    scheduled_for: string;
    sent_at?: string;
    completed_at?: string;
    result?: string;
    notes?: string;
    created_at: string;
    updated_at?: string;
    // Joined relations
    clients?: Client;
    appointments?: Appointment;
}

export interface Review {
    id: string;
    business_id: string;
    client_id?: string;
    appointment_id?: string;
    platform?: 'google' | 'yelp' | 'facebook' | 'healthgrades' | 'internal';
    status: 'pending' | 'request_sent' | 'clicked' | 'reviewed' | 'declined';
    rating?: number;
    content?: string;
    review_url?: string;
    request_sent_at?: string;
    clicked_at?: string;
    reviewed_at?: string;
    created_at: string;
    // Joined relations
    clients?: Client;
}

export interface WebhookLog {
    id: string;
    business_id: string;
    source: string;
    event_type: string;
    payload?: Record<string, unknown>;
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message?: string;
    processed_at?: string;
    created_at: string;
}

export interface TreatmentTemplate {
    id: string;
    business_id: string;
    name: string;
    category?: string;
    default_duration_minutes?: number;
    default_price?: number;
    follow_up_sequence?: Record<string, unknown>[];
    review_request_delay_hours?: number;
    is_active?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface Settings {
    id: string;
    business_id: string;
    notification_email?: string;
    notification_sms?: boolean;
    notification_email_enabled?: boolean;
    review_request_enabled?: boolean;
    review_request_delay_hours?: number;
    review_platforms?: string[];
    follow_up_enabled?: boolean;
    reactivation_enabled?: boolean;
    reactivation_days_inactive?: number;
    ai_phone_enabled?: boolean;
    ai_response_style?: string;
    crm_provider?: string;
    crm_webhook_url?: string;
    crm_api_key?: string;
    created_at: string;
    updated_at?: string;
}
