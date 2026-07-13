const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(['endpoint', 'apiKey']).then(({ endpoint, apiKey }) => {
  if (endpoint) $('endpoint').value = endpoint;
  if (apiKey) $('apiKey').value = apiKey;
});

$('save').addEventListener('click', async () => {
  const endpoint = $('endpoint').value.trim().replace(/\/$/, '');
  const apiKey = $('apiKey').value.trim();
  await chrome.storage.sync.set({ endpoint, apiKey });

  $('status').textContent = 'Testing…';
  try {
    const res = await fetch(`${endpoint}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vivy-key': apiKey },
      body: JSON.stringify({
        source: 'browser',
        type: 'note',
        title: 'Extension connected',
        payload: { from: 'options-page-test' },
      }),
    });
    $('status').textContent = res.ok
      ? '✓ Connected — Vivy can hear this browser now.'
      : `✗ Server said ${res.status} — check URL/key.`;
    $('status').style.color = res.ok ? '#7c7' : '#e77';
  } catch (e) {
    $('status').textContent = '✗ Could not reach the server: ' + e.message;
    $('status').style.color = '#e77';
  }
});
