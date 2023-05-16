import removeJsExtension from './removeJsExtension';
export default function getCompleteAmdId(options, chunkId) {
    if (options.autoId) {
        return `${options.basePath ? options.basePath + '/' : ''}${removeJsExtension(chunkId)}`;
    }
    return options.id || '';
}
