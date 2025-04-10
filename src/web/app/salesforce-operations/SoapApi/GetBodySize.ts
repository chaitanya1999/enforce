import is_1 from '@sindresorhus/is';
export function getBodySize(body : any, headers = {}) {
    function isFormData(body : any) {
        return is_1.nodeStream(body) && is_1.function_((<any>body).getBoundary);
    }
    if (headers && 'content-length' in headers) {
        return Number(headers['content-length']);
    }
    if (!body) {
        return 0;
    }
    if (is_1.string(body)) {
        return Buffer.byteLength(body);
    }
    if (is_1.urlSearchParams(body)) {
        return Buffer.byteLength(body.toString());
    }
    if (is_1.buffer(body)) {
        return body.length;
    }
    try {
        // `getLengthSync` will throw if body has a stream:
        // https://github.com/form-data/form-data#integer-getlengthsync
        if (isFormData(body)) {
            return body.getLengthSync();
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}