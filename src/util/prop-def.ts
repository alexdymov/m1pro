import { debug } from './debug';
export const propDefinedWindow = <T>(name: string): Promise<T> => {
    return propDefined(window, name);
}

export const propDefined = <T>(obj: any, name: string, timeoutms = 3000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timeout = timeoutms && setTimeout(() => {
            reject(`no var ${name} spawned`);
        }, timeoutms);
        Object.defineProperty(obj, name, {
            configurable: true,
            set(v) {
                Object.defineProperty(obj, name, { configurable: true, enumerable: true, writable: true, value: v });
                timeoutms && clearTimeout(timeout);
                resolve(v);
            }
        });
    });
}

export const propWaitWindow = <T>(name: string): Promise<T> => {
    return propWait(window, name);
}

export const propWait = <T>(obj: any, name: string, timeoutms = 3000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const i = setInterval(() => {
            timeoutms && clearTimeout(timeout);
            name in obj && (clearInterval(i), resolve(obj[name]));
        }, 100);
        const timeout = timeoutms && setTimeout(() => {
            clearInterval(i);
            reject(`no var ${name} spawned`);
        }, timeoutms);
    });
}