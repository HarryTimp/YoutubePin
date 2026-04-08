chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_ACCOUNT_NAME') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: () => {
        const cfg = window?.yt?.config_ || {};
        const data = window?.ytInitialData || {};

        const domName =
          document.querySelector('ytd-active-account-header-renderer #channel-name')?.textContent?.trim() ||
          document.querySelector('#account-name')?.textContent?.trim() ||
          document.querySelector('yt-formatted-string#account-name')?.textContent?.trim();

        const domHandle =
          document.querySelector('ytd-active-account-header-renderer #channel-handle')?.textContent?.trim();

        const configName = cfg.USER_ACCOUNT_NAME || null;

        const topbarButtons = data?.topbar?.desktopTopbarRenderer?.topbarButtons || [];
        const accountBtn = topbarButtons.find(b => b.topbarMenuButtonRenderer?.avatar);
        const topbarLabel = accountBtn?.topbarMenuButtonRenderer?.avatar?.accessibility?.accessibilityData?.label;

        return { domName, domHandle, configName, topbarLabel };
      }
    }, (results) => {
      const r = results?.[0]?.result || {};
      console.log('Qr8 background: account candidates —', JSON.stringify(r));
      const name = r.domName || r.domHandle || r.configName || null;
      sendResponse({ name, debug: r });
    });
    return true;
  }
  if (msg.type === 'GET_EMAIL') {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
      sendResponse({ email: info?.email || null });
    });
    return true;
  }
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
