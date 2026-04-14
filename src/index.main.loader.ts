function injectScript(fileName: string): void {
  const runtime = (globalThis as { chrome?: { runtime?: { getURL?: (path: string) => string } } }).chrome?.runtime;
  if (!runtime?.getURL) {
    return;
  }
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
  injectScript(fileName);
}

startWhenReady('script.page.main.js');

export {};
