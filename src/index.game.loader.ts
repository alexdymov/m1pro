function injectScript(fileName: string): void {
  const runtime = (globalThis as { chrome?: { runtime?: { getURL?: (path: string) => string, sendMessage?: (msg: any, cb: (res: any) => void) => void } } }).chrome?.runtime;
  if (!runtime?.getURL) {
    return;
  }

  // Listen for fetch requests from the injected script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'M1PRO_FETCH_REQUEST' && event.data.url) {
      const msgId = event.data.id;
      const url = event.data.url as string;
      const post = (text?: string, error?: string) => {
        window.postMessage({
          type: 'M1PRO_FETCH_RESULT',
          id: msgId,
          text,
          error
        }, '*');
      };

      const tryBackground = () => {
        if (runtime.sendMessage) {
          runtime.sendMessage({
            type: 'M1PRO_FETCH_REQUEST',
            url
          }, (response: { text?: string; error?: string } | undefined) => {
            post(response?.text, response?.error);
          });
        } else {
          fetch(url, { credentials: 'omit' })
            .then(r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.text();
            })
            .then(text => post(text))
            .catch(err => post(undefined, err.message || 'Fetch failed'));
        }
      };

      // demos .mid is loaded only via iframe + postMessage in loadDemo (see game-state.ts).
      const isDemosMid = url.includes('demos.monopoly-one.com') && url.includes('.mid');
      if (isDemosMid) {
        post(undefined, 'demos.monopoly-one.com .mid: use iframe only (M1PRO loadDemo)');
        return;
      }
      tryBackground();
    }
  });

  if (document.querySelector(`script[data-m1pro="${fileName}"]`)) {
    return;
  }
  const script = document.createElement('script');
  script.src = runtime.getURL(fileName);
  script.async = false;
  script.dataset.m1pro = fileName;
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function startWhenReady(fileName: string): void {
  if (window.location.hostname === 'demos.monopoly-one.com') {
    const sendData = () => {
      if (window === window.parent) return;
      const text = document.body?.innerText || document.documentElement?.innerText || '';
      window.parent.postMessage(
        {
          type: 'M1PRO_DEMO_DATA',
          text: text
        },
        '*'
      );
    };
    const boot = () => {
      sendData();
      window.addEventListener('load', sendData, { once: true });
      let n = 0;
      const poll = window.setInterval(() => {
        const text = document.body?.innerText || document.documentElement?.innerText || '';
        if (text.length > 20 || n++ > 40) {
          window.clearInterval(poll);
          if (text.length > 20) {
            sendData();
          }
        }
      }, 200);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  } else {
    injectScript(fileName);
  }
}

startWhenReady('script.page.game.js');

export {};
