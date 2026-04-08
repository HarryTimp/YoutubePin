// Runs in page context — reads YouTube's config and dispatches account name
(() => {
  function dispatch() {
    const name = window?.yt?.config_?.USER_ACCOUNT_NAME || null;
    window.dispatchEvent(new CustomEvent('qr8-username', { detail: { name } }));
  }

  // Try immediately (may already be set if yt has initialised)
  dispatch();

  // Also fire once YouTube's data is ready, in case it wasn't set yet
  window.addEventListener('yt-page-data-updated', dispatch, { once: true });
})();
