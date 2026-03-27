const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tsvuzkdrtquzuseaezjk.supabase.co',
  'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8'
);

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

async function main() {
  console.log('Setting up clients and campaigns for demo...\n');

  // 1. Add dormant clients for Phoenix reactivation
  const dormantClients = [
    { first_name: 'Sarah', last_name: 'Johnson', phone: '+15551001001', email: 'sarah.j@email.com', last_visit_days_ago: 75 },
    { first_name: 'Emily', last_name: 'Chen', phone: '+15551001002', email: 'emily.c@email.com', last_visit_days_ago: 90 },
    { first_name: 'Jessica', last_name: 'Williams', phone: '+15551001003', email: 'jessica.w@email.com', last_visit_days_ago: 120 },
    { first_name: 'Amanda', last_name: 'Davis', phone: '+15551001004', email: 'amanda.d@email.com', last_visit_days_ago: 65 },
    { first_name: 'Michelle', last_name: 'Garcia', phone: '+15551001005', email: 'michelle.g@email.com', last_visit_days_ago: 100 },
  ];

  console.log('Adding dormant clients...');
  for (const client of dormantClients) {
    const { data, error } = await supabase
      .from('clients')
      .upsert({
        business_id: BUSINESS_ID,
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone,
        email: client.email,
        status: 'inactive',
        created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
      }, { onConflict: 'phone' })
      .select();

    if (error) {
      console.log(`  Error adding ${client.first_name}: ${error.message}`);
    } else {
      console.log(`  ✓ Added ${client.first_name} ${client.last_name} (${client.last_visit_days_ago} days dormant)`);
    }
  }

  // 2. Create Phoenix Reactivation Campaign
  console.log('\nCreating Phoenix Reactivation campaign...');
  const { data: phoenixCampaign, error: phoenixError } = await supabase
    .from('campaigns')
    .upsert({
      business_id: BUSINESS_ID,
      name: 'Phoenix Reactivation - February',
      type: 'reactivation',
      status: 'active',
      channel: 'sms',
      target_criteria: { days_inactive: 60, max_contacts: 50 },
      message_template: "Hi {first_name}! It's been a while since we've seen you at Scale with Jak. We miss you! Enjoy 15% off your next treatment. Reply YES to book!",
      scheduled_at: new Date().toISOString(),
    }, { onConflict: 'name' })
    .select();

  if (phoenixError) {
    console.log(`  Error: ${phoenixError.message}`);
  } else {
    console.log(`  ✓ Phoenix campaign created: ${phoenixCampaign[0]?.id}`);
  }

  // 3. Create Star Review Request Campaign
  console.log('\nCreating Star Review Request campaign...');
  const { data: starCampaign, error: starError } = await supabase
    .from('campaigns')
    .upsert({
      business_id: BUSINESS_ID,
      name: 'Star Review Requests - Ongoing',
      type: 'review_request',
      status: 'active',
      channel: 'sms',
      target_criteria: { post_appointment: true, delay_hours: 24 },
      message_template: "Hi {first_name}! Thank you for visiting Scale with Jak today. We hope you loved your treatment! Would you take 30 seconds to leave us a review? {review_link}",
      scheduled_at: new Date().toISOString(),
    }, { onConflict: 'name' })
    .select();

  if (starError) {
    console.log(`  Error: ${starError.message}`);
  } else {
    console.log(`  ✓ Star campaign created: ${starCampaign[0]?.id}`);
  }

  // 4. Add some sample Phoenix outreach messages (already sent)
  console.log('\nAdding sample Phoenix SMS messages...');
  const phoenixMessages = [
    { to: '+15551001001', name: 'Sarah', status: 'delivered', response: 'YES! Book me in for next week please!' },
    { to: '+15551001002', name: 'Emily', status: 'delivered', response: null },
    { to: '+15551001003', name: 'Jessica', status: 'sent', response: null },
  ];

  for (const msg of phoenixMessages) {
    // Outbound message
    await supabase.from('messages').insert({
      business_id: BUSINESS_ID,
      channel: 'sms',
      direction: 'outbound',
      message_type: 'reactivation',
      to_number: msg.to,
      content: `Hi ${msg.name}! It's been a while since we've seen you at Scale with Jak. We miss you! Enjoy 15% off your next treatment. Reply YES to book!`,
      status: msg.status,
      sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });

    // Inbound response if exists
    if (msg.response) {
      await supabase.from('messages').insert({
        business_id: BUSINESS_ID,
        channel: 'sms',
        direction: 'inbound',
        message_type: 'reply',
        from_number: msg.to,
        content: msg.response,
        status: 'delivered',
        delivered_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      });
    }
  }
  console.log('  ✓ Added Phoenix SMS messages');

  // 5. Add sample Star review request messages
  console.log('\nAdding sample Star review request messages...');
  const starMessages = [
    { to: '+15551002001', name: 'Rachel', treatment: 'Botox', status: 'delivered' },
    { to: '+15551002002', name: 'Lauren', treatment: 'Hydrafacial', status: 'delivered' },
  ];

  for (const msg of starMessages) {
    await supabase.from('messages').insert({
      business_id: BUSINESS_ID,
      channel: 'sms',
      direction: 'outbound',
      message_type: 'review_request',
      to_number: msg.to,
      content: `Hi ${msg.name}! Thank you for your ${msg.treatment} today at Scale with Jak. We hope you loved it! Would you take 30 seconds to leave us a review? https://g.page/r/glow-med-spa`,
      status: msg.status,
      sent_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    });
  }
  console.log('  ✓ Added Star review request messages');

  // 6. Update business with Google review link
  console.log('\nUpdating business with Google review link...');
  await supabase
    .from('businesses')
    .update({ google_review_link: 'https://g.page/r/glow-med-spa' })
    .eq('id', BUSINESS_ID);
  console.log('  ✓ Added Google review link');

  console.log('\n✅ Setup complete! Dashboard should now show:');
  console.log('   - Calls page: Voice AI call history');
  console.log('   - Messages page: Phoenix reactivation + Star review SMS');
  console.log('   - Campaigns page: Active Phoenix & Star campaigns');
}

main().catch(console.error);
