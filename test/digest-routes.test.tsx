import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Fixture nights live in a temp dir; runs/ is read-only and never touched here.
let runsDir: string;
let config: { adapter: string; installed: string; beatEverySeconds: number; runsDir: string };

const NORMAL = '2026-10-29';
const MISSING = '2026-10-26';
const EMPTY = '2026-10-27';
const BROKEN = '2026-10-28';

const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: 'lane', ...extra });

// Job names in the order the page renders them, read from the first cell of each body row.
function pageJobs(html: string): string[] {
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...body.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1]!);
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

  writeFileSync(
    join(runsDir, `${NORMAL}.jsonl`),
    [
      line('rig/rotate-logs', 'ok', '2026-10-29T02:00:00+01:00'),
      line('digest/render', 'ok', '2026-10-29T02:10:00+01:00', { owner: null }),
      line('fixtures/refresh', 'retry', '2026-10-29T02:20:00+01:00', { error: 'timeout' }),
      line('fixtures/refresh', 'ok', '2026-10-29T02:25:00+01:00'),
      line('notes/backup', 'fail', '2026-10-29T03:00:00+01:00', { error: 'quota exceeded' }),
      line('lane/sync', 'ok', '2026-10-29T03:30:00+01:00'),
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BROKEN}.jsonl`),
    [
      line('lane/sync', 'ok', '2026-10-28T02:00:00+01:00'),
      '{"at":"2026-10-28T02:05:00+01:00","job":"notes/backup","sta',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night and /api/digest/:night', () => {
  it('a normal night is 200 on both routes, and the JSON rows match the page order', async () => {
    const app = createApp(config);
    const page = await app.request(`/digest/${NORMAL}`);
    const api = await app.request(`/api/digest/${NORMAL}`);

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);

    const html = await page.text();
    const night = (await api.json()) as Night;
    const jobs = night.rows.map((r) => r.job);

    expect(jobs).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(pageJobs(html)).toEqual(jobs);
    expect(night.badLines).toBe(0);
  });

  it('a night with no file is 404 on both routes', async () => {
    const app = createApp(config);
    const page = await app.request(`/digest/${MISSING}`);
    const api = await app.request(`/api/digest/${MISSING}`);

    expect(page.status).toBe(404);
    expect(await page.text()).toContain('no run log for that night');
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'no run log for this night' });
  });

  it('an empty file renders "nothing ran" and gives no rows', async () => {
    const app = createApp(config);
    const page = await app.request(`/digest/${EMPTY}`);
    const api = await app.request(`/api/digest/${EMPTY}`);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    const night = (await api.json()) as Night;
    expect(night.rows).toEqual([]);
    expect(night.badLines).toBe(0);
  });

  it('a truncated line is counted as a bad line and the page says so', async () => {
    const app = createApp(config);
    const page = await app.request(`/digest/${BROKEN}`);
    const api = await app.request(`/api/digest/${BROKEN}`);

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const night = (await api.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['lane/sync']);
    expect(await page.text()).toContain('could not be read');
  });
});
