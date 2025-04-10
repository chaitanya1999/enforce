import * as jsforce from 'jsforce';
import {sfApiVersion} from '../salesforce.service';
import Utils,{EnForceResponse} from '../enforce-utils';
import { SOAP } from './SoapApi/SfSoap';
const debug = Utils.debug;

export class AnonymousApex {
    async main(codeToRun : string, orgName : string){
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = Utils.getOrg(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds, true));
            console.log(res);
            debug("EXECUTING APEX");
            // res = await conn.tooling.executeAnonymous(apexCode);

            let eUrl = conn.instanceUrl + "/services/Soap/s/" + conn.version;
            debug('SOAP EndPoint = ' + eUrl);

            let soapEndpoint = new SOAP(conn, {
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
            delete result.debugLog;

            debug("Completed. ");
            console.log(JSON.stringify(result, null, 4));
            result.debugLog = debugLog;
            return EnForceResponse.success(result);
        } catch(err){
            console.log(err);
            return EnForceResponse.failure(err);
        }
    }
}