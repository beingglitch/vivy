import type { StreamKey } from './streams';

/**
 * The ingest source registry.
 *
 * One definition, three consumers: onboarding walks it, the More > Sources hub
 * lists it, and the status page checks it. Adding a collector means adding an
 * entry here, the setup instructions and the "what this unlocks" copy travel
 * with it rather than being written twice and drifting apart.
 *
 * `unlocks` is the honest part. Every source names the streams it feeds and the
 * ones it cannot, so skipping something has a visible, specific cost rather than
 * a vague sense of missing out.
 */

export type SourcePlatform = 'desktop' | 'android' | 'ios' | 'linux' | 'server';
export type SourceAvailability = 'available' | 'planned';

export interface SetupStep {
  readonly title: string;
  readonly detail: string;
  /** A command to run, shown in a copyable block. */
  readonly command?: string;
  /** Where to get the thing this step needs. */
  readonly link?: { readonly label: string; readonly href: string };
}

export interface IngestSource {
  readonly id: string;
  readonly name: string;
  readonly platform: SourcePlatform;
  readonly availability: SourceAvailability;
  /** One line, in the user's terms, on what it watches. */
  readonly summary: string;
  /** Streams this source feeds. */
  readonly unlocks: readonly StreamKey[];
  /** Plain-language capabilities, for onboarding copy. */
  readonly gives: readonly string[];
  /** What stays missing without it. Shown when someone skips. */
  readonly withoutIt: string;
  /** Roughly how long setup takes, so "later" is an informed choice. */
  readonly minutes: number;
  /** Permissions or accounts the user must grant. Named plainly. */
  readonly requires: readonly string[];
  /** The most invasive thing this source can see, stated up front. */
  readonly seesNote?: string;
  readonly steps: readonly SetupStep[];
}

export const SOURCES: readonly IngestSource[] = [
  {
    id: 'chrome',
    name: 'Chrome extension',
    platform: 'desktop',
    availability: 'available',
    summary: 'What you browse and watch on this computer.',
    unlocks: ['screen.social', 'media.watch.total', 'media.watch.learning'],
    gives: [
      'Time per website, measured while the tab is actually in front',
      'Every YouTube video you watch, with its title and channel',
      'Instagram and X sessions',
    ],
    withoutIt: 'No desktop browsing or YouTube history. This is the only reliable source for either.',
    minutes: 5,
    requires: ['Chrome on this machine'],
    steps: [
      {
        title: 'Build the extension',
        detail: 'Produces a loadable folder at apps/extension/dist.',
        command: 'pnpm --filter @vivy/extension build',
      },
      {
        title: 'Load it in Chrome',
        detail:
          'Open chrome://extensions, turn on Developer mode, choose "Load unpacked", and pick apps/extension/dist.',
        link: { label: 'chrome://extensions', href: 'chrome://extensions' },
      },
      {
        title: 'Pair it',
        detail:
          'Open the extension\'s options page and paste the endpoint, a device id, and the token below. The token is shown once.',
      },
    ],
  },
  {
    id: 'android',
    name: 'Android app',
    platform: 'android',
    availability: 'available',
    summary: 'Screen time and money from bank SMS.',
    unlocks: ['screen.total', 'screen.social', 'money.spend'],
    gives: [
      'Per-app screen time, the number no website can read',
      'Every UPI payment and card swipe, from bank SMS, in real time',
      'Your running balance, which most Indian banks put in the same message',
    ],
    withoutIt:
      'No phone screen time, and no automatic spending. Money would be manual entry or monthly statements only.',
    minutes: 5,
    requires: [
      'Usage access (Settings, Special app access)',
      'SMS read permission, if you want money tracked',
    ],
    seesNote:
      'Per-app foreground time, and the text of messages that contain both an amount and a transaction word. One-time codes are dropped before anything is stored. Nothing else on the phone is read: there is no accessibility capture in this build.',
    steps: [
      {
        title: 'Install the app',
        detail:
          'Sideloaded, not from the Play Store. Play forbids SMS reading for apps like this. Download the APK, open it, and allow installing from your browser when asked.',
      },
      {
        title: 'Pair it',
        detail:
          'Generate a token below and type the three values into the app. The token is shown once.',
      },
      {
        title: 'Grant usage access',
        detail:
          'Tap "Turn on" next to App screen time. It opens the system screen: find Vivy in the list and allow it.',
      },
      {
        title: 'Grant messages, or not',
        detail:
          'Only needed for spending. Skip it and everything else still works, you just enter money by hand.',
      },
    ],
  },
  {
    id: 'linux',
    name: 'Desktop tracker',
    platform: 'linux',
    availability: 'planned',
    summary: 'Which app is in front on your laptop, and when you are idle.',
    unlocks: ['screen.total'],
    gives: [
      'Time per desktop application',
      'Idle detection, so a tab left open overnight is not counted as attention',
    ],
    withoutIt: 'Desktop time outside the browser is invisible, editors, terminals, design tools.',
    minutes: 10,
    requires: ['ActivityWatch running locally'],
    steps: [
      {
        title: 'Install ActivityWatch',
        detail: 'It already solves window tracking and idle detection, and exposes a local API on port 5600.',
        link: { label: 'activitywatch.net', href: 'https://activitywatch.net/downloads/' },
      },
      {
        title: 'Run the bridge',
        detail: 'Reads ActivityWatch buckets and forwards them to Vivy.',
        command: 'pnpm --filter @vivy/daemon start',
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Email statements',
    platform: 'server',
    availability: 'planned',
    summary: 'Monthly bank and card statements, and your investment CAS.',
    unlocks: ['money.spend', 'money.networth'],
    gives: [
      'Authoritative monthly balances that correct any transaction the SMS parser missed',
      'Credit card outstanding from the statement itself',
      'Every share and mutual fund you own, from the CDSL/NSDL statement',
    ],
    withoutIt:
      'Spending still works from SMS, but nothing corrects it, small errors accumulate with nothing to catch them.',
    minutes: 5,
    requires: ['Read-only access to your Gmail'],
    seesNote: 'Scoped to searching for statement emails. Vivy never sends mail and never reads unrelated threads.',
    steps: [
      { title: 'Connect Gmail', detail: 'Read-only, revocable from your Google account at any time.' },
      {
        title: 'Add statement passwords',
        detail:
          'Statement PDFs are usually locked with a date-of-birth or PAN pattern. These go in your system keychain, never the database.',
      },
    ],
  },
  {
    id: 'kite',
    name: 'Zerodha holdings',
    platform: 'server',
    availability: 'planned',
    summary: 'What shares you own, valued daily.',
    unlocks: ['money.networth'],
    gives: [
      'Your holdings and positions, read-only',
      'Daily portfolio value using free end-of-day prices from the NSE',
    ],
    withoutIt: 'Investments would be manual, fine if they rarely change, wrong if you trade.',
    minutes: 5,
    requires: ['A Zerodha account and a Kite Connect API key'],
    seesNote:
      'Holdings and positions only. Vivy has no order-placing code, so a leaked key cannot trade.',
    steps: [
      {
        title: 'Create an API key',
        detail: 'Holdings and positions are free; only live market data is billed.',
        link: { label: 'kite.trade', href: 'https://kite.trade/' },
      },
      { title: 'Paste the key', detail: 'Stored server-side, used once a day.' },
    ],
  },
  {
    id: 'social',
    name: 'Your own posts',
    platform: 'server',
    availability: 'planned',
    summary: 'What you published on YouTube, Instagram and X.',
    unlocks: ['social.posts'],
    gives: ['Your uploads and posts, counted per day', 'Views and likes where the platform exposes them'],
    withoutIt: 'The "posts shipped" stream stays empty.',
    minutes: 10,
    requires: ['A Google account for YouTube', 'An Instagram Business or Creator account'],
    seesNote:
      'Instagram only exposes this to Business or Creator accounts. A personal account cannot use the official API.',
    steps: [
      { title: 'Connect YouTube', detail: 'Read-only access to your own uploads.' },
      {
        title: 'Connect Instagram',
        detail: 'Requires switching your account to Creator, which is free and reversible.',
      },
      { title: 'X', detail: 'Read access is paid, so this falls back to reading your own profile page.' },
    ],
  },
  {
    id: 'ios',
    name: 'iPhone',
    platform: 'ios',
    availability: 'planned',
    summary: 'Limited by what Apple allows, much less than Android.',
    unlocks: [],
    gives: ['Manual capture and voice notes'],
    withoutIt: '',
    minutes: 5,
    requires: ['iOS 17 or later'],
    seesNote:
      "Apple's Screen Time data cannot leave its sandbox, and iOS has no SMS access at all. If you switch phones, the Pixel stays the money collector.",
    steps: [{ title: 'Not yet available', detail: 'Arrives after the Android app.' }],
  },
] as const;

export function sourceById(id: string): IngestSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Sources worth offering during first-run, most valuable first. */
export const ONBOARDING_ORDER = ['chrome', 'android', 'linux', 'gmail', 'kite', 'social'] as const;
