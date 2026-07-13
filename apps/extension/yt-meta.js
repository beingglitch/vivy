// On YouTube watch pages, report the real video title + channel to the
// background worker (tab titles alone don't include the channel).

let lastReported = '';

function report() {
  const v = new URL(location.href).searchParams.get('v');
  if (!v) return;
  const url = `https://www.youtube.com/watch?v=${v}`;

  const title =
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
    document.title.replace(/ - YouTube$/, '');
  const channel =
    document.querySelector('ytd-channel-name #text a')?.textContent?.trim() || '';

  const key = url + '|' + title + '|' + channel;
  if (!title || key === lastReported) return;
  lastReported = key;

  chrome.runtime.sendMessage({ kind: 'yt-meta', url, title, channel }).catch(() => {});
}

// YouTube is a SPA — poll cheaply; DOM settles a bit after navigation.
setInterval(report, 4000);
report();
