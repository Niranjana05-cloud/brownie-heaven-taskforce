import { NextResponse } from 'next/server';
import supabaseStock from '../../../lib/supabaseStock';

export async function GET() {
  const { data, error } = await supabaseStock
    .from('outlet_supply_ledger')
    .select('*')
    .limit(5);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, rowCount: data?.length ?? 0, sample: data });
}
