import type { Failure, Filter, Reply, Resource, Row } from './types';

export const endpoint = 'https://data.gov.il/api/3/action/datastore_search';
const pageSize = 50;
const maxPages = 5;
const maxEntries = 128;
const maxCacheBytes = 2_000_000;
const maxResponseBytes = 1_000_000;
const maxRetryWait = 2_000;

export class RequestBudget {
  constructor(private remaining: number) {}

  claim() {
    if (this.remaining <= 0) throw new SourceError('budget');
    this.remaining--;
  }
}

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
    readonly status?: number,
  ) {
    super(issue);
  }
}

function wait(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

type Flight = {
  controller: AbortController;
  promise: Promise<Reply>;
  readers: number;
};
type Cached = { result: Reply; until: number; bytes: number };
type Page = { records: Row[]; limit: number; total?: number };

export class CkanClient {
  private readonly cache = new Map<string, Cached>();
  private readonly flights = new Map<string, Flight>();
  private readonly queue = new Set<() => void>();
  private active = 0;
  private bytes = 0;

  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly concurrency = 4,
    private readonly timeout = 5000,
    private readonly random = Math.random,
  ) {}

  async lookup(
    resource: Resource,
    filter: Filter,
    signal: AbortSignal,
    ttlMinutes = 20,
    budget?: RequestBudget,
  ): Promise<Reply> {
    signal.throwIfAborted();
    if (!Object.keys(filter).length) throw new Error('Exact filters required');
    const key =
      resource.id +
      JSON.stringify(
        Object.entries(filter)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => [
            name,
            Array.isArray(value) ? [...new Set(value)].sort() : value,
          ]),
      );
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      if (cached.until > Date.now()) {
        this.cache.set(key, cached);
        return { ...cached.result, cached: true };
      }
      this.bytes -= cached.bytes;
    }

    let flight = this.flights.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const promise = this.read(resource, filter, controller.signal, budget)
        .then((result) => {
          if (!result.issue && !controller.signal.aborted)
            this.store(key, result, ttlMinutes);
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
    let onAbort: (() => void) | undefined;
    try {
      return await Promise.race([
        shared.promise,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
      if (--shared.readers === 0 && this.flights.get(key) === shared)
        shared.controller.abort();
    }
  }

  private store(key: string, result: Reply, ttlMinutes: number) {
    const bytes = 2 * (key.length + JSON.stringify(result).length);
    if (bytes > maxCacheBytes) return;
    this.cache.set(key, {
      result,
      bytes,
      until: Date.now() + (result.rows.length ? ttlMinutes : 2) * 60_000,
    });
    this.bytes += bytes;
    for (const [key, entry] of this.cache) {
      if (this.bytes <= maxCacheBytes && this.cache.size <= maxEntries) break;
      this.cache.delete(key);
      this.bytes -= entry.bytes;
    }
  }

  private schedule<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.queue.delete(run);
        reject(signal.reason);
      };
      const run = () => {
        this.queue.delete(run);
        signal.removeEventListener('abort', abort);
        this.active++;
        void (async () => {
          signal.throwIfAborted();
          return work();
        })()
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            this.queue.values().next().value?.();
          });
      };
      if (this.active < this.concurrency) run();
      else {
        this.queue.add(run);
        signal.addEventListener('abort', abort, { once: true });
      }
    });
  }

  private async read(
    resource: Resource,
    filter: Filter,
    signal: AbortSignal,
    budget?: RequestBudget,
  ): Promise<Reply> {
    const rows: Row[] = [];
    const ids = new Set<number | string>();
    const start = Date.now();
    const result = (issue?: Failure, status?: number): Reply => ({
      rows,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      ...(issue && { issue }),
      ...(status !== undefined && { httpStatus: status }),
    });
    let retried = false;
    try {
      for (let page = 0; page < maxPages; page++) {
        const url = new URL(endpoint);
        url.search = new URLSearchParams({
          resource_id: resource.id,
          filters: JSON.stringify(filter),
          limit: String(pageSize),
          offset: String(rows.length),
          sort: '_id asc',
          include_total: 'false',
        }).toString();
        let batch: Page;
        const request = () =>
          this.schedule(() => {
            budget?.claim();
            return this.request(url, signal);
          }, signal);
        try {
          batch = await request();
        } catch (error) {
          if (
            retried ||
            !(error instanceof SourceError) ||
            error.retryAfter === undefined ||
            error.retryAfter > maxRetryWait
          )
            throw error;
          retried = true;
          await wait(error.retryAfter, signal);
          batch = await request();
        }
        if (
          batch.records.some((row) =>
            Object.entries(filter).some(
              ([field, value]) => !equal(row[field], value),
            ),
          )
        )
          return result('schema');
        for (const row of batch.records) {
          const id = row._id;
          if (typeof id !== 'number' && typeof id !== 'string') continue;
          if (ids.has(id)) return result('incomplete');
          ids.add(id);
        }
        rows.push(...batch.records);
        if (batch.total !== undefined) {
          if (rows.length >= batch.total) return result();
          if (!batch.records.length) return result('incomplete');
        } else if (batch.records.length < batch.limit) return result();
      }
      return result('incomplete');
    } catch (error) {
      signal.throwIfAborted();
      return error instanceof SourceError
        ? result(error.issue, error.status)
        : result('network');
    }
  }

  private async request(url: URL, signal: AbortSignal): Promise<Page> {
    const timer = AbortSignal.timeout(this.timeout);
    const backoff = () => 250 + Math.round(250 * this.random());
    try {
      const response = await this.fetcher(url, {
        signal: AbortSignal.any([signal, timer]),
        credentials: 'omit',
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        const header = response.headers.get('retry-after');
        const seconds =
          header && /^\d+$/.test(header) ? Number(header) * 1000 : NaN;
        const date = header ? Date.parse(header) - Date.now() : NaN;
        const delay = Number.isFinite(seconds)
          ? seconds
          : Number.isFinite(date)
            ? Math.max(0, date)
            : backoff();
        throw new SourceError(
          'http',
          [429, 500, 502, 503, 504].includes(response.status)
            ? delay
            : undefined,
          response.status,
        );
      }
      const content = response.body?.getReader();
      if (!content) throw new SourceError('invalid-response');
      const decoder = new TextDecoder();
      let text = '';
      let bytes = 0;
      try {
        while (true) {
          const chunk = await content.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maxResponseBytes) {
            void content.cancel().catch(() => {});
            throw new SourceError('incomplete');
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        content.releaseLock();
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new SourceError('invalid-response');
      }
      if (
        !object(body) ||
        body.success !== true ||
        !object(body.result) ||
        !Array.isArray(body.result.records) ||
        !body.result.records.every(isRow)
      )
        throw new SourceError('invalid-response');
      const { records, limit, total, total_was_estimated } = body.result;
      return {
        records,
        limit:
          typeof limit === 'number' && Number.isInteger(limit) && limit > 0
            ? Math.min(limit, pageSize)
            : pageSize,
        total:
          !total_was_estimated &&
          typeof total === 'number' &&
          Number.isSafeInteger(total) &&
          total >= 0
            ? total
            : undefined,
      };
    } catch (error) {
      signal.throwIfAborted();
      if (timer.aborted) throw new SourceError('timeout', backoff());
      if (error instanceof SourceError) throw error;
      // Fetch exposes browser CORS blocks and network disconnects as the same error.
      throw new SourceError('network', backoff());
    }
  }
}
