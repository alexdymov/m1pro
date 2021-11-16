const enabled = localStorage.getItem('smart_cache_debug') === '1';
export const debug: (...args: any[]) => void = enabled
    ? console.log.bind(window.console, '%c[M1PRO] %c', 'color: red', 'color: unset')
    : function () { };
