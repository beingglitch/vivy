export const STREAM_GRAPH_STYLES = ['Heatmap', 'Curve', 'Bars'] as const;

export const STREAM_COLOURS = [
  '#4F46E5',
  '#159E96',
  '#E0821A',
  '#D6455F',
  '#2FA84F',
  '#7C3AED',
  '#0284C7',
  '#C2410C',
] as const;

export type StreamGraphStyle = (typeof STREAM_GRAPH_STYLES)[number];

export type StreamPipelineDefinition =
  | {
      source: 'account-balances';
      accountIds: string[];
      subtractLiabilities: boolean;
    }
  | {
      source: 'transactions';
      accountIds: string[];
      direction: 'all' | 'debit' | 'credit';
      aggregate: 'sum' | 'count';
    }
  | {
      source: 'completed-tasks';
      areaIds: string[];
    };

export interface StreamPipelineOptions {
  accounts: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; name: string }>;
}
