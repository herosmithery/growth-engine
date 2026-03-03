const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tsvuzkdrtquzuseaezjk.supabase.co',
  'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8'
);

async function main() {
  // Update business with VAPI phone number ID
  const { data, error } = await supabase
    .from('businesses')
    .update({
      vapi_phone_number: 'ce33d019-a0a3-40c5-a850-c473815bd2ed',
      name: 'Glow Med Spa'
    })
    .eq('id', 'ab445992-80fd-46d0-bec0-138a86e1d607')
    .select();

  if (error) {
    console.error('Error updating business:', error);
  } else {
    console.log('Business updated:', data);
  }
}

main().catch(console.error);
