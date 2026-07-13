import { NextResponse } from 'next/server';
import { generateDailyMinute } from '@/lib/daily-minute';

export const maxDuration = 60;

// Manual trigger (the daily cron calls the same function).
export async function POST() {
  const result = await generateDailyMinute();
  return NextResponse.json(result);
}
