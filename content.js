let QR8_USER = null;
let QR8_AVATAR = null;
let QR8_PINNED = null;
let sidebarObserver = null;
const QR8_SERVER = 'https://qur-8.com';

console.log('Qr8: content.js loaded');

// ── Username setup ──────────────────────────────────────────────────

function initFeed(qr8_feed) {
  console.log('Qr8: initFeed — entries:', qr8_feed?.length ?? 0);
  if (qr8_feed && qr8_feed.length > 0) {
    const v = qr8_feed[0];
    QR8_PINNED = {
      id: v.video_id,
      title: v.title,
      channel: v.curated_by || v.channel,
      thumbnail: 'https://i.ytimg.com/vi/' + v.video_id + '/mqdefault.jpg'
    };
    console.log('Qr8: PINNED set from cache —', QR8_PINNED.title);
  } else {
    console.log('Qr8: initFeed — no cache, loading fallback');
    loadFallback();
  }
}

async function fetchFeed(user) {
  const url = `${QR8_SERVER}/curated?user=${encodeURIComponent(user)}`;
  console.log('Qr8: fetchFeed — requesting', url);
  try {
    const res = await fetch(url);
    console.log('Qr8: fetchFeed — status', res.status);
    if (!res.ok) { console.log('Qr8: fetchFeed — bad response, aborting'); return; }
    const feed = await res.json();
    console.log('Qr8: fetchFeed — received', feed.length, 'videos');
    if (!Array.isArray(feed) || feed.length === 0) { console.log('Qr8: fetchFeed — empty feed'); return; }
    chrome.storage.local.set({ qr8_feed: feed });
    const v = feed[0];
    QR8_PINNED = {
      id: v.video_id,
      title: v.title,
      channel: v.curated_by || v.channel,
      thumbnail: 'https://i.ytimg.com/vi/' + v.video_id + '/mqdefault.jpg'
    };
    console.log('Qr8: feed loaded from server —', QR8_PINNED.title);
    injectPinnedCard();
  } catch (e) {
    console.log('Qr8: fetchFeed error —', e.message);
  }
}

function setUser(name) {
  if (!name) { console.log('Qr8: setUser — called with empty name, skipping'); return; }
  if (QR8_USER === name) { console.log('Qr8: setUser — same user, no change'); return; }
  if (QR8_USER && QR8_USER !== name) {
    console.log('Qr8: account changed from', QR8_USER, '→', name);
    chrome.storage.local.remove('qr8_feed');
  }
  QR8_USER = name;
  chrome.storage.local.set({ qr8_user: name });
  console.log('Qr8: username set —', name);
  fetchFeed(name);
}

function resolveAccountName(attempt = 1) {
  console.log('Qr8: resolveAccountName — attempt', attempt);
  chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_NAME' }, (res) => {
    if (chrome.runtime.lastError) {
      console.log('Qr8: resolveAccountName — message error:', chrome.runtime.lastError.message);
      return;
    }
    console.log('Qr8: resolveAccountName — response:', JSON.stringify(res));
    if (res?.name) {
      setUser(res.name);
    } else if (attempt < 5) {
      console.log('Qr8: resolveAccountName — no name yet, retrying in 2s');
      setTimeout(() => resolveAccountName(attempt + 1), 2000);
    } else {
      console.log('Qr8: resolveAccountName — gave up after', attempt, 'attempts');
    }
  });
}

chrome.storage.local.get(['qr8_user', 'qr8_feed'], ({ qr8_user, qr8_feed }) => {
  console.log('Qr8: storage loaded — qr8_user:', qr8_user, '| feed entries:', qr8_feed?.length ?? 0);
  if (qr8_user) QR8_USER = qr8_user;

  initFeed(qr8_feed);
  resolveAccountName();
});

function loadFallback() {
  fetch(chrome.runtime.getURL('videos.json'))
    .then(r => r.json())
    .then(videos => {
      const v = videos[new Date().getMinutes() % videos.length];
      QR8_PINNED = {
        id: v.id,
        title: v.title,
        channel: v.channel,
        thumbnail: 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg'
      };
      console.log('Qr8: PINNED set from fallback —', QR8_PINNED.title);
    });
}

// ── DOM Injection ───────────────────────────────────────────────────

function injectPinnedCard() {
  if (!QR8_PINNED) { console.log('Qr8: injectPinnedCard — no PINNED'); return; }
  if (!location.pathname.startsWith('/watch')) return;

  const contents = document.querySelector(
    'ytd-watch-next-secondary-results-renderer #items ytd-item-section-renderer #contents'
  );
  if (!contents) { console.log('Qr8: injectPinnedCard — #contents not found'); return; }
  if (contents.children.length === 0) { console.log('Qr8: injectPinnedCard — #contents empty, waiting'); return; }

  // Remove existing card
  document.getElementById('qr8-pinned-card')?.remove();

  const card = document.createElement('a');
  card.id = 'qr8-pinned-card';
  card.href = '/watch?v=' + QR8_PINNED.id;
  card.style.cssText = `
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    text-decoration: none;
    color: inherit;
    border-left: 3px solid #c8a96e;
    background: rgba(200, 169, 110, 0.08);
    margin-bottom: 4px;
    box-sizing: border-box;
    width: 100%;
  `;

  const img = document.createElement('img');
  img.src = QR8_PINNED.thumbnail;
  img.style.cssText = 'width:120px;height:68px;object-fit:cover;border-radius:4px;flex-shrink:0;';

  const info = document.createElement('div');
  info.style.cssText = 'display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0;overflow:hidden;';

  const titleEl = document.createElement('div');
  titleEl.textContent = '[Qr8] ' + QR8_PINNED.title;
  titleEl.style.cssText = 'font-size:13px;font-weight:600;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';

  const channelEl = document.createElement('div');
  channelEl.textContent = QR8_PINNED.channel;
  channelEl.style.cssText = 'font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

  const labelEl = document.createElement('div');
  labelEl.textContent = 'Curated pick';
  labelEl.style.cssText = 'font-size:11px;color:#c8a96e;';

  info.append(titleEl, channelEl, labelEl);
  card.append(img, info);
  contents.prepend(card);

  console.log('Qr8: pinned card injected —', QR8_PINNED.title);
}

function waitForSidebar() {
  if (!location.pathname.startsWith('/watch')) return;

  if (sidebarObserver) { sidebarObserver.disconnect(); sidebarObserver = null; }

  // Try immediately in case it's already rendered
  injectPinnedCard();

  sidebarObserver = new MutationObserver(() => {
    const contents = document.querySelector(
      'ytd-watch-next-secondary-results-renderer #items ytd-item-section-renderer #contents'
    );
    if (contents && contents.children.length > 0 && !document.getElementById('qr8-pinned-card')) {
      injectPinnedCard();
    }
  });

  sidebarObserver.observe(document.body, { childList: true, subtree: true });

  // Disconnect observer after 15s to avoid leaking
  setTimeout(() => { sidebarObserver?.disconnect(); sidebarObserver = null; }, 15000);
}

// ── Qurate Button ────────────────────────────────────────────────

const wait = ms => new Promise(r => setTimeout(r, ms));

async function saveToQurate() {
  const qurateBtn = document.getElementById('qurate-btn');
  if (qurateBtn) qurateBtn.disabled = true;
  let wasRemoved = false;

  const saveBtn = [...document.querySelectorAll('button')].find(
    b => b.getAttribute('aria-label')?.toLowerCase().includes('save')
  );
  if (!saveBtn) { alert('Could not find Save button'); if (qurateBtn) qurateBtn.disabled = false; return; }
  saveBtn.click();

  await wait(1500);

  const items = [...document.querySelectorAll('yt-list-item-view-model[role="listitem"]')];
  const qurate = items.find(el => el.getAttribute('aria-label')?.includes('Qurate'));

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
    const channel = (
      document.querySelector('ytd-channel-name #text') ||
      document.querySelector('ytd-channel-name yt-formatted-string') ||
      document.querySelector('#owner #channel-name a') ||
      document.querySelector('ytd-video-owner-renderer #channel-name a')
    )?.textContent?.trim() || '';
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
  if (!menuRenderer) return;

  const btn = document.createElement('button');
  btn.id = 'qurate-btn';
  btn.textContent = '+Qr8';
  btn.style.cssText = `
    background: repeating-linear-gradient(100deg,#c8a96e 0px,#b8935a 2px,#d4b483 4px,#c09060 6px,#bb8c58 8px,#cfa872 10px,#c8a96e 12px);
    border: 1px solid #7a5c2e; border-radius: 18px; color: #ffffff;
    cursor: pointer; font-size: 17px; font-weight: 700;
    padding: 7px 19px; align-self: center; margin-left: 8px;
  `;
  btn.addEventListener('click', saveToQurate);
  const subBtn = document.getElementById('qr8-subscribe-btn');
  if (subBtn) subBtn.insertAdjacentElement('afterend', btn);
  else menuRenderer.insertBefore(btn, menuRenderer.firstChild);
}

function injectSubscribeButton() {
  if (document.getElementById('qr8-subscribe-btn')) return;
  if (!location.pathname.startsWith('/watch')) return;
  const menuRenderer = document.querySelector('ytd-watch-metadata ytd-menu-renderer');
  if (!menuRenderer) return;

  const btn = document.createElement('button');
  btn.id = 'qr8-subscribe-btn';
  btn.textContent = 'Follow Curator';
  btn.style.cssText = `
    background: repeating-linear-gradient(100deg,#c8a96e 0px,#b8935a 2px,#d4b483 4px,#c09060 6px,#bb8c58 8px,#cfa872 10px,#c8a96e 12px);
    border: 1px solid #7a5c2e; border-radius: 18px; color: #ffffff;
    cursor: pointer; font-size: 17px; font-weight: 700;
    padding: 7px 19px; margin-right: auto; align-self: center;
  `;
  btn.addEventListener('click', followCurator);
  menuRenderer.insertBefore(btn, menuRenderer.firstChild);
}

async function followCurator() {
  if (!QR8_USER) { alert('No Qr8 username set. Reload the page to set one.'); return; }
  const channel = (
    document.querySelector('ytd-channel-name #text') ||
    document.querySelector('ytd-channel-name yt-formatted-string') ||
    document.querySelector('#owner #channel-name a') ||
    document.querySelector('ytd-video-owner-renderer #channel-name a')
  )?.textContent?.trim();
  if (!channel) { alert('Could not find channel name.'); return; }
  const btn = document.getElementById('qr8-subscribe-btn');
  if (btn) btn.disabled = true;
  try {
    const checkRes = await fetch(`${QR8_SERVER}/subscriptions?user=${encodeURIComponent(QR8_USER)}`);
    if (checkRes.ok) {
      const subs = await checkRes.json();
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
    if (res.ok) alert(`Now following curator: ${channel}`);
    else alert(`Failed to follow ${channel}. Try again.`);
  } catch (e) {
    alert('Could not reach Qr8 server.');
  }
  if (btn) btn.disabled = false;
}

// ── Navigation ──────────────────────────────────────────────────────

async function onNavigate() {
  console.log('Qr8: onNavigate —', location.pathname);
  document.getElementById('qurate-btn')?.remove();
  document.getElementById('qr8-subscribe-btn')?.remove();
  document.getElementById('qr8-pinned-card')?.remove();

  if (QR8_USER) fetchFeed(QR8_USER);

  injectSubscribeButton();
  injectQurateButton();
  setTimeout(() => { injectSubscribeButton(); injectQurateButton(); }, 1000);
  setTimeout(() => { injectSubscribeButton(); injectQurateButton(); }, 2500);

  waitForSidebar();
}

window.addEventListener('yt-navigate-finish', onNavigate, true);
document.addEventListener('yt-navigate-finish', onNavigate, true);

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onNavigate();
  }
}).observe(document.body, { childList: true, subtree: true });

onNavigate();
