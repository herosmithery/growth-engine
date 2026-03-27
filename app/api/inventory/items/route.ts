import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .order('category')
      .order('item');

    if (error) throw error;

    // If no items seeded yet, return mock data
    if (!data || data.length === 0) {
      return NextResponse.json({ items: [], seeded: false });
    }

    return NextResponse.json({ items: data, seeded: true });
  } catch (err) {
    console.error('[inventory/items GET] error:', err);
    return NextResponse.json({ items: [], error: String(err) });
  }
}

// POST: Reorder — increment qty by reorder_qty
export async function POST(req: NextRequest) {
  try {
    const { id, action, qty } = await req.json();

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Fetch current item
    const { data: item, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('business_id', BUSINESS_ID)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    let newQty = item.qty;

    if (action === 'reorder') {
      newQty = item.qty + item.reorder_qty;
    } else if (action === 'set' && qty !== undefined) {
      newQty = qty;
    } else if (action === 'decrement' && qty !== undefined) {
      newQty = Math.max(0, item.qty - qty);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('inventory_items')
      .update({
        qty: newQty,
        last_reordered_at: action === 'reorder' ? new Date().toISOString() : item.last_reordered_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, item: updated });
  } catch (err) {
    console.error('[inventory/items POST] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
