export const keypath = (keypath, getPropertyAccess) => keypath.split('.').map(getPropertyAccess).join('');
