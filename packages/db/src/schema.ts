import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Cloud schema.
 *
 * Multi-tenant: every row that belongs to a person carries `userId`, and every
 * query filters on it. There is no shared data except `prices`, which is market
 * data and identical for everyone.
 *
 * Three layers, in dependency order: `rawRecords` is what collectors write and
 * is never mutated; `events` is derived from it and can be dropped and rebuilt;
 * `metricsDaily` is the aggregate every chart reads. The money tables sit beside
 * events because the ledger is small, permanent, and queried differently.
 *
 * `seq` on the append-only tables is the sync cursor. It is a bigserial rather
 * than a timestamp deliberately: clocks on five devices disagree, a sequence
 * does not. It is global rather than per-user, which is fine. a cursor only has
 * to be monotonic, and rows are filtered by `userId` on read.
 */

/**
 * An account holder.
 *
 * The passphrase is stored only as an Argon2id hash. It also derives that user's
 * key for sealed streams on their own device, which is why signup asks for one
 * rather than delegating to an OAuth provider. a third-party token cannot
 * decrypt anything.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    /**
     * Null only between provisioning and the set-passphrase step.
     *
     * An allowlisted email is provisioned on first sign-in, having never been
     * through signup, so the row exists for a moment with no passphrase. The app
     * is gated behind setting one, so a null here means "has signed in once and
     * not finished", never a usable long-lived state.
     */
    passphraseHash: text('passphrase_hash'),
    /** Salt for the login hash. The sealing key uses its own, held on device. */
    authSalt: text('auth_salt'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /**
     * When this account's access runs out. Null means never granted.
     *
     * Expiry does not delete anything. The row, and every event, transaction and
     * rollup attached to it, stays exactly where it is; only the ability to open
     * the app stops. Reactivating is a single write, which is the whole point of
     * not deleting.
     */
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
    /** `active` or `stopped`. Stopped is an admin decision, separate from expiry. */
    status: text('status').notNull().default('active'),
    /**
     * Which sign-in method this account prefers: 'passphrase' or 'email'.
     *
     * Stored per user so the choice follows the account across devices. The
     * login screen cannot read it before knowing who is signing in, so it also
     * lands in a cookie at each successful login purely to pick the default tab.
     */
    preferredLogin: text('preferred_login').notNull().default('passphrase'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)]);

/**
 * Email verification codes, for both signup and passphrase reset.
 *
 * Codes are hashed like every other credential, so a database dump cannot be
 * replayed. `attempts` is what stops a six-digit code from being brute-forced in
 * a few seconds.
 *
 * `purpose` is not cosmetic: without it a code issued to confirm a new signup
 * could be replayed to reset an existing account's passphrase, and the two flows
 * trust their codes for very different things.
 */
export const emailVerifications = pgTable(
  'email_verifications',
  {
    email: text('email').primaryKey(),
    purpose: text('purpose').notNull().default('signup'), // signup | reset
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_verifications_expiry_idx').on(t.expiresAt)]);

/**
 * Invite codes.
 *
 * Signup is closed, so an account needs one of these or an email on the admin
 * allowlist. Only the hash is stored, like every other credential here, a
 * database dump must yield nothing redeemable.
 *
 * `usedCount` vs `maxUses` is compared inside a conditional UPDATE rather than
 * in application code, so two simultaneous signups cannot both spend the last
 * use of the same code.
 */
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey(),
    codeHash: text('code_hash').notNull(),
    createdBy: uuid('created_by').notNull(),
    /** Who the code was minted for. Used to prefill the share, and to remember. */
    recipientEmail: text('recipient_email'),
    label: text('label'),
    /**
     * How long the redeemer gets, as an amount and a unit rather than a day
     * count. "3 months" added to 31 January is not 90 days, and storing the
     * intent lets the expiry be computed with real calendar arithmetic.
     */
    accessAmount: integer('access_amount').notNull().default(3),
    accessUnit: text('access_unit').notNull().default('month'),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invites_code_idx').on(t.codeHash),
    index('invites_creator_idx').on(t.createdBy),
  ]);

/**
 * Every grant of access, in order. The renewal history for an account.
 *
 * Append-only: extending someone writes a new row rather than editing the last
 * one, so "latest cycle" is a query and the whole history stays readable.
 */
export const accessGrants = pgTable(
  'access_grants',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** `invite` when redeemed with a code, `admin` when granted from the console. */
    source: text('source').notNull(),
    inviteId: uuid('invite_id'),
    amount: integer('amount').notNull(),
    unit: text('unit').notNull(),
  },
  (t) => [index('access_grants_user_idx').on(t.userId, t.grantedAt)],
);

/** Who redeemed what. An audit trail, kept even after the code expires. */
export const inviteRedemptions = pgTable(
  'invite_redemptions',
  {
    inviteId: uuid('invite_id').notNull(),
    userId: uuid('user_id').notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.inviteId, t.userId] })]);

/** Browser sessions. Hashed like device tokens, for the same reason. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_expiry_idx').on(t.expiresAt), index('sessions_user_idx').on(t.userId)]);

/**
 * Onboarding progress, one row per user per ingest source.
 *
 * Every step is optional, so the interesting states are the ones that are not
 * "done": `skipped` means don't ask again, `scheduled` means remind me then.
 * Both are recoverable from More > Sources, which is why nothing here is ever
 * deleted.
 */
export const onboardingSteps = pgTable(
  'onboarding_steps',
  {
    userId: uuid('user_id').notNull(),
    sourceId: text('source_id').notNull(),
    status: text('status').notNull().default('pending'), // pending | done | skipped | scheduled
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sourceId] }),
    index('onboarding_scheduled_idx').on(t.scheduledFor),
  ]);

/** Web push endpoints, so a scheduled reminder can reach a closed app. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: uuid('user_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('push_user_idx').on(t.userId)]);

/** A paired device. Tokens are stored hashed - a DB dump must not yield a credential. */
export const devices = pgTable(
  'devices',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    label: text('label').notNull(),
    platform: text('platform').notNull(), // android | linux | chrome | web | macos | ios
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /**
     * What the collector last reported running. Null until a build new enough
     * to send it checks in, which is why the UI treats null as "unknown"
     * rather than "out of date".
     */
    appVersionCode: integer('app_version_code'),
    appVersionName: text('app_version_name'),
  },
  (t) => [
    uniqueIndex('devices_token_hash_idx').on(t.tokenHash),
    index('devices_user_idx').on(t.userId),
  ]);

export const rawRecords = pgTable(
  'raw_records',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    source: text('source').notNull(),
    deviceId: text('device_id').notNull(),
    /** Verbatim body, or `{ ct, iv }` when sealed. The server never inspects a sealed body. */
    body: jsonb('body').notNull(),
    sealed: boolean('sealed').notNull().default(false),
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Scoped to the user: two people can legitimately produce the same key.
    uniqueIndex('raw_dedupe_idx').on(t.userId, t.dedupeKey),
    index('raw_seq_idx').on(t.userId, t.seq),
    index('raw_source_ts_idx').on(t.userId, t.source, t.ts),
  ]);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    localDate: date('local_date').notNull(),
    tz: text('tz').notNull(),
    type: text('type').notNull(),
    source: text('source').notNull(),
    deviceId: text('device_id').notNull(),
    durationS: integer('duration_s'),
    payload: jsonb('payload').notNull(),
    /** Provenance. Nullable only for events with no raw origin, e.g. a manual correction. */
    rawId: uuid('raw_id'),
    derivedBy: text('derived_by').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
  },
  (t) => [
    uniqueIndex('events_dedupe_idx').on(t.userId, t.dedupeKey),
    index('events_seq_idx').on(t.userId, t.seq),
    // The rollup job's access pattern: one user, one type, a date range.
    index('events_type_date_idx').on(t.userId, t.type, t.localDate),
    index('events_raw_idx').on(t.rawId),
  ]);

/** Accounts, in the accounting sense: anything that holds or owes value. */
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(), // savings | credit-card | fd | demat | wallet | person | loan
    name: text('name').notNull(),
    /** Last four digits or an alias. A full account number is never stored. */
    ref: text('ref'),
    currency: text('currency').notNull().default('INR'),
    isLiability: boolean('is_liability').notNull().default(false),
    includeInNetworth: boolean('include_in_networth').notNull().default(true),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [index('accounts_user_idx').on(t.userId)]);

/** Money that moved. Minor units throughout - see the note in @vivy/core payloads. */
export const txns = pgTable(
  'txns',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    accountId: text('account_id').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    localDate: date('local_date').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('INR'),
    direction: text('direction').notNull(), // debit | credit
    method: text('method').notNull(),
    counterparty: text('counterparty'),
    category: text('category'),
    balanceAfterMinor: integer('balance_after_minor'),
    /** How much the parser trusts this row. Drives reconciliation and review prompts. */
    confidence: real('confidence').notNull().default(1),
    eventId: uuid('event_id'),
    dedupeKey: text('dedupe_key').notNull(),
  },
  (t) => [
    uniqueIndex('txns_dedupe_idx').on(t.userId, t.dedupeKey),
    index('txns_account_date_idx').on(t.userId, t.accountId, t.localDate),
    index('txns_confidence_idx').on(t.userId, t.confidence),
  ]);

/**
 * Authoritative balances. These anchor the ledger; transactions fill between them.
 * When accumulated deltas disagree with the next snapshot, that gap is the drift
 * the reconciler reports rather than silently absorbing.
 */
export const balanceSnapshots = pgTable(
  'balance_snapshots',
  {
    userId: uuid('user_id').notNull(),
    accountId: text('account_id').notNull(),
    asOf: date('as_of').notNull(),
    balanceMinor: integer('balance_minor').notNull(),
    authority: text('authority').notNull(), // statement | broker-api | cas | manual | sms-inferred
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.accountId, t.asOf, t.authority] })]);

export const holdings = pgTable(
  'holdings',
  {
    userId: uuid('user_id').notNull(),
    accountId: text('account_id').notNull(),
    asOf: date('as_of').notNull(),
    symbol: text('symbol').notNull(),
    instrument: text('instrument').notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 6 }).notNull(),
    avgCostMinor: integer('avg_cost_minor'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.accountId, t.asOf, t.symbol] })]);

/**
 * Daily closing prices. NSE bhavcopy for equities, AMFI for mutual fund NAVs.
 *
 * The one table with no `userId`: a closing price is the same fact for everyone,
 * and duplicating it per user would be storage spent on nothing.
 */
export const prices = pgTable(
  'prices',
  {
    symbol: text('symbol').notNull(),
    onDate: date('on_date').notNull(),
    closeMinor: integer('close_minor').notNull(),
    sourceName: text('source_name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.onDate] })]);

/**
 * The aggregate every chart reads.
 *
 * Small enough that every device keeps all of it for all time, which is what
 * makes the year grid work offline across full history. Rebuilt by the nightly
 * rollup, so it is always safe to delete and recompute.
 */
export const metricsDaily = pgTable(
  'metrics_daily',
  {
    userId: uuid('user_id').notNull(),
    localDate: date('local_date').notNull(),
    stream: text('stream').notNull(),
    value: real('value').notNull(),
    meta: jsonb('meta').notNull().default({}),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.localDate, t.stream] }),
    index('metrics_stream_idx').on(t.userId, t.stream),
  ]);

/**
 * What Vivy has already told you.
 *
 * Exists so the nightly brief does not repeat the same nag five mornings
 * running - the assistant reads this before it writes.
 */
export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    localDate: date('local_date').notNull(),
    kind: text('kind').notNull(), // stall | streak | overspend | drift | win
    subject: text('subject').notNull(), // the project, account or stream it is about
    body: text('body').notNull(),
    surfacedAt: timestamp('surfaced_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  },
  (t) => [index('observations_subject_idx').on(t.userId, t.subject, t.localDate)]);

/**
 * Failed authentication attempts, per email.
 *
 * Argon2id makes a single guess expensive, but expensive is not the same as
 * bounded: an attacker with time still gets unlimited tries. This bounds them.
 *
 * Keyed on email rather than IP on purpose. An IP is trivially rotated, and
 * locking by IP would let anyone lock a user out by guessing from their
 * address. Locking the email slows the only thing that matters, which is
 * guesses against one account.
 */
export const authAttempts = pgTable('auth_attempts', {
  email: text('email').primaryKey(),
  failures: integer('failures').notNull().default(0),
  firstFailureAt: timestamp('first_failure_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});
