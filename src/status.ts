import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { parseLine } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightCounts = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCounts[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Count of well-formed log lines per status. Lines that don't parse are not counted.
export function tallyLines(lines: string[]): Omit<NightCounts, 'night'> {
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const text of lines) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (line) counts[line.status]++;
  }
  return counts;
}

export function countNight(runsDir: string, night: string): NightCounts {
  let text = '';
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    // Missing or unreadable file: zero counts.
  }
  return { night, ...tallyLines(text.split('\n')) };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => countNight(config.runsDir, n)),
  };
}
