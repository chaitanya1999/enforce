import * as getBodySize from './GetBodySize';
import * as typeCheck from './TypeCheck'
import * as jsforce from 'jsforce';

export class SOAP {
    _endpointUrl;
    _xmlns;
    _conn;
    constructor(conn : jsforce.Connection, options : any) {
        this._conn = conn;
        this._endpointUrl = options.endpointUrl;
        this._xmlns = options.xmlns || 'urn:partner.soap.sforce.com';
    }
    /**
     * Invoke SOAP call using method and arguments
     */
    async invoke(method : string, args : any, soapHeaders : any, schema? : any, schemaDict? : any) {
        let soapReq = <any>{
            method: 'POST',
            url: this._endpointUrl,
            headers: {
                'Content-Type': 'text/xml',
                SOAPAction: '""',
            },
            _message: { [method]: args },
            soapHeaders : soapHeaders
        };
        this.beforeSend(soapReq);
        const res = await this._conn.request(soapReq);
        return schema ? castTypeUsingSchema(res, schema, schemaDict) : res;
    }
    /** @override */
    beforeSend(request : any) {
        request.body = this._createEnvelope(request._message, request.soapHeaders);
        const headers = request.headers || {};
        const bodySize = (0, getBodySize.getBodySize)(request.body, request.headers);
        if (request.method === 'POST' &&
            !('transfer-encoding' in headers) &&
            !('content-length' in headers) &&
            !!bodySize) {
            console.log(`missing 'content-length' header, setting it to: ${bodySize}`);
            headers['content-length'] = String(bodySize);
        }
        request.headers = headers;
    }
    /** @override **/
    isSessionExpired(response : any) {
        return (response.statusCode === 500 &&
            /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/.test(response.body));
    }
    /** @override **/
    parseError(body : any) {
        const error = lookupValue(body, [/:Envelope$/, /:Body$/, /:Fault$/]);
        return {
            errorCode: error.faultcode,
            message: error.faultstring,
        };
    }
    
    /** @override **/
    // async getResponseBody(response : any) {
    //     const body = await super.getResponseBody(response);
    //     return lookupValue(body, [/:Envelope$/, /:Body$/, /.+/]);
    // }
    /**
     * @private
     */
    _createEnvelope(message: any, soapHeaders?: any) {
        const header : any = soapHeaders || {};
        const conn = this._conn;
        if (conn.accessToken) {
            header.SessionHeader = { sessionId: conn.accessToken };
        }
        if (conn._callOptions) {
            header.CallOptions = conn._callOptions;
        }
        return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
            ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
            ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
            '<soapenv:Header xmlns="' + this._xmlns + '">',
            toXML(header),
            '</soapenv:Header>',
            '<soapenv:Body xmlns="' + this._xmlns + '">',
            toXML(message),
            '</soapenv:Body>',
            '</soapenv:Envelope>',
        ].join('');
    }
}

function toXML(name: any, value? : any) : string {
    if ((0, typeCheck.isObject)(name)) {
        value = name;
        name = null;
    }
    if (Array.isArray(value)) {
        return value.map((v) => toXML(name, v)).join('');
    }
    else {
        const attrs = [];
        if (value === null) {
            attrs.push('xsi:nil="true"');
            value = '';
        }
        else if ((0, typeCheck.isMapObject)(value)) {
            const elems = [];
            for (const k of Object.keys(value)) {
                const v = value[k];
                if (k.startsWith('@')) {
                    const kk = k.substring(1);
                    attrs.push(`${kk}="${v}"`);
                }
                else {
                    elems.push(toXML(k, v));
                }
            }
            value = elems.join('');
        }
        else {
            value = String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
        const startTag = name
            ? '<' + name + (attrs.length > 0 ? ' ' + attrs.join(' ') : '') + '>'
            : '';
        const endTag = name ? '</' + name + '>' : '';
        return startTag + value + endTag;
    }
}

function castTypeUsingSchema(value : any, schema : any, schemaDict : any  = {}) : any {
    if (Array.isArray(schema)) {
        const nillable = schema.length === 2 && schema[0] === '?';
        const schema_ = nillable ? schema[1] : schema[0];
        if (value == null) {
            return nillable ? null : [];
        }
        return (Array.isArray(value) ? value : [value]).map((v) => castTypeUsingSchema(v, schema_, schemaDict));
    }
    else if ((0, typeCheck.isMapObject)(schema)) {
        // if schema is Schema Definition, not schema element
        if ('type' in schema && 'props' in schema && (0, typeCheck.isMapObject)(schema.props)) {
            const props = getPropsSchema(schema, schemaDict);
            return castTypeUsingSchema(value, props, schemaDict);
        }
        const nillable = '?' in schema;
        const schema_ = '?' in schema ? schema['?'] : schema;
        if (nillable && isNillValue(value)) {
            return null;
        }
        const obj = (0, typeCheck.isMapObject)(value) ? value : {};
        return Object.keys(schema_).reduce((o, k) => {
            const s = schema_[k];
            const v = obj[k];
            const nillable = (Array.isArray(s) && s.length === 2 && s[0] === '?') ||
                ((0, typeCheck.isMapObject)(s) && '?' in s) ||
                (typeof s === 'string' && s.startsWith('?'));
            if (typeof v === 'undefined' && nillable) {
                return o;
            }
            return {
                ...o,
                [k]: castTypeUsingSchema(v, s, schemaDict),
            };
        }, obj);
    }
    else {
        const nillable = typeof schema === 'string' && schema.startsWith('?');
        const type = typeof schema === 'string'
            ? nillable
                ? schema.substring(1)
                : schema
            : 'any';
        switch (type) {
            case 'string':
                return isNillValue(value) ? (nillable ? null : '') : String(value);
            case 'number':
                return isNillValue(value) ? (nillable ? null : 0) : Number(value);
            case 'boolean':
                return isNillValue(value)
                    ? nillable
                        ? null
                        : false
                    : value === 'true';
            case 'null':
                return null;
            default: {
                if (schemaDict[type]) {
                    const cvalue = castTypeUsingSchema(value, schemaDict[type], schemaDict);
                    const isEmpty = (0, typeCheck.isMapObject)(cvalue) && Object.keys(cvalue).length === 0;
                    return isEmpty && nillable ? null : cvalue;
                }
                return value;
            }
        }
    }
}

function lookupValue(obj : any, propRegExps : any) {
    const regexp = propRegExps.shift();
    if (!regexp) {
        return obj;
    }
    if ((0, typeCheck.isMapObject)(obj)) {
        for (const prop of Object.keys(obj)) {
            if (regexp.test(prop)) {
                return lookupValue(obj[prop], propRegExps);
            }
        }
        return null;
    }
}

function getPropsSchema(schema : any, schemaDict : any) : any {
    if (schema.extends && schemaDict[schema.extends]) {
        const extendSchema = schemaDict[schema.extends];
        return {
            ...getPropsSchema(extendSchema, schemaDict),
            ...schema.props,
        };
    }
    return schema.props;
}

function isNillValue(value : any) {
    return (value == null ||
        ((0, typeCheck.isMapObject)(value) &&
            (0, typeCheck.isMapObject)(value.$) &&
            value.$['xsi:nil'] === 'true'));
}