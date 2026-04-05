let PINNED = null;
let QR8_USER = null;

const QR8_SERVER = 'http://204.168.190.47:3000';

// Get or prompt for username, then boot the extension
chrome.storage.local.get('qr8_user', ({ qr8_user }) => {
  if (qr8_user) {
    QR8_USER = qr8_user;
  } else {
    const name = prompt('Welcome to Qr8! Enter your username:');
    if (name && name.trim()) {
      QR8_USER = name.trim();
      chrome.storage.local.set({ qr8_user: QR8_USER });
    }
  }
  syncSubscriptions();
});

// ── Sync YouTube subscriptions to Qr8 server ──────────────────────

async function syncSubscriptions() {
  if (!QR8_USER) return;
  chrome.runtime.sendMessage({ type: 'SYNC_SUBSCRIPTIONS', user: QR8_USER }, (response) => {
    if (response?.error) {
      console.error('Qr8 sync failed:', response.error);
    } else if (response?.ok) {
      console.log(`Qr8: synced ${response.count} subscriptions`);
    }
  });
}

fetch(chrome.runtime.getURL('videos.json'))
  .then(r => r.json())
  .then(videos => {
    const OddsEvens = new Date().getMinutes() % 2;
    PINNED = videos[OddsEvens % videos.length];
    PINNED.url = 'https://www.youtube.com/watch?v=' + PINNED.id;
    PINNED.thumbnail = 'https://i.ytimg.com/vi/' + PINNED.id + '/mqdefault.jpg';
    onNavigate();
  });

function getItemsList() {
  return document.querySelector(
    'ytd-watch-next-secondary-results-renderer ytd-item-section-renderer #contents'
  );
}

function getFirstCard() {
  const items = getItemsList();
  if (!items) return null;
  const cards = items.querySelectorAll(
    'ytd-compact-video-renderer, yt-lockup-view-model, ytd-compact-autoplay-renderer'
  );
  for (const card of cards) {
    const img = card.querySelector('img');
    if (img && img.src && img.src.startsWith('http')) return card;
  }
  return cards[0] || null;
}

function injectPinned() {
  if (!PINNED) return;
  if (!location.pathname.startsWith('/watch')) return;
  if (document.getElementById('yt-pinned')) return;

  const firstCard = getFirstCard();
  if (!firstCard) return;

  const clone = firstCard.cloneNode(true);
  clone.id = 'yt-pinned';

  // Update all links
  clone.querySelectorAll('a').forEach(a => a.href = PINNED.url);

  // Update thumbnail
  clone.querySelectorAll('img').forEach(img => {
    img.src = PINNED.thumbnail;
    img.srcset = '';
    img.removeAttribute('data-src');
    img.removeAttribute('loading');
    img.setAttribute('src', PINNED.thumbnail);
  });

  // Update title
  const titleH3 = clone.querySelector('h3.yt-lockup-metadata-view-model__heading-reset');
  if (titleH3) titleH3.setAttribute('title', PINNED.title);
  const titleLink = clone.querySelector('a.yt-lockup-metadata-view-model__title');
  if (titleLink) titleLink.setAttribute('aria-label', PINNED.title);
  const titleSpan = clone.querySelector('a.yt-lockup-metadata-view-model__title span');
  if (titleSpan) titleSpan.textContent = PINNED.title;

  // Update channel name
  const metaSpans = clone.querySelectorAll('.ytContentMetadataViewModelMetadataRow span.yt-core-attributed-string');
  if (metaSpans[0]) metaSpans[0].textContent = PINNED.channel;

  firstCard.parentNode.insertBefore(clone, firstCard);

  // Replace thumbnail container with a plain img YouTube can't override
  const thumbContainer = clone.querySelector('.ytThumbnailViewModelImage');
  if (thumbContainer) {
    const plainImg = document.createElement('img');
    plainImg.src = PINNED.thumbnail;
    plainImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    thumbContainer.innerHTML = '';
    thumbContainer.appendChild(plainImg);
  }
}

// ── Qurate Button ────────────────────────────────────────────────

const wait = ms => new Promise(r => setTimeout(r, ms));

async function saveToQurate() {
  const qurateBtn = document.getElementById('qurate-btn');
  if (qurateBtn) qurateBtn.disabled = true;

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

  if (qurate) {
    const alreadyAdded = qurate.getAttribute('aria-label')?.toLowerCase().includes('selected') &&
                         !qurate.getAttribute('aria-label')?.toLowerCase().includes('not selected');

    if (alreadyAdded) {
      // Close the modal first
      const closeBtn = document.querySelector('tp-yt-paper-dialog #close-button button, [aria-label="Close"]');
      if (closeBtn) closeBtn.click();
      await wait(300);

      const remove = confirm('This video is already Qurated, would you like to remove it?');
      if (!remove) { if (qurateBtn) qurateBtn.disabled = false; return; }

      // Reopen modal and deselect
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
    // Create new playlist
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

      // Open visibility dropdown and select Public
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

      // Click Create only within the dialog
      const createBtn = dialog?.querySelector('button[aria-label="Create"]');
      if (createBtn) createBtn.click();
      await wait(600);
    }
  }

  // Close modal
  const closeBtn = document.querySelector('tp-yt-paper-dialog #close-button button, ytd-add-to-playlist-renderer + * [aria-label="Close"]');
  if (closeBtn) closeBtn.click();

  // Sync to Qr8 server
  if (QR8_USER) {
    const videoId = new URLSearchParams(location.search).get('v');
    const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || '';
    const channel = document.querySelector('ytd-channel-name #text')?.textContent?.trim() || '';
    const alreadyAdded = qurate && qurate.getAttribute('aria-label')?.toLowerCase().includes('selected') &&
                         !qurate.getAttribute('aria-label')?.toLowerCase().includes('not selected');
    if (videoId) {
      if (qurate && alreadyAdded) {
        // Was removed
        fetch(`${QR8_SERVER}/playlist`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: QR8_USER, video_id: videoId })
        });
      } else {
        // Was added
        fetch(`${QR8_SERVER}/playlist`, {
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
    background: none;
    border: 1px solid #aaa;
    border-radius: 18px;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 6px 16px;
    margin-right: auto;
    align-self: center;
  `;
  btn.addEventListener('click', saveToQurate);
  menuRenderer.insertBefore(btn, menuRenderer.firstChild);
}

function onNavigate() {
  document.getElementById('yt-pinned')?.remove();
  document.getElementById('qurate-btn')?.remove();
  injectPinned();
  injectQurateButton();
  setTimeout(() => { injectPinned(); injectQurateButton(); }, 1000);
  setTimeout(() => { injectPinned(); injectQurateButton(); }, 2500);
  setTimeout(() => { injectPinned(); injectQurateButton(); }, 5000);
}

// Handle YouTube SPA navigation
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
onNavigate();
