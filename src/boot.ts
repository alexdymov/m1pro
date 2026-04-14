type MainWaterfall = {
  run: (fn: () => void) => void;
};

declare global {
  interface Window {
    mainWaterfall?: MainWaterfall;
  }
}

export function bootWithMainWaterfall(run: () => void): void {
  const boot = (wf: MainWaterfall): void => {
    wf.run(() => {
      run();
    });
  };

  if ('mainWaterfall' in window) {
    boot(window.mainWaterfall as MainWaterfall);
    return;
  }

  Object.defineProperty(window, 'mainWaterfall', {
    configurable: true,
    set(value: MainWaterfall) {
      Object.defineProperty(window, 'mainWaterfall', {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
      boot(value);
    }
  });
}
