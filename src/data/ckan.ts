import type { Failure, Filter, Reply, Resource, Row } from './types';

export const endpoint = 'https://data.gov.il/api/3/action/datastore_search';
const pageSize = 50;
const maxPages = 5;
const maxEntries = 128;

function object(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isRow(input: unknown): input is Row {
  return (
    object(input) &&
    Object.values(input).every(
      (value) =>
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean',
    )
  );
}

function equal(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected))
    return expected.some((value) => equal(actual, value));
  return (
    actual === expected ||
    (typeof expected === 'number' &&
      typeof actual === 'string' &&
      /^\d+$/.test(actual) &&
      Number(actual) === expected)
  );
}

class SourceError extends Error {
  constructor(
    readonly issue: Failure,
    readonly retryAfter?: number,
  ) {
    super(issue);
  }
}

type Flight = {
  controller: AbortController;
  promise: Promise<Reply>;
  readers: number;
};

export class CkanClient {
  private readonly cache = new Map<string, { result: Reply; until: number }>();
  private readonly flights = new Map<string, Flight>();
  private readonly queue: (() => void)[] = [];
  private active = 0;

  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly concurrency = 4,
    private readonly timeout = 5000,
  ) {}

  async lookup(
    resource: Resource,
    filter: Filter,
    signal: AbortSignal,
    ttlMinutes = 20,
  ): Promise<Reply> {
    signal.throwIfAborted();
    if (Object.keys(filter).length === 0)
      throw new Error('Exact filters required');
    const key =
      resource.id +
      JSON.stringify(
        Object.entries(filter).sort(([a], [b]) => a.localeCompare(b)),
      );
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.result;
    let flight = this.flights.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const promise = this.schedule(() =>
        this.read(resource, filter, controller.signal),
      )
        .then((result) => {
          if (!result.issue && !controller.signal.aborted) {
            this.cache.delete(key);
            this.cache.set(key, {
              result,
              until:
                Date.now() + (result.rows.length ? ttlMinutes : 2) * 60_000,
            });
            if (this.cache.size > maxEntries) {
              const oldest = this.cache.keys().next().value;
              if (oldest !== undefined) this.cache.delete(oldest);
            }
          }
          return result;
        })
        .finally(() => {
          if (this.flights.get(key)?.controller === controller)
            this.flights.delete(key);
        });
      flight = { controller, promise, readers: 0 };
      this.flights.set(key, flight);
    }
    const shared = flight;
    shared.readers++;
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        shared.promise,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (--shared.readers === 0) shared.controller.abort();
    }
  }

  private schedule<T>(work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.active++;
        void work()
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            this.queue.shift()?.();
          });
      };
      if (this.active < this.concurrency) run();
      else this.queue.push(run);
    });
  }

  private async read(
    resource: Resource,
    filter: Filter,
    signal: AbortSignal,
  ): Promise<Reply> {
    const rows: Row[] = [];
    const start = Date.now();
    const result = (issue?: Failure): Reply => ({
      rows,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      ...(issue && { issue }),
    });
    try {
      for (let page = 0; page < maxPages; page++) {
        signal.throwIfAborted();
        const url = new URL(endpoint);
        url.search = new URLSearchParams({
          resource_id: resource.id,
          filters: JSON.stringify(filter),
          limit: String(pageSize),
          offset: String(page * pageSize),
          sort: '_id asc',
          include_total: 'false',
        }).toString();
        let batch: Row[];
        try {
          batch = await this.request(url, signal);
        } catch (error) {
          if (
            !(error instanceof SourceError) ||
            error.retryAfter === undefined ||
            error.retryAfter > 2000
          )
            throw error;
          await new Promise((resolve) => setTimeout(resolve, error.retryAfter));
          signal.throwIfAborted();
          batch = await this.request(url, signal);
        }
        if (
          batch.some((row) =>
            Object.entries(filter).some(
              ([field, value]) => !equal(row[field], value),
            ),
          )
        ) {
          return result('schema');
        }
        rows.push(...batch);
        if (batch.length < pageSize) return result();
      }
      return result('incomplete');
    } catch (error) {
      signal.throwIfAborted();
      return result(error instanceof SourceError ? error.issue : 'network');
    }
  }

  private async request(url: URL, signal: AbortSignal): Promise<Row[]> {
    const timer = AbortSignal.timeout(this.timeout);
    try {
      const response = await this.fetcher(url, {
        signal: AbortSignal.any([signal, timer]),
        credentials: 'omit',
      });
      if (!response.ok) {
        const header = response.headers.get('retry-after');
        const seconds =
          header && /^\d+$/.test(header) ? Number(header) * 1000 : NaN;
        const date = header ? Date.parse(header) - Date.now() : NaN;
        const delay = Number.isFinite(seconds)
          ? seconds
          : Number.isFinite(date)
            ? Math.max(0, date)
            : 400;
        throw new SourceError(
          'http',
          response.status === 429 || response.status >= 500 ? delay : undefined,
        );
      }
      const body: unknown = await response.json().catch(() => {
        if (timer.aborted) throw new SourceError('timeout');
        throw new SourceError('invalid-response');
      });
      if (
        !object(body) ||
        body.success !== true ||
        !object(body.result) ||
        !Array.isArray(body.result.records) ||
        !body.result.records.every(isRow)
      ) {
        throw new SourceError('invalid-response');
      }
      return body.result.records;
    } catch (error) {
      signal.throwIfAborted();
      if (timer.aborted) throw new SourceError('timeout');
      throw error;
    }
  }
}
