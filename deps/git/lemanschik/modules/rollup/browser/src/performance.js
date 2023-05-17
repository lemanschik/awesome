const global = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
export default 'performance' in global
    ? performance
    : {
        now() {
            return 0;
        }
    };
