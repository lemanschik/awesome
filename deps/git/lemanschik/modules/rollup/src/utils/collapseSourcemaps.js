import { SourceMap } from 'magic-string';
import { error, errorSourcemapBroken } from './error';
import { basename, dirname, relative, resolve } from './path';
class Source {
    constructor(filename, content) {
        this.isOriginal = true;
        this.filename = filename;
        this.content = content;
    }
    traceSegment(line, column, name) {
        return { column, line, name, source: this };
    }
}
class Link {
    constructor(map, sources) {
        this.sources = sources;
        this.names = map.names;
        this.mappings = map.mappings;
    }
    traceMappings() {
        const sources = [];
        const sourceIndexMap = new Map();
        const sourcesContent = [];
        const names = [];
        const nameIndexMap = new Map();
        const mappings = [];
        for (const line of this.mappings) {
            const tracedLine = [];
            for (const segment of line) {
                if (segment.length === 1)
                    continue;
                const source = this.sources[segment[1]];
                if (!source)
                    continue;
                const traced = source.traceSegment(segment[2], segment[3], segment.length === 5 ? this.names[segment[4]] : '');
                if (traced) {
                    const { column, line, name, source: { content, filename } } = traced;
                    let sourceIndex = sourceIndexMap.get(filename);
                    if (sourceIndex === undefined) {
                        sourceIndex = sources.length;
                        sources.push(filename);
                        sourceIndexMap.set(filename, sourceIndex);
                        sourcesContent[sourceIndex] = content;
                    }
                    else if (sourcesContent[sourceIndex] == null) {
                        sourcesContent[sourceIndex] = content;
                    }
                    else if (content != null && sourcesContent[sourceIndex] !== content) {
                        return error({
                            message: `Multiple conflicting contents for sourcemap source ${filename}`
                        });
                    }
                    const tracedSegment = [segment[0], sourceIndex, line, column];
                    if (name) {
                        let nameIndex = nameIndexMap.get(name);
                        if (nameIndex === undefined) {
                            nameIndex = names.length;
                            names.push(name);
                            nameIndexMap.set(name, nameIndex);
                        }
                        tracedSegment[4] = nameIndex;
                    }
                    tracedLine.push(tracedSegment);
                }
            }
            mappings.push(tracedLine);
        }
        return { mappings, names, sources, sourcesContent };
    }
    traceSegment(line, column, name) {
        const segments = this.mappings[line];
        if (!segments)
            return null;
        // binary search through segments for the given column
        let searchStart = 0;
        let searchEnd = segments.length - 1;
        while (searchStart <= searchEnd) {
            const m = (searchStart + searchEnd) >> 1;
            const segment = segments[m];
            // If a sourcemap does not have sufficient resolution to contain a
            // necessary mapping, e.g. because it only contains line information, we
            // use the best approximation we could find
            if (segment[0] === column || searchStart === searchEnd) {
                if (segment.length == 1)
                    return null;
                const source = this.sources[segment[1]];
                if (!source)
                    return null;
                return source.traceSegment(segment[2], segment[3], segment.length === 5 ? this.names[segment[4]] : name);
            }
            if (segment[0] > column) {
                searchEnd = m - 1;
            }
            else {
                searchStart = m + 1;
            }
        }
        return null;
    }
}
function getLinkMap(warn) {
    return function linkMap(source, map) {
        if (map.mappings) {
            return new Link(map, [source]);
        }
        warn(errorSourcemapBroken(map.plugin));
        return new Link({
            mappings: [],
            names: []
        }, [source]);
    };
}
function getCollapsedSourcemap(id, originalCode, originalSourcemap, sourcemapChain, linkMap) {
    let source;
    if (!originalSourcemap) {
        source = new Source(id, originalCode);
    }
    else {
        const sources = originalSourcemap.sources;
        const sourcesContent = originalSourcemap.sourcesContent || [];
        const directory = dirname(id) || '.';
        const sourceRoot = originalSourcemap.sourceRoot || '.';
        const baseSources = sources.map((source, index) => new Source(resolve(directory, sourceRoot, source), sourcesContent[index]));
        source = new Link(originalSourcemap, baseSources);
    }
    return sourcemapChain.reduce(linkMap, source);
}
export function collapseSourcemaps(file, map, modules, bundleSourcemapChain, excludeContent, warn) {
    const linkMap = getLinkMap(warn);
    const moduleSources = modules
        .filter(module => !module.excludeFromSourcemap)
        .map(module => getCollapsedSourcemap(module.id, module.originalCode, module.originalSourcemap, module.sourcemapChain, linkMap));
    const link = new Link(map, moduleSources);
    const source = bundleSourcemapChain.reduce(linkMap, link);
    let { sources, sourcesContent, names, mappings } = source.traceMappings();
    if (file) {
        const directory = dirname(file);
        sources = sources.map((source) => relative(directory, source));
        file = basename(file);
    }
    sourcesContent = (excludeContent ? null : sourcesContent);
    return new SourceMap({ file, mappings, names, sources, sourcesContent });
}
export function collapseSourcemap(id, originalCode, originalSourcemap, sourcemapChain, warn) {
    if (sourcemapChain.length === 0) {
        return originalSourcemap;
    }
    const source = getCollapsedSourcemap(id, originalCode, originalSourcemap, sourcemapChain, getLinkMap(warn));
    const map = source.traceMappings();
    return { version: 3, ...map };
}
