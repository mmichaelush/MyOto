export type Scalar = string | number | boolean | null;
export type Row = Record<string, Scalar>;
export type Filter = Record<string, Scalar | readonly Scalar[]>;
export type Resource = { id: string; label: string; url: string };
export type Failure =
  | 'network'
  | 'timeout'
  | 'http'
  | 'invalid-response'
  | 'schema'
  | 'incomplete'
  | 'budget';
export type Reply = {
  rows: Row[];
  fetchedAt: string;
  durationMs: number;
  cached?: true;
  issue?: Failure;
  httpStatus?: number;
  upstreamUpdatedAt?: string;
};
