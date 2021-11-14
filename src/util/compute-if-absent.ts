
export const computeIfAbsent = <T, V>(map: Map<T, V>, key: T, supplier: (k: T) => V): V => {
    if (!map.has(key)) {
        map.set(key, supplier(key));
    }
    return map.get(key);
}