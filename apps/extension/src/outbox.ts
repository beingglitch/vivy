import type { RawRecord, VivyEvent, PushRequest, PushResponse } from '@vivy/core';

/**
 * The outbox.
 *
 * Every collector in Vivy writes here first and never talks to the network
 * directly. That inversion is what makes offline capture safe: the browser can
 * be on a plane, the server can be down, the laptop can sleep mid-flush, and the
 * only consequence is a longer queue.
 *
 * Flushing is idempotent by `dedupeKey`, so the failure mode we optimise for is
 * "send twice", never "drop once".
 */

const QUEUE_KEY = 'vivy.outbox';
const CONFIG_KEY = 'vivy.config';
const MAX_QUEUE = 5000;

export interface Config {
  endpoint: string;
  deviceId: string;
  token: string;
}

interface Queued {
  raw: RawRecord[];
  events: VivyEvent[];
}

async function readQueue(): Promise<Queued> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const value = stored[QUEUE_KEY] as Queued | undefined;
  return value ?? { raw: [], events: [] };
}

async function writeQueue(queue: Queued): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function getConfig(): Promise<Config | null> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  return (stored[CONFIG_KEY] as Config | undefined) ?? null;
}

export async function setConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
}

export async function enqueueEvent(event: VivyEvent): Promise<void> {
  const queue = await readQueue();
  queue.events.push(event);
  // Drop oldest under sustained failure. Losing the tail of a very long outage
  // beats an unbounded queue that eventually breaks storage for everything else.
  if (queue.events.length > MAX_QUEUE) queue.events = queue.events.slice(-MAX_QUEUE);
  await writeQueue(queue);
}

export async function enqueueRaw(record: RawRecord): Promise<void> {
  const queue = await readQueue();
  queue.raw.push(record);
  if (queue.raw.length > MAX_QUEUE) queue.raw = queue.raw.slice(-MAX_QUEUE);
  await writeQueue(queue);
}

export async function pendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.raw.length + queue.events.length;
}

/**
 * Send what we have.
 *
 * Only rows the server confirmed are removed, and confirmation is by count of a
 * prefix we sent - so a partial failure re-sends rather than silently losing the
 * tail. Returns false when nothing could be sent, which the caller uses to back
 * off rather than hammer a dead endpoint.
 */
export async function flush(): Promise<boolean> {
  const config = await getConfig();
  if (!config) return false;

  const queue = await readQueue();
  if (queue.raw.length === 0 && queue.events.length === 0) return true;

  const batchRaw = queue.raw.slice(0, 200);
  const batchEvents = queue.events.slice(0, 200);

  const payload: PushRequest = {
    deviceId: config.deviceId,
    sentAt: new Date().toISOString(),
    raw: batchRaw,
    events: batchEvents,
  };

  try {
    const response = await fetch(`${config.endpoint}/api/sync/push`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('[vivy] push rejected', response.status);
      return false;
    }

    // Accepted or duplicate both mean "the server has it" - drop either way.
    (await response.json()) as PushResponse;
    const remaining = await readQueue();
    await writeQueue({
      raw: remaining.raw.slice(batchRaw.length),
      events: remaining.events.slice(batchEvents.length),
    });
    return true;
  } catch (error) {
    console.warn('[vivy] push failed, keeping queue', error instanceof Error ? error.message : error);
    return false;
  }
}
