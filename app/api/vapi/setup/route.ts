import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// Configure VAPI for a business
export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();

    // Get VAPI credentials from environment
    const vapiConfig = {
      vapi_api_key: process.env.VAPI_API_KEY,
      vapi_assistant_id: process.env.VAPI_ASSISTANT_ID,
      vapi_phone_number: process.env.VAPI_PHONE_NUMBER,
      vapi_phone_number_id: process.env.VAPI_PHONE_NUMBER_ID,
    };

    if (!vapiConfig.vapi_api_key || !vapiConfig.vapi_assistant_id) {
      return NextResponse.json(
        { error: 'VAPI credentials not configured in environment' },
        { status: 400 }
      );
    }

    // Find business to update
    let targetBusinessId = businessId;
    if (!targetBusinessId) {
      // Get first/default business
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      targetBusinessId = business?.id;
    }

    if (!targetBusinessId) {
      return NextResponse.json(
        { error: 'No business found to configure' },
        { status: 404 }
      );
    }

    // Update business with VAPI configuration
    // Using only columns from the base schema (001_create_tables.sql)
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        vapi_assistant_id: vapiConfig.vapi_assistant_id,
        vapi_phone_number: vapiConfig.vapi_phone_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetBusinessId);

    if (updateError) {
      console.error('[VAPI Setup] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update business', details: updateError.message },
        { status: 500 }
      );
    }

    // Verify the update
    const { data: updatedBusiness } = await supabase
      .from('businesses')
      .select('id, name, vapi_assistant_id, vapi_phone_number')
      .eq('id', targetBusinessId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'VAPI configured successfully',
      business: updatedBusiness,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/vapi/webhook`,
      instructions: [
        '1. Go to VAPI Dashboard → Your Assistant → Settings',
        '2. Under "Server URL", paste the webhook URL above',
        '3. Enable all event types: call-start, call-end, transcript, function-call',
        '4. Save changes',
        '5. Make a test call to the VAPI phone number',
      ],
    });
  } catch (error) {
    console.error('[VAPI Setup] Error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Check VAPI configuration status
export async function GET() {
  try {
    // Check environment variables
    const envStatus = {
      vapi_api_key: !!process.env.VAPI_API_KEY,
      vapi_assistant_id: !!process.env.VAPI_ASSISTANT_ID,
      vapi_phone_number: process.env.VAPI_PHONE_NUMBER || null,
      vapi_phone_number_id: !!process.env.VAPI_PHONE_NUMBER_ID,
    };

    // Get business configuration
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, vapi_assistant_id, vapi_phone_number')
      .limit(1)
      .single();

    // Get call statistics
    const { count: totalCalls } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true });

    const { count: todayCalls } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    const { data: recentCalls } = await supabase
      .from('call_logs')
      .select('id, caller_phone, outcome, duration_seconds, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: 'ok',
      environment: envStatus,
      business: business ? {
        id: business.id,
        name: business.name,
        vapi_configured: !!(business.vapi_assistant_id && business.vapi_phone_number),
        phone_number: business.vapi_phone_number,
      } : null,
      statistics: {
        total_calls: totalCalls || 0,
        calls_today: todayCalls || 0,
      },
      recent_calls: recentCalls || [],
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/vapi/webhook`,
    });
  } catch (error) {
    console.error('[VAPI Status] Error:', error);
    return NextResponse.json(
      { error: 'Status check failed', details: String(error) },
      { status: 500 }
    );
  }
}
