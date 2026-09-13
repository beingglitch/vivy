'use client';

import { PERIOD_UNITS, type PeriodUnit } from '@/lib/period';

/**
 * An amount plus a unit, rather than a day count.
 *
 * "3 months" added to 31 January is 30 April, not 91 days later. Keeping the
 * intent instead of flattening it to days is what lets the expiry be computed
 * with real calendar arithmetic.
 */
export function PeriodPicker({
  amount,
  unit,
  onAmount,
  onUnit,
  label = 'Access period',
  idPrefix,
}: {
  amount: number;
  unit: PeriodUnit;
  onAmount: (n: number) => void;
  onUnit: (u: PeriodUnit) => void;
  label?: string;
  idPrefix: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={`${idPrefix}-amount`}>
        {label}
      </label>
      <div className="period">
        <input
          id={`${idPrefix}-amount`}
          type="number"
          className="field__input period__amount"
          min={1}
          max={60}
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
        />
        <select
          id={`${idPrefix}-unit`}
          className="field__input period__unit"
          value={unit}
          aria-label="Unit"
          onChange={(e) => onUnit(e.target.value as PeriodUnit)}
        >
          {PERIOD_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
              {amount === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
