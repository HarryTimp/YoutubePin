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

function setUser(channelName) {
  if (!channelName) { console.log('Qr8: setUser — called with empty name, skipping'); return; }
  if (QR8_USER === channelName) { console.log('Qr8: setUser — same user, no change'); return; }
  if (QR8_USER && QR8_USER !== channelName) {
    console.log('Qr8: account changed from', QR8_USER, '→', channelName);
    chrome.storage.local.remove('qr8_feed');
  }
  QR8_USER = channelName;
  console.log('Qr8: username set —', channelName);
  fetchFeed(channelName);
}

function getChannelNameFromDOM() {
  return (
    document.querySelector('ytd-active-account-header-renderer #account-name yt-formatted-string') ||
    document.querySelector('ytd-active-account-header-renderer #account-name')
  )?.textContent?.trim() || null;
}

function showAccountConfirmPopup(email, channelName, onConfirm) {
  // Remove any existing popup
  document.getElementById('qr8-account-popup')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'qr8-account-popup';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999; font-family: Arial, sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #1a1a1a; border: 1px solid #c8a96e; border-radius: 12px;
    padding: 28px 32px; width: 380px; color: #f1f1f1;
  `;

  const title = document.createElement('div');
  title.textContent = 'Confirm your Qr8 account';
  title.style.cssText = 'font-size: 17px; font-weight: 700; color: #c8a96e; margin-bottom: 20px;';

  const labelStyle = 'font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;';
  const inputStyle = `
    width: 100%; box-sizing: border-box; background: #0f0f0f;
    border: 1px solid #444; border-radius: 6px; color: #f1f1f1;
    font-size: 14px; padding: 8px 10px; margin-bottom: 16px;
    outline: none;
  `;

  const emailLabel = document.createElement('label');
  emailLabel.textContent = 'Google email';
  emailLabel.style.cssText = labelStyle;

  const emailInput = document.createElement('input');
  emailInput.type = 'text';
  emailInput.value = email;
  emailInput.style.cssText = inputStyle;

  const channelLabel = document.createElement('label');
  channelLabel.textContent = 'YouTube channel name';
  channelLabel.style.cssText = labelStyle;

  const channelInput = document.createElement('input');
  channelInput.type = 'text';
  channelInput.value = channelName;
  channelInput.style.cssText = inputStyle;

  const note = document.createElement('div');
  note.textContent = 'Correct either field if it looks wrong before confirming.';
  note.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 20px;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: #333; border: none; border-radius: 8px; color: #f1f1f1;
    font-size: 14px; font-weight: 600; padding: 8px 18px; cursor: pointer;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.style.cssText = `
    background: #c8a96e; border: none; border-radius: 8px; color: #0f0f0f;
    font-size: 14px; font-weight: 700; padding: 8px 18px; cursor: pointer;
  `;
  confirmBtn.addEventListener('click', () => {
    const finalEmail = emailInput.value.trim();
    const finalChannel = channelInput.value.trim();
    if (!finalEmail || !finalChannel) { alert('Both fields are required.'); return; }
    overlay.remove();
    onConfirm(finalEmail, finalChannel);
  });

  btnRow.append(cancelBtn, confirmBtn);
  box.append(title, emailLabel, emailInput, channelLabel, channelInput, note, btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Focus the channel input since that's most likely to need correction
  channelInput.focus();
  channelInput.select();
}

function resolveAccountName() {
  // Get email as a stable key, then look up the mapped channel name
  chrome.runtime.sendMessage({ type: 'GET_EMAIL' }, (res) => {
    if (chrome.runtime.lastError) {
      console.log('Qr8: resolveAccountName — error:', chrome.runtime.lastError.message);
      return;
    }
    const email = res?.email;
    console.log('Qr8: resolveAccountName — email:', email);
    if (!email) return;

    // Check if we already have a channel name mapped to this email
    chrome.storage.local.get(['qr8_email_map', 'qr8_all_channels'], ({ qr8_email_map, qr8_all_channels }) => {
      const map = qr8_email_map || {};
      const allChannels = qr8_all_channels || {};
      if (map[email]) {
        // Sanity check: make sure this channel isn't mapped to a DIFFERENT email
        const otherEmail = Object.entries(map).find(([e, ch]) => ch === map[email] && e !== email)?.[0];
        if (otherEmail) {
          console.log('Qr8: resolveAccountName — cache conflict! Channel', map[email], 'also mapped to', otherEmail, '— clearing and re-detecting');
          delete map[email];
          chrome.storage.local.set({ qr8_email_map: map });
        } else {
          console.log('Qr8: resolveAccountName — channel name from cache:', map[email]);
          setUser(map[email]);
          return;
        }
      }

      // No mapping yet — auto-click the avatar to render the account menu, read the name, then close it
      console.log('Qr8: resolveAccountName — no channel name cached, triggering account menu...');
      const avatarBtn = document.querySelector('#avatar-btn, button#avatar-btn');
      if (avatarBtn) avatarBtn.click();

      const observer = new MutationObserver(() => {
        const channelName = getChannelNameFromDOM();
        if (channelName) {
          observer.disconnect();
          console.log('Qr8: resolveAccountName — channel name from DOM:', channelName);
          // Close the menu again
          const closeTarget = document.querySelector('ytd-multi-page-menu-renderer') || document.querySelector('iron-dropdown');
          if (closeTarget) document.body.click();
          // Show confirmation popup before storing
          showAccountConfirmPopup(email, channelName, (confirmedEmail, confirmedChannel) => {
            map[confirmedEmail] = confirmedChannel;
            chrome.storage.local.set({ qr8_email_map: map });
            setUser(confirmedChannel);
          });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    });
  });
}

// Always clear stale feed cache on load — fetchFeed will repopulate it
chrome.storage.local.remove('qr8_feed');
chrome.storage.local.get(['qr8_email_map'], ({ qr8_email_map }) => {
  console.log('Qr8: startup — qr8_email_map:', JSON.stringify(qr8_email_map));
});
loadFallback();
resolveAccountName();

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
  card.addEventListener('click', () => {
    if (QR8_USER && QR8_PINNED?.id) {
      fetch(`${QR8_SERVER}/curate-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: QR8_USER, video_id: QR8_PINNED.id })
      });
      console.log('Qr8: curate-history recorded —', QR8_PINNED.id);
    }
  });

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

async function saveToQurate() {
  if (!QR8_USER) { alert('No Qr8 username set. Reload the page.'); return; }
  const qurateBtn = document.getElementById('qurate-btn');
  if (qurateBtn) qurateBtn.disabled = true;

  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId) { if (qurateBtn) qurateBtn.disabled = false; return; }

  const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || '';
  const channel = (
    document.querySelector('ytd-video-owner-renderer ytd-channel-name #text') ||
    document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string') ||
    document.querySelector('#owner ytd-channel-name #text') ||
    document.querySelector('#owner #channel-name a')
  )?.textContent?.trim() || '';

  try {
    const res = await fetch(`${QR8_SERVER}/curator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: QR8_USER, video_id: videoId, title, channel })
    });
    if (res.ok) {
      console.log('Qr8: saved to curator list —', title);
      if (qurateBtn) { qurateBtn.textContent = '✓ Qr8d'; setTimeout(() => { qurateBtn.textContent = '+Qr8'; }, 2000); }
    } else {
      alert('Failed to save to Qr8.');
    }
  } catch (e) {
    alert('Could not reach Qr8 server.');
    console.log('Qr8: saveToQurate error —', e.message);
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

function getVideoOwnerChannel() {
  return (
    document.querySelector('ytd-video-owner-renderer ytd-channel-name #text') ||
    document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string') ||
    document.querySelector('ytd-video-owner-renderer #channel-name a') ||
    document.querySelector('ytd-video-owner-renderer #owner-name a')
  )?.textContent?.trim() || null;
}

async function followCurator() {
  if (!QR8_USER) { alert('No Qr8 username set. Reload the page to set one.'); return; }

  let channel = getVideoOwnerChannel();
  console.log('Qr8: followCurator — QR8_USER:', QR8_USER, '| channel from DOM:', channel);
  if (!channel) { alert('Could not find channel name.'); return; }

  // Self-subscription check
  if (channel === QR8_USER) {
    console.log('Qr8: followCurator — self-subscription detected, re-reading channel...');
    // Wait a moment and try again in case DOM wasn't fully settled
    await new Promise(r => setTimeout(r, 500));
    channel = getVideoOwnerChannel();
    if (!channel) {
      alert('Could not read the channel name. Try again.');
      return;
    }
    if (channel === QR8_USER) {
      alert(`You can't follow yourself (${QR8_USER}). Make sure you're on a video page from another creator.`);
      return;
    }
  }

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
