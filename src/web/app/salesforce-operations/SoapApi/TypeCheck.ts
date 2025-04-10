export function isObject(v : any) {
    const t = typeof v;
    return v != null && (t == 'object' || t == 'function');
}
export function isMapObject(v : any) {
    const t = typeof v;
    return v != null && t == 'object';
}
export function isFunction(v : any) {
    return typeof v == 'function';
}
export function isNumber(v : any) {
    return typeof v == 'number';
}
/**
 * Detect whether the value has CommonJS Promise/A+ interface or not
 */
export function isPromiseLike(v : any) {
    return isObject(v) && isFunction(v.then);
}
export function identityFunc(a : any) {
    return a;
}
export function emptyFunc() { }