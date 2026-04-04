const PINNED = {
  id: 'dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
  channel: 'Rick Astley',
};
PINNED.url = 'https://www.youtube.com/watch?v=' + PINNED.id;
PINNED.thumbnail = 'https://i.ytimg.com/vi/' + PINNED.id + '/mqdefault.jpg';

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

function onNavigate() {
  document.getElementById('yt-pinned')?.remove();
  injectPinned();
  setTimeout(injectPinned, 1000);
  setTimeout(injectPinned, 2500);
  setTimeout(injectPinned, 5000);
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
