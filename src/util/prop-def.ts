const propDefined = <T>(name: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(`no var ${name} spawned on window`);
        }, 3000);
        Object.defineProperty(window, name, {
            configurable: true,
            set(v) {
                Object.defineProperty(window, name, { configurable: true, enumerable: true, writable: true, value: v });
                clearTimeout(timeout);
                resolve(v);
            }
        });
    });
}

export default propDefined;