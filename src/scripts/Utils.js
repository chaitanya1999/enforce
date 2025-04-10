
const sfApiVersion = '52.0';
const fs = require('fs');
const jsforce = require('jsforce');
const { inherits } = require('util');
// const SOAP = jsforce.require('./soap');
const _ = require('lodash/core');

var orgCreds = JSON.parse(fs.readFileSync('/../../data/credentials.json') || '{}');
// console.log(orgCreds);

SESSION_DATA_FILE = '/../../data/sessionData.json';

async function handleLogin(conn, creds) {
    let sessions = loadSessionsData();
    let result = null;
    try {
        debug('Auth - ' + creds.authMode);
        if (sessions[creds.orgName]) {
            // debug("Found Existing Session");
            let session = sessions[creds.orgName];
            conn = new jsforce.Connection({
                loginUrl: creds.loginUrl,
                instanceUrl: session.instanceUrl,
                accessToken: session.accessToken,
                version: conn.version
            });
            result = session.loginResult;
            await conn.identity();
            debug("Session relogged succesfully");
        } else {
            throw new Error("Session not found");
        }
    } catch (err) {
        // debug("Invalid session/Session not found. SOAP LOGIN.");
        debug(err.message);
        if(creds.authMode == 'soapLogin' || !creds.authMode) {
            result = await conn.login(creds.username, creds.password);
            debug("SOAP Login Succesful");
        } else {
            conn = new jsforce.Connection({
                loginUrl: creds.loginUrl,
                instanceUrl: creds.instanceUrl,
                accessToken: creds.accessToken,
                version: conn.version
            });
            let session = sessions[creds.orgName];
            let identityResult = await conn.identity();
            result = session?.loginResult || {
                "id": identityResult.user_id,
                "organizationId": identityResult.organization_id,
                "url": `https://test.salesforce.com/id/${identityResult.organization_id}/${identityResult.user_id}`
            };
            debug('New access token - authentication succesful');
        }
        sessions[creds.orgName] = {
            instanceUrl: conn.instanceUrl,
            accessToken: conn.accessToken,
            loginResult: result
        }
    }
    saveSessionData(sessions);
    return { res: result, conn: conn };
}

function getInstanceURL(orgName) {
    let sessions = loadSessionsData();
    return sessions[orgName]?.instanceUrl;
}

function loadSessionsData() {
    try {
        let content = fs.readFileSync(__dirname + SESSION_DATA_FILE);
        return JSON.parse(content);
    } catch (err) {
        return {};
    }
}

function saveSessionData(sessions) {
    fs.writeFileSync(__dirname + SESSION_DATA_FILE, JSON.stringify(sessions, null, "\t"));
}

function debug(x) {
    console.log(new Date().toLocaleString() + ' | ' + x);
}

function arrayToInClauseRHS(arr, quotes) {
    let inClauseRHS = ' (';
    let first = true;
    arr.forEach((str) => { inClauseRHS += (first ? ' ' : ', ') + quoter(str, quotes) + ' '; first = false; });
    inClauseRHS += ') ';
    return inClauseRHS;
}

function quoter(str, quotes) {
    return quotes ? `'${str}'` : str;
}

function titleCase(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
}

function convertToTableData(sfRecords) {
    let tableData = { data: [], columns: [] };

    //filter nested objects
    sfRecords = sfRecords.map(rec => { for (let r in rec) if (rec[r] && typeof rec[r] == 'object') delete rec[r]; return rec; })

    //accumulate columns
    tableData.columns = Object.keys(sfRecords[0]).map(str => { return { data: str, title: str } });

    //accumulate rows
    tableData.data = sfRecords;

    return tableData;
}

// OVERRIDE SOAP METHODS OF JSFORCE
/*
function SoapCall() {
    SoapCall.super_.apply(this, arguments);
}
Object.setPrototypeOf(SoapCall.prototype, SOAP.prototype);
inherits(SoapCall, SOAP);
SoapCall.prototype.getResponseBody = function (response) {
    let body = SOAP.super_.prototype.getResponseBody.call(this, response);
    return {
        ...lookupValue(body, [/:Envelope$/, /:Body$/, /.+/]),
        ...lookupValue(body, [/:Envelope$/, /:Header$/, /.+/]),
    }
};

SoapCall.prototype.invoke = function (method, args, soapHeaders, schema, callback) {
    if (typeof schema === 'function') {
        callback = schema;
        schema = null;
    }
    var message = {};
    message[method] = args;
    return this.request({
        method: 'POST',
        url: this._endpointUrl,
        headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': '""'
        },
        message: message,
        soapHeaders: soapHeaders
    }).then(function (res) {
        return schema ? convertType(res, schema) : res;
    }).thenCall(callback);
};

SoapCall.prototype.beforeSend = function (request) {
    request.body = this._createEnvelope(request.message, request.soapHeaders);
};

SoapCall.prototype._createEnvelope = function (message, header) {
    header = header || {};
    var conn = this._conn;
    if (conn.accessToken) {
        header.SessionHeader = { sessionId: this._conn.accessToken };
    }
    if (conn.callOptions) {
        header.CallOptions = conn.callOptions;
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
        '</soapenv:Envelope>'
    ].join('');
};
function lookupValue(obj, propRegExps) {
    var regexp = propRegExps.shift();
    if (!regexp) {
        return obj;
    }
    else {
        for (var prop in obj) {
            if (regexp.test(prop)) {
                return lookupValue(obj[prop], propRegExps);
            }
        }
        return null;
    }
}

function toXML(name, value) {
    if (_.isObject(name)) {
        value = name;
        name = null;
    }
    if (_.isArray(value)) {
        return _.map(value, function (v) { return toXML(name, v); }).join('');
    } else {
        var attrs = [];
        var elems = [];
        if (_.isObject(value)) {
            for (var k in value) {
                var v = value[k];
                if (k[0] === '@') {
                    k = k.substring(1);
                    attrs.push(k + '="' + v + '"');
                } else {
                    elems.push(toXML(k, v));
                }
            }
            value = elems.join('');
        } else {
            value = String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
        var startTag = name ? '<' + name + (attrs.length > 0 ? ' ' + attrs.join(' ') : '') + '>' : '';
        var endTag = name ? '</' + name + '>' : '';
        return startTag + value + endTag;
    }
}

function convertType(value, schema) {
    if (_.isArray(value)) {
        return value.map(function (v) {
            return convertType(v, schema && schema[0])
        });
    } else if (_.isObject(value)) {
        if (value.$ && value.$['xsi:nil'] === 'true') {
            return null;
        } else if (_.isArray(schema)) {
            return [convertType(value, schema[0])];
        } else {
            var o = {};
            for (var key in value) {
                o[key] = convertType(value[key], schema && schema[key]);
            }
            return o;
        }
    } else {
        if (_.isArray(schema)) {
            return [convertType(value, schema[0])];
        } else if (_.isObject(schema)) {
            return {};
        } else {
            switch (schema) {
                case 'string':
                    return String(value);
                case 'number':
                    return Number(value);
                case 'boolean':
                    return value === 'true';
                default:
                    return value;
            }
        }
    }
}
*/
//END SOAP METHODS OVERRIDING

class EnForceResponse {
    isSuccess = true;
    errors = [];
    data = null;

    constructor(isSuccess, errors, data) {
        this.isSuccess = isSuccess;
        this.errors = errors;
        this.data = data;
    }

    static success(data){
        return new EnForceResponse(true, null, data);
    }

    static failure(errors, optionalData){
        if(!Array.isArray(errors))
            errors = [errors];
        return new EnForceResponse(false, errors, optionalData || null);
    }
}

let aura_suffixMap = {
    'COMPONENT' : '.cmp',
    'CONTROLLER' : 'Controller.js',
    'HELPER' : 'Helper.js',
    'STYLE' : '.css',
    'RENDERER' : 'Renderer.js',
    'EVENT' : '.evt',
    'DOCUMENTATION' : '.auradoc',
    'DESIGN' : '.design',
    'SVG' : '.svg'
}

function getAllOrgs() {
    return orgCreds;
}
function loadAllOrgs() {
    orgCreds = JSON.parse(fs.readFileSync('./credentials.json') || '{}');
}
function getOrg(orgName) {
    return {
        ...orgCreds[orgName],
        orgName: orgName
    };
}


module.exports = { handleLogin, loadSessionsData, saveSessionData, debug, arrayToInClauseRHS, quoter, titleCase, convertToTableData, /*SoapCall,*/ EnForceResponse, aura_suffixMap, getInstanceURL, getAllOrgs, getOrg, loadAllOrgs };