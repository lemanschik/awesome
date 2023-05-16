import { error, errorNoFileSystemInBrowser } from '../../src/utils/error';
export const throwNoFileSystem = (method) => () => error(errorNoFileSystemInBrowser(method));
