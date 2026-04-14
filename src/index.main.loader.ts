function injectScript(fileName: string): void {
  const runtime = (globalThis as { chrome?: { runtime?: { getURL?: (path: string) => string, sendMessage?: (msg: unknown, cb: (res: unknown) => void) => void } } }).chrome?.runtime;
  if (!runtime?.getURL) {
    return;
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string; id?: string } | undefined;
    if (!data?.type || data.type !== 'M1PRO_FETCH_REQUEST' || !data.url) {
      return;
    }
    const post = (text?: string, error?: string) => {
      window.postMessage({
        type: 'M1PRO_FETCH_RESULT',
        id: data.id,
        text,
        error
      }, '*');
    };
    const tryBackground = () => {
      if (!runtime.sendMessage) {
        return;
      }
      runtime.sendMessage(
        { type: 'M1PRO_FETCH_REQUEST', url: data.url },
        (response: { text?: string; error?: string } | undefined) => {
          post(response?.text, response?.error);
        }
      );
    };
    const url = data.url;
    const isDemosMid = url.includes('demos.monopoly-one.com') && url.includes('.mid');
    if (isDemosMid) {
      post(undefined, 'demos.monopoly-one.com .mid: use iframe only (M1PRO loadDemo)');
      return;
    }
    tryBackground();
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
      // `*` so parent matches table on monopoly-one.com or www (isolated iframe cannot read parent URL).
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

startWhenReady('script.page.main.js');

export {};
