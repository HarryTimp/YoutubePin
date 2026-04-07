let QR8_USER = null;
let QR8_AVATAR = null;
const QR8_SERVER = 'https://qur-8.com';

console.log('Qr8: content.js loaded');

// ── Inject fetch interceptor into page context immediately ──────────
(function injectFetchInterceptor() {
  console.log('Qr8: injecting fetch interceptor');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  console.log('Qr8: injected.js appended to DOM');
})();

function setPinned(video) {
  console.log('Qr8: setPinned called —', video?.title);
  window.postMessage({ type: 'QR8_SET_PINNED', pinned: video }, '*');
}

// Wait for injected.js to be ready, then seed PINNED from cache
window.addEventListener('qr8_injected_ready', () => {
  console.log('Qr8: injected.js ready signal received');
  chrome.storage.local.get('qr8_feed', ({ qr8_feed }) => {
    console.log('Qr8: cache seed — qr8_feed length:', qr8_feed?.length ?? 'null');
    if (qr8_feed && qr8_feed.length > 0) {
      const v = qr8_feed[0];
      console.log('Qr8: seeding PINNED from cache —', v.title);
      setPinned({
        id: v.video_id,
        title: v.title,
        channel: v.curated_by || v.channel,
        thumbnail: 'https://i.ytimg.com/vi/' + v.video_id + '/mqdefault.jpg'
      });
    } else {
      console.warn('Qr8: no cached feed to seed from');
    }
  });
});

// ── Username setup ──────────────────────────────────────────────────
chrome.storage.local.get(['qr8_user', 'qr8_avatar'], ({ qr8_user, qr8_avatar }) => {
  console.log('Qr8: username from storage —', qr8_user ?? 'none');
  QR8_AVATAR = qr8_avatar || null;
  if (qr8_user) {
    QR8_USER = qr8_user;
    console.log('Qr8: QR8_USER set to', QR8_USER);
  } else {
    const name = prompt('Welcome to Qr8! Enter your username:');
    if (name && name.trim()) {
      QR8_USER = name.trim();
      chrome.storage.local.set({ qr8_user: QR8_USER });
      console.log('Qr8: QR8_USER set from prompt —', QR8_USER);
    }
  }
  syncFeed();
});

async function checkForAccountSwitch() {
  // Disabled — was causing page freezes when DevTools open
}

// ── Load feed from local storage and set PINNED ──────────────────────
let QR8_FEED = [];

function syncFeed() {
  console.log('Qr8: syncFeed called, QR8_USER =', QR8_USER);
  chrome.storage.local.get('qr8_feed', ({ qr8_feed }) => {
    console.log('Qr8: syncFeed — qr8_feed length:', qr8_feed?.length ?? 'null');
    if (qr8_feed && qr8_feed.length > 0) {
      QR8_FEED = qr8_feed;
      console.log('Qr8: feed loaded, first video —', qr8_feed[0].title);
      setPinned({
        id: qr8_feed[0].video_id,
        title: qr8_feed[0].title,
        channel: qr8_feed[0].curated_by || qr8_feed[0].channel,
        thumbnail: 'https://i.ytimg.com/vi/' + qr8_feed[0].video_id + '/mqdefault.jpg'
      });
    } else {
      if (!qr8_feed) {
        console.warn('Qr8: no feed found in storage — has a server sync been run?');
      } else if (qr8_feed.length === 0) {
        console.warn('Qr8: feed is empty — no curated videos for this user yet');
      }
      console.log('Qr8: falling back to videos.json');
      loadFallback();
    }
  });
}

function loadFallback() {
  console.log('Qr8: loadFallback called');
  fetch(chrome.runtime.getURL('videos.json'))
    .then(r => r.json())
    .then(videos => {
      const v = videos[new Date().getMinutes() % videos.length];
      console.log('Qr8: fallback video —', v.title);
      setPinned({
        ...v,
        thumbnail: 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg'
      });
    });
}

// ── Qurate Button ────────────────────────────────────────────────

const wait = ms => new Promise(r => setTimeout(r, ms));

async function saveToQurate() {
  console.log('Qr8: saveToQurate called, QR8_USER =', QR8_USER);
  const qurateBtn = document.getElementById('qurate-btn');
  if (qurateBtn) qurateBtn.disabled = true;
  let wasRemoved = false;

  await checkForAccountSwitch();

  // Open the save modal
  const saveBtn = [...document.querySelectorAll('button')].find(
    b => b.getAttribute('aria-label')?.toLowerCase().includes('save')
  );
  if (!saveBtn) { alert('Could not find Save button'); if (qurateBtn) qurateBtn.disabled = false; return; }
  saveBtn.click();

  await wait(1500);

  // Check if Qurate playlist exists
  const items = [...document.querySelectorAll('yt-list-item-view-model[role="listitem"]')];
  const qurate = items.find(el => el.getAttribute('aria-label')?.includes('Qurate'));
  console.log('Qr8: Qurate playlist found in modal —', !!qurate);

  if (qurate) {
    const alreadyAdded = qurate.getAttribute('aria-label')?.toLowerCase().includes('selected') &&
                         !qurate.getAttribute('aria-label')?.toLowerCase().includes('not selected');

    if (alreadyAdded) {
      const closeBtn = document.querySelector('tp-yt-paper-dialog #close-button button, [aria-label="Close"]');
      if (closeBtn) closeBtn.click();
      await wait(300);

      const remove = confirm('This video is already Qurated, would you like to remove it?');
      if (!remove) { if (qurateBtn) qurateBtn.disabled = false; return; }
      wasRemoved = true;

      saveBtn.click();
      await wait(1500);
      const refreshedQurate = [...document.querySelectorAll('yt-list-item-view-model[role="listitem"]')]
        .find(el => el.getAttribute('aria-label')?.includes('Qurate'));
      refreshedQurate?.querySelector('.yt-list-item-view-model__layout-wrapper')?.click();
      await wait(400);
    } else {
      qurate.querySelector('.yt-list-item-view-model__layout-wrapper')?.click() || qurate.click();
    }
    await wait(400);
  } else {
    const newBtn = [...document.querySelectorAll('button')].find(
      b => b.textContent.trim().toLowerCase().includes('new playlist')
    );
    if (!newBtn) { alert('Could not find New Playlist button'); return; }
    newBtn.click();
    await wait(600);

    const textarea = document.querySelector('textarea[placeholder="Choose a title"]');
    if (textarea) {
      textarea.focus();
      textarea.value = 'Qurate';
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(400);

      const dialog = document.querySelector('tp-yt-paper-dialog');
      const combobox = dialog?.querySelector('[role="combobox"]');
      if (combobox) {
        combobox.click();
        await wait(600);
        const publicOption = [...document.querySelectorAll('yt-list-item-view-model[role="menuitem"]')].find(
          el => el.textContent.trim().toLowerCase().startsWith('public')
        );
        if (publicOption) publicOption.click();
        await wait(300);
      }

      const createBtn = dialog?.querySelector('button[aria-label="Create"]');
      if (createBtn) createBtn.click();
      await wait(600);
    }
  }

  const closeBtn = document.querySelector('tp-yt-paper-dialog #close-button button, ytd-add-to-playlist-renderer + * [aria-label="Close"]');
  if (closeBtn) closeBtn.click();

  if (QR8_USER) {
    const videoId = new URLSearchParams(location.search).get('v');
    const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || '';
    const channel = document.querySelector('ytd-channel-name #text')?.textContent?.trim() || '';
    console.log('Qr8: syncing to server — user:', QR8_USER, 'videoId:', videoId, 'removed:', wasRemoved);
    if (videoId) {
      if (wasRemoved) {
        fetch(`${QR8_SERVER}/curator`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: QR8_USER, video_id: videoId })
        });
      } else {
        fetch(`${QR8_SERVER}/curator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: QR8_USER, video_id: videoId, title, channel })
        });
      }
    }
  }

  if (qurateBtn) qurateBtn.disabled = false;
}

function injectQurateButton() {
  if (document.getElementById('qurate-btn')) return;
  if (!location.pathname.startsWith('/watch')) return;

  const menuRenderer = document.querySelector('ytd-watch-metadata ytd-menu-renderer');
  if (!menuRenderer) { console.log('Qr8: injectQurateButton — menuRenderer not found'); return; }

  console.log('Qr8: injecting +Qr8 button');
  const btn = document.createElement('button');
  btn.id = 'qurate-btn';
  btn.textContent = '+Qr8';
  btn.style.cssText = `
    background: repeating-linear-gradient(
      100deg,
      #c8a96e 0px, #b8935a 2px, #d4b483 4px, #c09060 6px,
      #bb8c58 8px, #cfa872 10px, #c8a96e 12px
    );
    border: 1px solid #7a5c2e;
    border-radius: 18px;
    color: #ffffff;
    cursor: pointer;
    font-size: 17px;
    font-weight: 700;
    padding: 7px 19px;
    align-self: center;
    margin-left: 8px;
  `;
  btn.addEventListener('click', saveToQurate);
  const subBtn = document.getElementById('qr8-subscribe-btn');
  if (subBtn) {
    subBtn.insertAdjacentElement('afterend', btn);
  } else {
    menuRenderer.insertBefore(btn, menuRenderer.firstChild);
  }
}

function injectSubscribeButton() {
  if (document.getElementById('qr8-subscribe-btn')) return;
  if (!location.pathname.startsWith('/watch')) return;

  const menuRenderer = document.querySelector('ytd-watch-metadata ytd-menu-renderer');
  if (!menuRenderer) { console.log('Qr8: injectSubscribeButton — menuRenderer not found'); return; }

  console.log('Qr8: injecting Follow Curator button');
  const btn = document.createElement('button');
  btn.id = 'qr8-subscribe-btn';
  btn.textContent = 'Follow Curator';
  btn.style.cssText = `
    background: repeating-linear-gradient(
      100deg,
      #c8a96e 0px, #b8935a 2px, #d4b483 4px, #c09060 6px,
      #bb8c58 8px, #cfa872 10px, #c8a96e 12px
    );
    border: 1px solid #7a5c2e;
    border-radius: 18px;
    color: #ffffff;
    cursor: pointer;
    font-size: 17px;
    font-weight: 700;
    padding: 7px 19px;
    margin-right: auto;
    align-self: center;
  `;
  btn.addEventListener('click', followCurator);
  menuRenderer.insertBefore(btn, menuRenderer.firstChild);
}

async function followCurator() {
  console.log('Qr8: followCurator called, QR8_USER =', QR8_USER);
  if (!QR8_USER) { alert('No Qr8 username set. Reload the page to set one.'); return; }

  const channel = document.querySelector('ytd-channel-name #text')?.textContent?.trim();
  console.log('Qr8: channel detected —', channel);
  if (!channel) { alert('Could not find channel name.'); return; }

  const btn = document.getElementById('qr8-subscribe-btn');
  if (btn) btn.disabled = true;

  try {
    const checkRes = await fetch(`${QR8_SERVER}/subscriptions?user=${encodeURIComponent(QR8_USER)}`);
    if (checkRes.ok) {
      const subs = await checkRes.json();
      console.log('Qr8: current subscriptions —', subs.map(s => s.curator));
      if (subs.find(s => s.curator === channel)) {
        alert(`You are already following curator: ${channel}`);
        if (btn) btn.disabled = false;
        return;
      }
    }

    const res = await fetch(`${QR8_SERVER}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: QR8_USER, curator: channel })
    });
    console.log('Qr8: subscribe response —', res.status);
    if (res.ok) {
      alert(`Now following curator: ${channel}`);
    } else {
      alert(`Failed to follow ${channel}. Try again.`);
    }
  } catch (e) {
    console.error('Qr8: followCurator error —', e.message);
    alert('Could not reach Qr8 server.');
  }

  if (btn) btn.disabled = false;
}

async function onNavigate() {
  console.log('Qr8: onNavigate fired —', location.pathname);
  document.getElementById('qurate-btn')?.remove();
  document.getElementById('qr8-subscribe-btn')?.remove();
  injectSubscribeButton();
  injectQurateButton();
  setTimeout(() => { injectSubscribeButton(); injectQurateButton(); }, 1000);
  setTimeout(() => { injectSubscribeButton(); injectQurateButton(); }, 2500);
  setTimeout(() => { injectSubscribeButton(); injectQurateButton(); }, 5000);

  await checkForAccountSwitch();
}

// ── Handle YouTube SPA navigation ──────────────────────────────────
window.addEventListener('yt-navigate-finish', onNavigate, true);
document.addEventListener('yt-navigate-finish', onNavigate, true);

// Fallback: watch for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onNavigate();
  }
}).observe(document.body, { childList: true, subtree: true });

// Initial run
console.log('Qr8: initial onNavigate');
onNavigate();
