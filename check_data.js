const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tsvuzkdrtquzuseaezjk.supabase.co',
  'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8'
);

async function main() {
  // Check call_logs
  console.log('=== CALL LOGS ===');
  const { data: calls, error: callError } = await supabase
    .from('call_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (callError) {
    console.error('Error:', callError);
  } else {
    console.log('Total calls:', calls.length);
    calls.forEach(c => {
      console.log(`- ${c.id}: ${c.caller_phone} | ${c.outcome} | ${c.created_at}`);
    });
  }

  // Check messages
  console.log('\n=== MESSAGES ===');
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgError) {
    console.error('Error:', msgError);
  } else {
    console.log('Total messages:', messages.length);
    messages.forEach(m => {
      console.log(`- ${m.id}: ${m.direction} | ${m.status} | ${m.created_at}`);
    });
  }

  // Check businesses
  console.log('\n=== BUSINESSES ===');
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, vapi_phone_number');

  if (bizError) {
    console.error('Error:', bizError);
  } else {
    businesses.forEach(b => {
      console.log(`- ${b.name}: vapi_phone=${b.vapi_phone_number}`);
    });
  }
}

main().catch(console.error);
