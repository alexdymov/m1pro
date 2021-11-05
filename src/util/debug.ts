export class Debug {
    static enabled: boolean = localStorage.getItem('smart_cache_debug') === '1';
}

export function debug(...args: any[]): void {
    const str = ['%c[M1E]', '%c'].join(' ');
    if (Debug.enabled) console.log.apply(null, [str, 'color: red', 'color: unset', ...args]);
}

