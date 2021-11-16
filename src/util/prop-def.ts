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