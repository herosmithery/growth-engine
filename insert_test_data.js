const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tsvuzkdrtquzuseaezjk.supabase.co',
  'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8'
);

async function main() {
  // First get a business ID
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, vapi_phone_number')
    .limit(1);

  if (bizError) {
    console.error('Error fetching businesses:', bizError);
    return;
  }

  console.log('Businesses:', businesses);

  if (!businesses || businesses.length === 0) {
    console.log('No businesses found');
    return;
  }

  const businessId = businesses[0].id;
  console.log('Using business ID:', businessId);

  // Insert test messages
  const messages = [
    {
      business_id: businessId,
      channel: 'sms',
      direction: 'outbound',
      message_type: 'reactivation',
      to_number: '+15551234567',
      content: "Hi Sarah! It's been a while since we've seen you at Scale with Jak. We miss you! Enjoy 15% off your next treatment. Reply YES to book!",
      status: 'sent',
      sent_at: new Date(Date.now() - 2*60*60*1000).toISOString()
    },
    {
      business_id: businessId,
      channel: 'sms',
      direction: 'outbound',
      message_type: 'review_request',
      to_number: '+15559876543',
      content: "Hi Jessica! Thank you for your visit today. We'd love to hear about your experience! Leave us a review: https://g.page/r/abc123",
      status: 'delivered',
      sent_at: new Date(Date.now() - 1*60*60*1000).toISOString(),
      delivered_at: new Date(Date.now() - 59*60*1000).toISOString()
    },
    {
      business_id: businessId,
      channel: 'sms',
      direction: 'outbound',
      message_type: 'confirmation',
      to_number: '+15551112222',
      content: 'Hi Emily! This is a reminder for your Botox appointment tomorrow at 2:00 PM at Scale with Jak. Reply C to confirm or R to reschedule.',
      status: 'delivered',
      sent_at: new Date(Date.now() - 30*60*1000).toISOString(),
      delivered_at: new Date(Date.now() - 29*60*1000).toISOString()
    },
    {
      business_id: businessId,
      channel: 'sms',
      direction: 'inbound',
      message_type: 'reply',
      from_number: '+15551234567',
      content: "YES! I'd love to book. What times do you have available next week?",
      status: 'delivered',
      delivered_at: new Date(Date.now() - 1.75*60*60*1000).toISOString()
    }
  ];

  const { data, error } = await supabase
    .from('messages')
    .insert(messages)
    .select();

  if (error) {
    console.error('Error inserting messages:', error);
  } else {
    console.log('Inserted', data.length, 'messages successfully!');
  }

  // Also insert some call logs
  const calls = [
    {
      business_id: businessId,
      caller_phone: '+15551234567',
      vapi_call_id: 'demo-call-' + Date.now() + '-1',
      duration_seconds: 187,
      outcome: 'booked',
      summary: 'Caller inquired about Botox pricing and availability. Booked appointment for Tuesday at 2pm.',
      transcript: { text: 'Hello, I am interested in getting Botox. What are your prices?...' }
    },
    {
      business_id: businessId,
      caller_phone: '+15559876543',
      vapi_call_id: 'demo-call-' + Date.now() + '-2',
      duration_seconds: 95,
      outcome: 'info_only',
      summary: 'Caller asked about filler options and pricing. Will call back to schedule.'
    },
    {
      business_id: businessId,
      caller_phone: '+15551112222',
      vapi_call_id: 'demo-call-' + Date.now() + '-3',
      duration_seconds: 243,
      outcome: 'callback_requested',
      summary: 'Caller wanted to reschedule existing appointment. Requested callback from staff.'
    }
  ];

  const { data: callData, error: callError } = await supabase
    .from('call_logs')
    .insert(calls)
    .select();

  if (callError) {
    console.error('Error inserting calls:', callError);
  } else {
    console.log('Inserted', callData.length, 'call logs successfully!');
  }
}

main().catch(console.error);
