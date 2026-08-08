import { NextResponse } from 'next/server';
import { getOutletMargins } from '../../../lib/marginCalc';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? '2026-06';

  try {
    const margins = await getOutletMargins(month);
    return NextResponse.json({ success: true, month, margins });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
