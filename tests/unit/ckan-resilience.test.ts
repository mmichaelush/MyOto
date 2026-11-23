import { expect, test, vi } from 'vitest';
import { CkanClient, RequestBudget } from '../../src/data/ckan';
import { resources } from '../../src/data/sources';

const resource = resources.private_cars_1;
const filter = { mispar_rechev: 123456 };
const ok = () =>
  Response.json({ success: true, result: { records: [filter] } });

test.each([429, 500, 503])('retries transient HTTP %i once', async (status) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response('', { status, headers: { 'retry-after': '0' } }),
    )
    .mockResolvedValueOnce(ok());
  const result = await new CkanClient(fetcher).lookup(
    resource,
    filter,
    new AbortController().signal,
  );
  expect(result).toMatchObject({ rows: [filter] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('does not retry before the server delay or report an error as an empty success', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response('', { status: 429, headers: { 'retry-after': '10' } }),
    );
  const result = await new CkanClient(fetcher).lookup(
    resource,
    filter,
    new AbortController().signal,
  );
  expect(result).toMatchObject({ issue: 'http', httpStatus: 429 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('shares a normalized request and removes an aborted queued job', async () => {
  let resolve: (value: Response) => void = () => {};
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockImplementation(async () => ok());
  const client = new CkanClient(fetcher, 1);
  const active = client.lookup(
    resource,
    { mispar_rechev: [123456, 234567] },
    new AbortController().signal,
  );
  const duplicate = client.lookup(
    resource,
    { mispar_rechev: [234567, 123456, 123456] },
    new AbortController().signal,
  );
  const controller = new AbortController();
  const queued = client.lookup(
    resource,
    { mispar_rechev: 345678 },
    controller.signal,
  );
  const rejection = expect(queued).rejects.toHaveProperty('name', 'AbortError');
  controller.abort();
  await rejection;
  resolve(ok());
  await Promise.all([active, duplicate]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('classifies browser network and CORS failures and respects the HTTP budget', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new TypeError('Failed to fetch'));
  const client = new CkanClient(fetcher, 1, 5000, () => 0);
  const signal = new AbortController().signal;
  expect((await client.lookup(resource, filter, signal)).issue).toBe('network');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    (await client.lookup(resource, filter, signal, 20, new RequestBudget(0)))
      .issue,
  ).toBe('budget');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
