declare var chrome: any;

chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.type === 'M1PRO_FETCH_REQUEST' && request.url) {
    if (typeof request.url === 'string' && request.url.includes('demos.monopoly-one.com')) {
      sendResponse({ error: 'demos.monopoly-one.com: use iframe only (M1PRO loadDemo)' });
      return true;
    }
    fetch(request.url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      // Some CDNs are less hostile when the request looks like it comes from the main site.
      headers: {
        Referer: 'https://monopoly-one.com/table/',
        'Cache-Control': 'no-cache'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        sendResponse({ text: text });
      })
      .catch(error => {
        sendResponse({ error: error.message || 'Fetch failed' });
      });
    return true; // Indicates we will send response asynchronously
  }
});