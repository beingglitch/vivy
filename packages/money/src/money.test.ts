import { describe, expect, it } from 'vitest';
import { formatMinor, toMinorUnits } from './sms/amount';
import { isOtp, shouldDrop } from './sms/otp';
import { parseSms } from './sms/parse';
import { materialDrifts, reconcile, type LedgerTxn, type Snapshot } from './ledger/reconcile';

describe('toMinorUnits', () => {
  it('handles Indian lakh grouping', () => {
    expect(toMinorUnits('1,23,456.78')).toBe(12345678);
  });

  it('avoids binary floating-point drift', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754. String maths is not.
    expect(toMinorUnits('19.99')).toBe(1999);
    expect(toMinorUnits('0.01')).toBe(1);
  });

  it('pads a single decimal place', () => {
    expect(toMinorUnits('400.5')).toBe(40050);
  });

  it('rejects anything it cannot read exactly', () => {
    expect(() => toMinorUnits('4oo')).toThrow(TypeError);
    expect(() => toMinorUnits('1.234')).toThrow(TypeError);
  });
});

describe('formatMinor', () => {
  it('renders rupees with Indian grouping', () => {
    expect(formatMinor(12345678)).toBe('₹1,23,456.78');
    expect(formatMinor(-6523150)).toBe('-₹65,231.50');
  });
});

describe('OTP guard (ADR 0003)', () => {
  const otps = [
    '123456 is your OTP for a transaction of Rs 400 at SWIGGY. Do not share with anyone.',
    'Your one-time password is 998811. Valid for 10 minutes.',
    'Use verification code 447281 to authorise Rs 1,200.00 payment.',
  ];

  it.each(otps)('drops: %s', (text) => {
    expect(isOtp(text)).toBe(true);
    expect(parseSms(text)).toEqual({ status: 'dropped', reason: 'otp' });
  });

  it('does not mistake a real debit for an OTP', () => {
    const text = 'Rs.400.00 debited from A/c XX4321 on 05-09-26 to VPA swiggy@ybl. Avl Bal Rs.45,431.00';
    expect(isOtp(text)).toBe(false);
  });

  it('drops notices about money that has not moved yet', () => {
    expect(shouldDrop('Rs 7,649 will be debited on 10-09-26 towards your SIP.')).toBe(
      'non-transactional',
    );
    expect(shouldDrop('Your credit card bill of Rs 1,06,513 is due on 15-09-26.')).toBe(
      'non-transactional',
    );
  });
});

describe('parseSms', () => {
  it('parses an SBI UPI debit and its balance', () => {
    const text =
      'Dear UPI user A/C X4321 debited by 400.0 on date 05Sep26 trf to SWIGGY Refno 123456789012. Avl Bal Rs.45,431.00 -SBI';
    const result = parseSms(text);

    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.templateId).toBe('sbi.upi.debit');
    expect(result.txn.amountMinor).toBe(40000);
    expect(result.txn.direction).toBe('debit');
    expect(result.txn.accountRef).toBe('4321');
    expect(result.txn.counterparty).toBe('SWIGGY');
    expect(result.txn.balanceAfterMinor).toBe(4543100);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('parses a card spend', () => {
    const result = parseSms('Rs.1200.00 spent on HDFC Bank Card x4321 at SWIGGY on 2026-09-05');
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.txn.amountMinor).toBe(120000);
    expect(result.txn.method).toBe('card');
    expect(result.txn.counterparty).toBe('SWIGGY');
  });

  it('strips the PSP handle off a VPA', () => {
    const result = parseSms(
      'Rs.250.00 debited from A/c XX4321 on 05-09-26 to VPA blinkit@ybl. Ref 998877',
    );
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    // `blinkit@ybl` -> `BLINKIT`: the handle names the payment provider, not the shop.
    expect(result.txn.counterparty).toBe('BLINKIT');
    expect(result.txn.method).toBe('upi');
  });

  it('parses a credit', () => {
    const result = parseSms('Rs.5,000.00 credited to your A/c XX4321 on 05-09-26 by NEFT');
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.txn.direction).toBe('credit');
    expect(result.txn.amountMinor).toBe(500000);
  });

  it('falls back with low confidence rather than losing an unknown format', () => {
    const result = parseSms('INR 99 debited towards annual charges. Bal: INR 4,500');
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.templateId).toBe('fallback.heuristic');
    // Low enough that the reconciler blames this window first.
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('quarantines rather than drops when nothing matches', () => {
    const result = parseSms('Your parcel has been dispatched and arrives Tuesday.');
    expect(result.status).toBe('unmatched');
  });
});

describe('reconcile', () => {
  const txn = (id: string, date: string, amount: number, dir: 'debit' | 'credit', conf = 0.95) =>
    ({
      id,
      accountId: 'sbi',
      localDate: date,
      amountMinor: amount,
      direction: dir,
      confidence: conf,
    }) satisfies LedgerTxn;

  const snapshots: Snapshot[] = [
    { accountId: 'sbi', asOf: '2026-08-31', balanceMinor: 5000000, authority: 'statement' },
    { accountId: 'sbi', asOf: '2026-09-30', balanceMinor: 4500000, authority: 'statement' },
  ];

  it('reports zero drift when every transaction was captured', () => {
    const txns = [
      txn('a', '2026-09-05', 400000, 'debit'),
      txn('b', '2026-09-12', 200000, 'debit'),
      txn('c', '2026-09-20', 100000, 'credit'),
    ];
    const [drift] = reconcile(txns, snapshots);
    expect(drift?.observedDeltaMinor).toBe(-500000);
    expect(drift?.expectedDeltaMinor).toBe(-500000);
    expect(drift?.driftMinor).toBe(0);
  });

  it('surfaces the gap when an SMS was missed', () => {
    const txns = [txn('a', '2026-09-05', 400000, 'debit')]; // the ₹2,000 debit never arrived
    const [drift] = reconcile(txns, snapshots);
    expect(drift?.driftMinor).toBe(-100000);
    expect(materialDrifts([drift!])).toHaveLength(1);
  });

  it('ignores drift below a rupee', () => {
    const txns = [txn('a', '2026-09-05', 499950, 'debit')];
    const [drift] = reconcile(txns, snapshots);
    expect(materialDrifts([drift!])).toHaveLength(0);
  });

  it('points at the least trustworthy parse in the window', () => {
    const txns = [txn('a', '2026-09-05', 400000, 'debit', 0.95), txn('b', '2026-09-12', 100000, 'debit', 0.45)];
    const [drift] = reconcile(txns, snapshots);
    expect(drift?.weakestConfidence).toBe(0.45);
  });

  it('will not anchor a window on an SMS-inferred balance', () => {
    const guessed: Snapshot[] = [
      { accountId: 'sbi', asOf: '2026-08-31', balanceMinor: 5000000, authority: 'sms-inferred' },
      { accountId: 'sbi', asOf: '2026-09-30', balanceMinor: 4500000, authority: 'sms-inferred' },
    ];
    expect(reconcile([], guessed)).toHaveLength(0);
  });

  it('excludes transactions dated on the opening snapshot', () => {
    // A debit on the opening date is already inside that balance.
    const txns = [txn('a', '2026-08-31', 999999, 'debit'), txn('b', '2026-09-05', 500000, 'debit')];
    const [drift] = reconcile(txns, snapshots);
    expect(drift?.txnCount).toBe(1);
    expect(drift?.driftMinor).toBe(0);
  });
});
