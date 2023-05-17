export function getOriginalLocation(sourcemapChain, location) {
    const filteredSourcemapChain = sourcemapChain.filter((sourcemap) => !!sourcemap.mappings);
    traceSourcemap: while (filteredSourcemapChain.length > 0) {
        const sourcemap = filteredSourcemapChain.pop();
        const line = sourcemap.mappings[location.line - 1];
        if (line) {
            const filteredLine = line.filter((segment) => segment.length > 1);
            const lastSegment = filteredLine[filteredLine.length - 1];
            for (const segment of filteredLine) {
                if (segment[0] >= location.column || segment === lastSegment) {
                    location = {
                        column: segment[3],
                        line: segment[2] + 1
                    };
                    continue traceSourcemap;
                }
            }
        }
        throw new Error("Can't resolve original location of error.");
    }
    return location;
}
