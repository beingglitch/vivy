export const TX_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'health',
  'education',
  'startup',
  'other',
] as const;

export const INCOME_CATEGORIES = [
  'salary',
  'freelance',
  'startup',
  'gift',
  'refund',
  'other',
] as const;

export const POSITION_CATEGORIES = {
  asset: ['cash', 'bank', 'investment', 'property', 'other'],
  liability: ['loan', 'credit', 'borrowed', 'other'],
} as const;

// Donut palette: deeper-chroma siblings of the site tokens, validated with the
// dataviz six-checks script against the dark surface (#1c1923) — all pass.
// Mapping is fixed per category (identity-stable); categories without a slot
// fold into "everything else" on the chart (they still show in the list below).
export const CATEGORY_COLORS: Record<string, string> = {
  food: '#cd7a4a',
  transport: '#2698b8',
  shopping: '#8f7fd4',
  bills: '#ab8c33',
  entertainment: '#c05f7c',
  education: '#4e9d6e',
};
export const FOLD_COLOR = '#4a4458'; // "everything else" — a step up from hush for 3:1

export function fmtINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Compact form for chart labels: ₹1.2k, ₹45k, ₹2.3L
export function fmtINRShort(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}
