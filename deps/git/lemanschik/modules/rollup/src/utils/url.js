export function isValidUrl(url) {
    try {
        new URL(url);
    }
    catch {
        return false;
    }
    return true;
}
