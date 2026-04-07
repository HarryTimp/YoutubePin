(function() {
  let PINNED = null;

  console.log('Qr8: injected.js running');

  window.addEventListener('message', function(e) {
    if (e.source === window && e.data?.type === 'QR8_SET_PINNED') {
      PINNED = e.data.pinned;
      console.log('Qr8: PINNED received —', PINNED?.title);
    }
  });

  // Signal to content.js that we are ready to receive PINNED
  window.dispatchEvent(new CustomEvent('qr8_injected_ready'));
  console.log('Qr8: dispatched qr8_injected_ready');

  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

    if (url && url.includes('youtube.com/youtubei/v1/next')) {
      console.log('Qr8: /next intercepted, PINNED =', PINNED ? PINNED.title : 'null');
    }

    if (url && url.includes('youtube.com/youtubei/v1/next') && PINNED) {
      console.log('Qr8: attempt to load in feed —', PINNED.title);
      return originalFetch.apply(this, args).then(async response => {
        try {
          const json = await response.clone().json();
          // Try old path first, then new onResponseReceivedEndpoints path
          let results = json?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results;

          if (!results) {
            // New YouTube format — dig into onResponseReceivedEndpoints
            const endpoints = json?.onResponseReceivedEndpoints;
            console.log('Qr8: onResponseReceivedEndpoints length =', endpoints?.length);
            if (endpoints) {
              for (const ep of endpoints) {
                console.log('Qr8: endpoint keys =', Object.keys(ep));
                const mutation = ep?.reloadContinuationItemsCommand || ep?.appendContinuationItemsAction;
                if (mutation?.targetId?.includes('secondary') || mutation?.continuationItems) {
                  results = mutation.continuationItems;
                  console.log('Qr8: found results via continuationItems, length =', results?.length);
                  break;
                }
              }
            }
          }

          console.log('Qr8: results array found =', !!results, results?.length);

          if (results) {
            results.unshift({
              compactVideoRenderer: {
                videoId: PINNED.id,
                title: { simpleText: '[Qr8] ' + PINNED.title },
                thumbnail: {
                  thumbnails: [{ url: PINNED.thumbnail, width: 320, height: 180 }]
                },
                shortBylineText: { simpleText: PINNED.channel },
                viewCountText: { simpleText: 'Curated pick' },
                lengthText: { simpleText: '' },
                navigationEndpoint: {
                  commandMetadata: {
                    webCommandMetadata: { url: '/watch?v=' + PINNED.id }
                  }
                }
              }
            });
          }

          return new Response(JSON.stringify(json), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (err) {
          return response;
        }
      });
    }

    return originalFetch.apply(this, args);
  };
})();
