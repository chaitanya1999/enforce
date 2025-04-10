const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const EnForceResponse = Utils.EnForceResponse;
const SoapCall = Utils.SoapCall;
const debug = Utils.debug;
const fileStream = new console.Console(fs.createWriteStream(__dirname + '/../../output/AnonymousApex_log.txt'));

const ORG_NAME = '';

const apexCode = `
    System.debug('#$#$');
`;

class AnonymousApex{
    async main(codeToRun, orgName){
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = codeToFetch.getCreds(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds));
            console.log(res);
            debug("EXECUTING APEX");
            // res = await conn.tooling.executeAnonymous(apexCode);

            let eUrl = conn.instanceUrl + "/services/Soap/s/" + conn.version;
            debug('SOAP EndPoint = ' + eUrl);

            let soapEndpoint = new SoapCall(conn, {
                xmlns: "http://soap.sforce.com/2006/08/apex",
                endpointUrl: eUrl
            });

            let soapHeader = {
                DebuggingHeader: {
                    categories: [
                        {
                            category: 'Apex_code',
                            level: 'Finest',
                        },
                        {
                            category: 'Apex_profiling',
                            level: 'Finest',
                        },
                        {
                            category: 'System',
                            level: 'Fine',
                        }
                    ],
                    debugLevel: 'Detail'
                }
            };

            let result = await soapEndpoint.invoke('executeAnonymous', {
                'String': codeToRun
            }, soapHeader);
            let debugLog = result.debugLog;
            fileStream.log(debugLog);
            delete result.debugLog;

            debug("Completed. ");
            console.log(JSON.stringify(result, null, 4));
            result.debugLog = debugLog;
            return EnForceResponse.success(result);
        } catch(err){
            console.log(err);
            return EnForceResponse.failure();
        }
    }
}

module.exports = AnonymousApex;

if(require.main === module) {
    new AnonymousApex().main(apexCode, ORG_NAME);
}
