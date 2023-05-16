import { createHash as cryptoCreateHash } from 'node:crypto';
export const createHash = () => cryptoCreateHash('sha256');
