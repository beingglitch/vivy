import { getConfig, pendingCount, setConfig, flush } from './outbox';

/**
 * Pairing screen.
 *
 * The token is pasted once and stored in `chrome.storage.local`, which is
 * origin-scoped to the extension. It is deliberately never echoed back into the
 * field after saving - a token you cannot read off the screen is one that cannot
 * be shoulder-surfed off it either.
 */

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

async function render(): Promise<void> {
  const config = await getConfig();
  const status = $('status');
  const pending = await pendingCount();

  if (config) {
    $<HTMLInputElement>('endpoint').value = config.endpoint;
    $<HTMLInputElement>('deviceId').value = config.deviceId;
    status.textContent = `Paired as ${config.deviceId}. ${pending} record(s) waiting to send.`;
  } else {
    status.textContent = 'Not paired yet.';
  }
}

$('save').addEventListener('click', async () => {
  const endpoint = $<HTMLInputElement>('endpoint').value.trim().replace(/\/$/, '');
  const deviceId = $<HTMLInputElement>('deviceId').value.trim();
  const token = $<HTMLInputElement>('token').value.trim();

  if (!endpoint || !deviceId || !token) {
    $('status').textContent = 'Endpoint, device id and token are all required.';
    return;
  }

  await setConfig({ endpoint, deviceId, token });
  $<HTMLInputElement>('token').value = '';
  $('status').textContent = 'Saved. Sending anything queued...';
  const sent = await flush();
  $('status').textContent = sent
    ? 'Saved and syncing.'
    : 'Saved, but the endpoint did not accept the push. Check the URL and token.';
});

void render();
