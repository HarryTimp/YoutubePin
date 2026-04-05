chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SYNC_SUBSCRIPTIONS') {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        sendResponse({ error: chrome.runtime.lastError?.message || 'No token' });
        return;
      }

      const subs = [];
      let pageToken = '';
      try {
        do {
          const url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${pageToken ? '&pageToken=' + pageToken : ''}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.error) { sendResponse({ error: data.error.message }); return; }
          for (const item of data.items || []) {
            subs.push(item.snippet.title);
          }
          pageToken = data.nextPageToken || '';
        } while (pageToken);

        // Send to Qr8 server
        await fetch('https://qur-8.com/subscribe/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: msg.user, subscribe_to: subs })
        });

        sendResponse({ ok: true, count: subs.length });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true; // keep message channel open for async response
  }
});
