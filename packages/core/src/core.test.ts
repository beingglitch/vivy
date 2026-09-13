import { describe, expect, it } from 'vitest';
import { dedupeKey } from './ids';
import { dateRange, localDateOf } from './time';
import { VivyEvent } from './events/index';
import { PushRequest } from './sync/protocol';
import { shouldSeal } from './raw';

describe('dedupeKey', () => {
  it('is stable for the same observation', () => {
    const a = dedupeKey('chrome.youtube', 'dQw4w9WgXcQ', 1757030400);
    const b = dedupeKey('chrome.youtube', 'dQw4w9WgXcQ', 1757030400);
    expect(a).toBe(b);
  });

  it('separates different observations', () => {
    const a = dedupeKey('chrome.youtube', 'dQw4w9WgXcQ', 1757030400);
    const b = dedupeKey('chrome.youtube', 'dQw4w9WgXcQ', 1757030401);
    expect(a).not.toBe(b);
  });

  it('stays bounded for long inputs', () => {
    const key = dedupeKey('android.a11y', 'x'.repeat(5000));
    expect(key.length).toBeLessThanOrEqual(256);
  });
});

describe('localDateOf', () => {
  it('uses the local day, not the UTC day', () => {
    // 01:30 IST on 5 Sep is still 20:00 UTC on 4 Sep. The day it *felt* like wins.
    const lateNight = '2026-09-04T20:00:00Z';
    expect(localDateOf(lateNight, 'Asia/Kolkata')).toBe('2026-09-05');
    expect(localDateOf(lateNight, 'UTC')).toBe('2026-09-04');
  });

  it('rejects an unparseable timestamp', () => {
    expect(() => localDateOf('not-a-date', 'Asia/Kolkata')).toThrow(TypeError);
  });
});

describe('dateRange', () => {
  it('is inclusive at both ends', () => {
    expect(dateRange('2026-09-01', '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('handles a month boundary', () => {
    expect(dateRange('2026-08-31', '2026-09-01')).toEqual(['2026-08-31', '2026-09-01']);
  });
});

describe('VivyEvent', () => {
  const envelope = {
    id: '2f1c8b3e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
    ts: '2026-09-05T09:30:00.000Z',
    localDate: '2026-09-05',
    tz: 'Asia/Kolkata',
    deviceId: 'pixel-8',
    derivedBy: 'test@v1',
    dedupeKey: dedupeKey('android.sms', 'SBI', '2026-09-05T09:30:00Z', 40000),
  };

  it('accepts a money transaction in minor units', () => {
    const parsed = VivyEvent.parse({
      ...envelope,
      source: 'android.sms',
      type: 'money.txn',
      payload: {
        accountRef: '4321',
        amountMinor: 40000, // Rs 400.00
        direction: 'debit',
        method: 'upi',
        counterparty: 'SWIGGY',
        confidence: 0.92,
      },
    });
    expect(parsed.type).toBe('money.txn');
    if (parsed.type === 'money.txn') {
      expect(parsed.payload.amountMinor).toBe(40000);
      expect(parsed.payload.currency).toBe('INR');
    }
  });

  it('rejects a fractional amount', () => {
    const result = VivyEvent.safeParse({
      ...envelope,
      source: 'android.sms',
      type: 'money.txn',
      payload: {
        accountRef: '4321',
        amountMinor: 400.5,
        direction: 'debit',
        method: 'upi',
        confidence: 1,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown event type', () => {
    const result = VivyEvent.safeParse({ ...envelope, source: 'manual.chat', type: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('PushRequest', () => {
  it('defaults both collections so a heartbeat is a valid push', () => {
    const parsed = PushRequest.parse({ deviceId: 'pixel-8', sentAt: '2026-09-05T09:30:00.000Z' });
    expect(parsed.raw).toEqual([]);
    expect(parsed.events).toEqual([]);
  });
});

describe('shouldSeal', () => {
  it('seals screen text and SMS, not tab history', () => {
    expect(shouldSeal('android.a11y')).toBe(true);
    expect(shouldSeal('android.sms')).toBe(true);
    expect(shouldSeal('chrome.tabs')).toBe(false);
  });
});
