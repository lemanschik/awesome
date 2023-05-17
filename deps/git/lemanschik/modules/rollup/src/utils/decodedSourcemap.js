import { decode } from 'sourcemap-codec';
export function decodedSourcemap(map) {
    if (!map)
        return null;
    if (typeof map === 'string') {
        map = JSON.parse(map);
    }
    if (map.mappings === '') {
        return {
            mappings: [],
            names: [],
            sources: [],
            version: 3
        };
    }
    const mappings = typeof map.mappings === 'string' ? decode(map.mappings) : map.mappings;
    return { ...map, mappings };
}
