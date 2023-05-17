export function getOrCreate(map, key, init) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const value = init();
    map.set(key, value);
    return value;
}
