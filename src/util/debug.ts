const enabled = localStorage.getItem('smart_cache_debug') === '1';
export const debug: (...args: any[]) => void = enabled
    ? console.log.bind(window.console, '%c[M1PRO] %c', 'color: red', 'color: unset')
    : function () { };

let contractDebugBannerShown = false;

/**
 * Verbose contract + `.mid` demo tracing. Enable in DevTools:
 * `localStorage.setItem('m1pro_contract_debug', '1')` then reload.
 * Disable: `localStorage.removeItem('m1pro_contract_debug')`
 */
export function contractDebug(...args: unknown[]): void {
    try {
        const v = typeof localStorage !== 'undefined' ? localStorage.getItem('m1pro_contract_debug') : '';
        if (v !== '1' && v !== 'true') {
            return;
        }
    } catch {
        return;
    }
    if (!contractDebugBannerShown) {
        contractDebugBannerShown = true;
        console.info(
            '[M1PRO contract] Debug logging is ON. Turn off: localStorage.removeItem("m1pro_contract_debug")'
        );
    }
    console.log('%c[M1PRO contract]', 'color:#e91e63;font-weight:bold', ...args);
}
