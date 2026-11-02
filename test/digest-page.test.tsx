import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders the night table inside the layout', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table>');
    expect(html).toContain('last status');
    expect(html).toContain('—');
    expect(html).toContain('<header>');
  });

  it('404s when the night has no log', async () => {
    const res = await createApp(config).request('/digest/2000-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });
});
