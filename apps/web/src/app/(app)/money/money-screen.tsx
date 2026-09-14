'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CheckIcon, PlusIcon } from '@/components/icons';
import {
  ACCOUNT_KINDS,
  MONEY_CATEGORIES,
  type MoneyAccount,
  type MoneyDashboard,
  type MoneyPoint,
  type MoneyTransaction,
} from '@/lib/money-shared';
import {
  addManualMoneyTransaction,
  addMoneyAccount,
  confirmAllTransactions,
  editMoneyAccount,
  reviewTransaction,
  setAccountNetWorth,
} from './actions';

type Sheet = 'add-menu' | 'account' | 'account-detail' | 'transaction' | 'review' | null;
type Range = '1m' | '6m' | '1y' | 'all';
type BarRange = 'daily' | 'monthly' | 'yearly';

export function MoneyScreen({ dashboard }: { dashboard: MoneyDashboard }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [range, setRange] = useState<Range>('6m');
  const [barRange, setBarRange] = useState<BarRange>('daily');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [manualDirection, setManualDirection] = useState<'debit' | 'credit'>('debit');
  const [handled, setHandled] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [, start] = useTransition();
  const points = useMemo(() => pointsForRange(dashboard.points, range), [dashboard.points, range]);
  const pending = dashboard.transactions.filter(
    (transaction) => transaction.reviewStatus === 'pending' && !handled.includes(transaction.id),
  );
  const selectedAccount = dashboard.accounts.find((account) => account.id === selectedAccountId);
  const selectedTransaction = dashboard.transactions.find(
    (transaction) => transaction.id === selectedTransactionId,
  );
  const currentPoint = points.at(-1);
  const firstPoint = points[0];
  const delta =
    currentPoint && firstPoint ? currentPoint.netWorthMinor - firstPoint.netWorthMinor : null;

  function openReview(transactionId?: string) {
    setSelectedTransactionId(
      transactionId ?? pending.find((transaction) => !skipped.includes(transaction.id))?.id ?? null,
    );
    setSheet('review');
  }

  function quickConfirm(transactionId: string) {
    start(async () => {
      const result = await reviewTransaction(transactionId, 'confirm');
      if (result.ok) setHandled((current) => [...current, transactionId]);
    });
  }

  return (
    <div className="screen screen--flush money-screen">
      <section className="money-overview">
        <div className="money-overview__head">
          <div>
            <span className="money-kicker">Net worth</span>
            <strong className="money-networth">
              {dashboard.netWorthMinor === null
                ? 'Nothing connected'
                : formatInr(dashboard.netWorthMinor)}
            </strong>
          </div>
          <button
            type="button"
            className="iconbtn"
            aria-label="Add money item"
            onClick={() => setSheet('add-menu')}
          >
            <PlusIcon size={21} />
          </button>
        </div>
        {delta !== null ? (
          <span className={`money-delta${delta < 0 ? ' money-delta--down' : ''}`}>
            {delta >= 0 ? '+' : ''}
            {formatInr(delta)} in this period
          </span>
        ) : (
          <span className="money-overview__hint">Add an account balance to start the curve.</span>
        )}
        <NetWorthChart points={points} />
        <div className="money-ranges" aria-label="Net worth range">
          {(
            [
              ['1m', '1M'],
              ['6m', '6M'],
              ['1y', '1Y'],
              ['all', 'All'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={range === value ? 'money-pill--on' : ''}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="money-section money-cashflow">
        <div className="money-section__head">
          <h2>Spend &amp; income</h2>
          <div className="money-segments" aria-label="Cash flow range">
            {(['daily', 'monthly', 'yearly'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={barRange === value ? 'money-pill--on' : ''}
                onClick={() => setBarRange(value)}
              >
                {capitalise(value)}
              </button>
            ))}
          </div>
        </div>
        <CashFlowChart points={dashboard.points} range={barRange} />
      </section>

      {pending.length > 0 ? (
        <section className="money-section money-review-list">
          <div className="money-section__head">
            <h2>
              Needs review <span>{pending.length}</span>
            </h2>
            <button
              type="button"
              className="money-link"
              onClick={() =>
                start(async () => {
                  const result = await confirmAllTransactions();
                  if (result.ok) setHandled(pending.map((transaction) => transaction.id));
                })
              }
            >
              Accept all guesses
            </button>
          </div>
          {pending.slice(0, 4).map((transaction) => (
            <button
              type="button"
              className="money-review-row"
              key={transaction.id}
              onClick={() => openReview(transaction.id)}
            >
              <span className="money-review-row__main">
                <strong>{transaction.counterparty ?? 'Bank transaction'}</strong>
                <small>
                  <span className="money-category-chip">
                    {transaction.category ? `${transaction.category}?` : 'No guess'}
                  </span>{' '}
                  {transaction.accountName}
                </small>
              </span>
              <b>{formatSigned(transaction)}</b>
              <span
                className="money-review-row__confirm"
                role="button"
                tabIndex={0}
                aria-label={`Confirm ${transaction.counterparty ?? 'transaction'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  quickConfirm(transaction.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  quickConfirm(transaction.id);
                }}
              >
                <CheckIcon size={14} />
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="money-section money-accounts">
        <div className="money-section__head">
          <h2>Accounts</h2>
          <button
            type="button"
            className="money-link"
            onClick={() => {
              setSelectedAccountId(null);
              setSheet('account');
            }}
          >
            Add
          </button>
        </div>
        {dashboard.accounts.length === 0 ? (
          <button type="button" className="money-empty-action" onClick={() => setSheet('account')}>
            <PlusIcon size={18} /> Add your first account
          </button>
        ) : (
          dashboard.accounts.map((account) => (
            <button
              type="button"
              className="money-account-row"
              key={account.id}
              onClick={() => {
                setSelectedAccountId(account.id);
                setSheet('account-detail');
              }}
            >
              <span>
                <strong>{account.name}</strong>
                <small>
                  {kindLabel(account.kind)}
                  {account.ref ? ` · •${account.ref}` : ''}
                </small>
              </span>
              <b>{formatInr(account.isLiability ? -account.balanceMinor : account.balanceMinor)}</b>
            </button>
          ))
        )}
      </section>

      {dashboard.transactions.length > 0 ? (
        <section className="money-section money-history">
          <div className="money-section__head">
            <h2>Transactions</h2>
          </div>
          {dashboard.transactions.slice(0, 20).map((transaction) => (
            <button
              type="button"
              className="money-history-row"
              key={transaction.id}
              onClick={() => openReview(transaction.id)}
            >
              <span>
                <strong>{transaction.counterparty ?? transaction.category ?? 'Transaction'}</strong>
                <small>
                  {transaction.accountName} · {displayDate(transaction.localDate)}
                </small>
              </span>
              <b className={transaction.direction === 'credit' ? 'money-positive' : ''}>
                {formatSigned(transaction)}
              </b>
            </button>
          ))}
        </section>
      ) : null}

      {sheet === 'add-menu' ? (
        <AddMenu
          onClose={() => setSheet(null)}
          onAccount={() => {
            setSelectedAccountId(null);
            setSheet('account');
          }}
          onTransaction={(direction) => {
            setManualDirection(direction);
            setSheet('transaction');
          }}
        />
      ) : null}
      {sheet === 'account' ? (
        <AccountSheet
          account={selectedAccount}
          onClose={() => {
            if (selectedAccount) setSheet('account-detail');
            else {
              setSheet(null);
              setSelectedAccountId(null);
            }
          }}
        />
      ) : null}
      {sheet === 'account-detail' && selectedAccount ? (
        <AccountDetail
          account={selectedAccount}
          onClose={() => {
            setSheet(null);
            setSelectedAccountId(null);
          }}
          onEdit={() => setSheet('account')}
        />
      ) : null}
      {sheet === 'transaction' ? (
        <TransactionSheet
          accounts={dashboard.accounts}
          initialDirection={manualDirection}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'review' && selectedTransaction ? (
        <ReviewSheet
          key={selectedTransaction.id}
          transaction={selectedTransaction}
          accounts={dashboard.accounts}
          index={Math.max(
            0,
            pending.findIndex((entry) => entry.id === selectedTransaction.id),
          )}
          total={pending.length}
          pending={selectedTransaction.reviewStatus === 'pending'}
          onClose={() => setSheet(null)}
          onHandled={() => {
            setHandled((current) => [...current, selectedTransaction.id]);
            if (selectedTransaction.reviewStatus !== 'pending') {
              setSheet(null);
              return;
            }
            const next = pending.find((entry) => entry.id !== selectedTransaction.id);
            if (next) setSelectedTransactionId(next.id);
            else setSheet(null);
          }}
          onSkip={() => {
            const nextSkipped = [...skipped, selectedTransaction.id];
            setSkipped(nextSkipped);
            const next = pending.find(
              (entry) => entry.id !== selectedTransaction.id && !nextSkipped.includes(entry.id),
            );
            if (next) setSelectedTransactionId(next.id);
            else setSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}

function NetWorthChart({ points }: { points: MoneyPoint[] }) {
  return (
    <MoneyLineChart
      points={points.map((point) => ({ date: point.date, value: point.netWorthMinor }))}
      label="Scrollable net worth chart"
    />
  );
}

function MoneyLineChart({
  points,
  label,
}: {
  points: Array<{ date: string; value: number }>;
  label: string;
}) {
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = chart.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [points]);
  if (points.length === 0) return <div className="money-chart money-chart--empty" />;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = Math.max(340, Math.min(920, points.length * 5));
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 28) + 14,
    y: 120 - ((point.value - min) / Math.max(1, max - min)) * 88,
  }));
  const last = coordinates.at(-1)!;

  return (
    <div ref={chart} className="money-chart" tabIndex={0} aria-label={label}>
      <svg viewBox={`0 0 ${width} 145`} style={{ width }} role="img">
        <path className="money-chart__line" d={smoothPath(coordinates)} />
        <circle className="money-chart__halo" cx={last.x} cy={last.y} r="8" />
        <circle className="money-chart__dot" cx={last.x} cy={last.y} r="4" />
        <text className="money-chart__label" x={Math.max(38, last.x - 25)} y={last.y - 14}>
          {compactInr(values.at(-1) ?? 0)}
        </text>
      </svg>
    </div>
  );
}

function AccountDetail({
  account,
  onClose,
  onEdit,
}: {
  account: MoneyAccount;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [range, setRange] = useState<Range>('6m');
  const [shownInNetWorth, setShownInNetWorth] = useState(account.includeInNetworth);
  const [visibilityPending, startVisibility] = useTransition();
  const points = pointsForRange(account.points, range);
  const values = points.map((point) => point.balanceMinor);
  const first = values[0] ?? account.balanceMinor;
  const change = account.balanceMinor - first;
  const creditLimit = account.creditLimitMinor ?? 0;
  const utilisation =
    creditLimit > 0 ? Math.min(100, Math.round((account.balanceMinor / creditLimit) * 100)) : 0;

  useEffect(() => setShownInNetWorth(account.includeInNetworth), [account.includeInNetworth]);

  function toggleNetWorth() {
    const next = !shownInNetWorth;
    setShownInNetWorth(next);
    startVisibility(async () => {
      const result = await setAccountNetWorth(account.id, next);
      if (!result.ok) setShownInNetWorth(!next);
    });
  }

  return (
    <MoneySheet title={account.name} onClose={onClose}>
      <div className="money-account-detail__head">
        <div>
          <span>
            {account.kind === 'credit-card'
              ? 'Spent / outstanding'
              : account.isLiability
                ? 'Amount owed'
                : 'Balance'}
          </span>
          <strong>{formatInr(account.balanceMinor)}</strong>
          <small className={change > 0 && account.isLiability ? 'money-negative' : ''}>
            {change > 0 ? '+' : ''}
            {formatInr(change)} in this period
          </small>
        </div>
        <button type="button" className="money-link" onClick={onEdit}>
          Edit
        </button>
      </div>
      {account.kind === 'credit-card' && creditLimit > 0 ? (
        <div className="money-credit-limit">
          <div>
            <span>Available {formatInr(Math.max(0, creditLimit - account.balanceMinor))}</span>
            <span>{utilisation}% used</span>
          </div>
          <div className="money-credit-limit__track">
            <span style={{ width: `${utilisation}%` }} />
          </div>
          <small>Maximum limit {formatInr(creditLimit)}</small>
        </div>
      ) : null}
      <div className="money-networth-toggle">
        <div>
          <strong>Show in net worth</strong>
          <span>{shownInNetWorth ? 'Included in totals and pipelines' : 'Hidden from totals'}</span>
        </div>
        <button
          type="button"
          className={`area-switch${shownInNetWorth ? ' area-switch--on' : ''}`}
          disabled={visibilityPending}
          role="switch"
          aria-checked={shownInNetWorth}
          aria-label={`${shownInNetWorth ? 'Hide' : 'Show'} ${account.name} in net worth`}
          onClick={toggleNetWorth}
        >
          <span />
        </button>
      </div>
      <MoneyLineChart
        points={points.map((point) => ({ date: point.date, value: point.balanceMinor }))}
        label={`${account.name} balance history`}
      />
      <div className="money-account-detail__dates">
        <span>{points[0] ? displayDate(points[0].date) : ''}</span>
        <span>{points.at(-1) ? displayDate(points.at(-1)!.date) : ''}</span>
      </div>
      <div className="money-ranges" aria-label="Account history range">
        {(
          [
            ['1m', '1M'],
            ['6m', '6M'],
            ['1y', '1Y'],
            ['all', 'All'],
          ] as const
        ).map(([value, text]) => (
          <button
            type="button"
            key={value}
            className={range === value ? 'money-pill--on' : ''}
            onClick={() => setRange(value)}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="money-account-detail__stats">
        <span>
          Minimum <b>{formatInr(Math.min(...values, account.balanceMinor))}</b>
        </span>
        <span>
          Maximum <b>{formatInr(Math.max(...values, account.balanceMinor))}</b>
        </span>
      </div>
      {account.kind === 'personal-debt' ? (
        <p className="money-account-detail__note">
          Record the outstanding amount on each date. Repayments reduce this liability and increase
          net worth.
        </p>
      ) : null}
    </MoneySheet>
  );
}

function CashFlowChart({ points, range }: { points: MoneyPoint[]; range: BarRange }) {
  const buckets = aggregateCashFlow(points, range);
  const visible = buckets.slice(range === 'daily' ? -14 : range === 'monthly' ? -12 : -8);
  const max = Math.max(1, ...visible.flatMap((bucket) => [bucket.spend, bucket.income]));
  if (visible.every((bucket) => bucket.spend === 0 && bucket.income === 0)) {
    return <p className="money-chart-empty-copy">Transactions will appear here.</p>;
  }
  return (
    <div className="money-bars" aria-label="Spend and income chart">
      {visible.map((bucket) => (
        <div className="money-bars__group" key={bucket.key}>
          <div className="money-bars__columns">
            <span
              className="money-bars__spend"
              style={{ height: `${(bucket.spend / max) * 100}%` }}
            />
            <span
              className="money-bars__income"
              style={{ height: `${(bucket.income / max) * 100}%` }}
            />
          </div>
          <small>{bucket.label}</small>
        </div>
      ))}
    </div>
  );
}

function AddMenu({
  onClose,
  onAccount,
  onTransaction,
}: {
  onClose: () => void;
  onAccount: () => void;
  onTransaction: (direction: 'debit' | 'credit') => void;
}) {
  return (
    <MoneySheet title="Add to Money" onClose={onClose}>
      <div className="money-add-grid">
        <button type="button" onClick={onAccount}>
          <PlusIcon />
          <strong>Account</strong>
          <small>Savings, FD, demat, loan or personal debt</small>
        </button>
        <button type="button" onClick={() => onTransaction('debit')}>
          <span className="money-add-grid__symbol">−</span>
          <strong>Spend</strong>
          <small>Money leaving an account</small>
        </button>
        <button type="button" onClick={() => onTransaction('credit')}>
          <span className="money-add-grid__symbol">+</span>
          <strong>Income</strong>
          <small>Money entering an account</small>
        </button>
      </div>
    </MoneySheet>
  );
}

function AccountSheet({
  account,
  onClose,
}: {
  account: MoneyAccount | undefined;
  onClose: () => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState(account?.kind ?? 'savings');
  const [ref, setRef] = useState(account?.ref ?? '');
  const [balance, setBalance] = useState(account ? String(account.balanceMinor / 100) : '');
  const [creditLimit, setCreditLimit] = useState(
    account?.creditLimitMinor ? String(account.creditLimitMinor / 100) : '',
  );
  const [asOf, setAsOf] = useState(today());
  const [include, setInclude] = useState(account?.includeInNetworth ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    const balanceMinor = amountToMinor(balance);
    if (balanceMinor === null) return setError('Enter a valid balance.');
    const creditLimitMinor = kind === 'credit-card' ? amountToMinor(creditLimit) : null;
    if (kind === 'credit-card' && !creditLimitMinor) {
      return setError('Enter the card maximum limit.');
    }
    start(async () => {
      const result = account
        ? await editMoneyAccount(account.id, {
            name,
            kind,
            ref,
            balanceMinor,
            creditLimitMinor,
            asOf,
            includeInNetworth: include,
          })
        : await addMoneyAccount({
            name,
            kind,
            ref,
            balanceMinor,
            creditLimitMinor,
            asOf,
            includeInNetworth: include,
          });
      if (!result.ok) return setError(result.error);
      onClose();
    });
  }

  return (
    <MoneySheet title={account ? 'Edit account' : 'New account'} onClose={onClose}>
      <label className="money-field">
        <span>Account name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      <label className="money-field">
        <span>Type</span>
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {ACCOUNT_KINDS.map((option) => (
            <option value={option} key={option}>
              {kindLabel(option)}
            </option>
          ))}
        </select>
      </label>
      <label className="money-field">
        <span>Last 4 digits (optional)</span>
        <input value={ref} inputMode="numeric" onChange={(event) => setRef(event.target.value)} />
      </label>
      <div className="money-field-row">
        <label className="money-field">
          <span>
            {kind === 'personal-debt'
              ? 'Amount still owed'
              : kind === 'credit-card'
                ? 'Spent / outstanding'
                : 'Balance'}
          </span>
          <input
            value={balance}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => setBalance(event.target.value)}
          />
        </label>
        {kind === 'credit-card' ? (
          <label className="money-field">
            <span>Maximum limit</span>
            <input
              value={creditLimit}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => setCreditLimit(event.target.value)}
            />
          </label>
        ) : (
          <label className="money-field">
            <span>As of</span>
            <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          </label>
        )}
      </div>
      {kind === 'credit-card' ? (
        <label className="money-field">
          <span>Outstanding as of</span>
          <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </label>
      ) : null}
      {kind === 'personal-debt' ? (
        <p className="money-field-hint">
          Use the person&apos;s name as the account name. This amount is treated as a liability.
        </p>
      ) : null}
      {kind === 'credit-card' ? (
        <p className="money-field-hint">
          Card spending increases outstanding debt. Payments reduce it; only outstanding debt is
          subtracted from net worth.
        </p>
      ) : null}
      <div className="money-networth-toggle">
        <div>
          <strong>Show in net worth</strong>
          <span>{include ? 'Included in totals and pipelines' : 'Hidden from totals'}</span>
        </div>
        <button
          type="button"
          className={`area-switch${include ? ' area-switch--on' : ''}`}
          role="switch"
          aria-checked={include}
          onClick={() => setInclude((current) => !current)}
        >
          <span />
        </button>
      </div>
      {error ? <p className="pair__error">{error}</p> : null}
      <button
        type="button"
        className="btn btn--primary money-sheet__save"
        disabled={pending || !name.trim()}
        onClick={save}
      >
        {pending ? 'Saving…' : account ? 'Save account' : 'Create account'}
      </button>
    </MoneySheet>
  );
}

function TransactionSheet({
  accounts,
  initialDirection,
  onClose,
}: {
  accounts: MoneyAccount[];
  initialDirection: 'debit' | 'credit';
  onClose: () => void;
}) {
  const [direction, setDirection] = useState(initialDirection);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    const amountMinor = amountToMinor(amount);
    if (!accountId) return setError('Add or choose an account first.');
    if (!amountMinor) return setError('Enter an amount greater than zero.');
    start(async () => {
      const result = await addManualMoneyTransaction({
        accountId,
        direction,
        amountMinor,
        localDate: date,
        counterparty,
        category,
      });
      if (!result.ok) return setError(result.error);
      onClose();
    });
  }

  return (
    <MoneySheet title="New transaction" onClose={onClose}>
      <div className="money-direction">
        <button
          type="button"
          className={direction === 'debit' ? 'money-pill--on' : ''}
          onClick={() => setDirection('debit')}
        >
          Spend
        </button>
        <button
          type="button"
          className={direction === 'credit' ? 'money-pill--on' : ''}
          onClick={() => setDirection('credit')}
        >
          Income
        </button>
      </div>
      <label className="money-field money-field--amount">
        <span>Amount</span>
        <span className="money-amount-input">
          ₹
          <input
            value={amount}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            onChange={(event) => setAmount(event.target.value)}
          />
        </span>
      </label>
      <label className="money-field">
        <span>Account</span>
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Choose account</option>
          {accounts.map((account) => (
            <option value={account.id} key={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="money-field">
        <span>{direction === 'debit' ? 'Paid to' : 'Received from'}</span>
        <input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
      </label>
      <label className="money-field">
        <span>Category</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Uncategorised</option>
          {MONEY_CATEGORIES.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="money-field">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      {error ? <p className="pair__error">{error}</p> : null}
      <button
        type="button"
        className="btn btn--primary money-sheet__save"
        disabled={pending}
        onClick={save}
      >
        {pending ? 'Adding…' : `Add ${direction === 'debit' ? 'spend' : 'income'}`}
      </button>
    </MoneySheet>
  );
}

function ReviewSheet({
  transaction,
  accounts,
  index,
  total,
  pending: isPending,
  onClose,
  onHandled,
  onSkip,
}: {
  transaction: MoneyTransaction;
  accounts: MoneyAccount[];
  index: number;
  total: number;
  pending: boolean;
  onClose: () => void;
  onHandled: () => void;
  onSkip: () => void;
}) {
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [amount, setAmount] = useState(String(transaction.amountMinor / 100));
  const [direction, setDirection] = useState<'debit' | 'credit'>(
    transaction.direction === 'credit' ? 'credit' : 'debit',
  );
  const [counterparty, setCounterparty] = useState(transaction.counterparty ?? '');
  const [category, setCategory] = useState(transaction.category ?? '');
  const [error, setError] = useState<string | null>(null);
  const [working, start] = useTransition();

  function save() {
    const amountMinor = amountToMinor(amount);
    if (!amountMinor) return setError('Enter an amount greater than zero.');
    start(async () => {
      const unchanged =
        accountId === transaction.accountId &&
        amountMinor === transaction.amountMinor &&
        direction === transaction.direction &&
        counterparty.trim() === (transaction.counterparty ?? '') &&
        category === (transaction.category ?? '');
      const result = unchanged
        ? await reviewTransaction(transaction.id, 'confirm')
        : await reviewTransaction(transaction.id, 'edit', {
            accountId,
            amountMinor,
            direction,
            counterparty,
            category,
          });
      if (!result.ok) return setError(result.error);
      onHandled();
    });
  }

  return (
    <div className="money-review-page" role="dialog" aria-modal="true">
      <header className="money-review-page__header">
        <strong>Review</strong>
        <span>{isPending && total > 0 ? `${index + 1} of ${total}` : 'Edit transaction'}</span>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </header>
      <div className="money-review-page__body">
        <label className="money-review-amount">
          <span>₹</span>
          <input
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <input
          className="money-review-name"
          value={counterparty}
          placeholder="Transaction name"
          onChange={(event) => setCounterparty(event.target.value)}
        />
        <span className="money-review-meta">
          {transaction.accountName} · {displayDate(transaction.localDate)}
        </span>
        <div className="money-direction money-direction--review">
          <button
            type="button"
            className={direction === 'debit' ? 'money-pill--on' : ''}
            onClick={() => setDirection('debit')}
          >
            Spend
          </button>
          <button
            type="button"
            className={direction === 'credit' ? 'money-pill--on' : ''}
            onClick={() => setDirection('credit')}
          >
            Income
          </button>
        </div>
        <label className="money-field">
          <span>Account</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <span className="money-review-page__label">Category</span>
        <div className="money-category-grid">
          {MONEY_CATEGORIES.map((option) => (
            <button
              type="button"
              key={option}
              className={category === option ? 'money-category-grid__on' : ''}
              onClick={() => setCategory(option)}
            >
              <span /> {option}
            </button>
          ))}
        </div>
        <p className="money-review-source">
          {transaction.imported ? 'Imported from Android' : 'Added manually'} ·{' '}
          {Math.round(transaction.confidence * 100)}% confidence
        </p>
        {error ? <p className="pair__error">{error}</p> : null}
      </div>
      <div className="money-review-page__actions">
        {isPending ? (
          <button type="button" className="btn btn--quiet" onClick={onSkip}>
            Skip
          </button>
        ) : null}
        <button
          type="button"
          className="btn money-review-page__exclude"
          disabled={working}
          onClick={() =>
            start(async () => {
              const result = await reviewTransaction(transaction.id, 'exclude');
              if (!result.ok) return setError(result.error);
              onHandled();
            })
          }
        >
          Not mine
        </button>
        <button type="button" className="btn btn--primary" disabled={working} onClick={save}>
          {working ? 'Saving…' : isPending ? 'Save and next' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function MoneySheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sheet-backdrop">
      <div className="money-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" aria-hidden />
        <div className="money-sheet__head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function pointsForRange<T>(points: T[], range: Range): T[] {
  if (range === 'all') return points;
  const days = range === '1m' ? 30 : range === '6m' ? 183 : 365;
  return points.slice(-days);
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]!;
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0]!.x} ${points[0]!.y}`);
}

function aggregateCashFlow(points: MoneyPoint[], range: BarRange) {
  const buckets = new Map<string, { key: string; label: string; spend: number; income: number }>();
  for (const point of points) {
    const date = new Date(`${point.date}T12:00:00`);
    const key =
      range === 'daily'
        ? point.date
        : range === 'monthly'
          ? point.date.slice(0, 7)
          : point.date.slice(0, 4);
    const label =
      range === 'daily'
        ? date.toLocaleDateString('en-IN', { day: 'numeric' })
        : range === 'monthly'
          ? date.toLocaleDateString('en-IN', { month: 'short' })
          : point.date.slice(2, 4);
    const bucket = buckets.get(key) ?? { key, label, spend: 0, income: 0 };
    bucket.spend += point.spendMinor;
    bucket.income += point.incomeMinor;
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

function amountToMinor(value: string): number | null {
  const match = /^\s*(\d+)(?:\.(\d{0,2}))?\s*$/.exec(value.replace(/,/g, ''));
  if (!match?.[1]) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  const result = rupees * 100 + paise;
  return Number.isSafeInteger(result) ? result : null;
}

function formatInr(minor: number): string {
  const sign = minor < 0 ? '−' : '';
  return `${sign}₹${Math.abs(minor / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function compactInr(minor: number): string {
  const value = Math.abs(minor) / 100;
  const compact =
    value >= 10_000_000
      ? `${(value / 10_000_000).toFixed(1)}Cr`
      : value >= 100_000
        ? `${(value / 100_000).toFixed(1)}L`
        : value.toLocaleString('en-IN');
  return `${minor < 0 ? '−' : ''}₹${compact}`;
}

function formatSigned(transaction: Pick<MoneyTransaction, 'direction' | 'amountMinor'>): string {
  return `${transaction.direction === 'debit' ? '−' : '+'}${formatInr(transaction.amountMinor)}`;
}

function kindLabel(kind: string): string {
  return kind.split('-').map(capitalise).join(' ');
}

function capitalise(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function displayDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}
