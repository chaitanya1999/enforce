import * as jsforce from 'jsforce';
import { environment } from './environment';

export default class Utils {

    static enableLogging = true;

    static aura_suffixMap : any = {
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

    static debug(...x : any) {
        if(Utils.enableLogging)
            console.log(new Date().toLocaleString() + ' | ' + x);
    }

    static async handleLogin(conn : jsforce.Connection, creds : any, useProxy? : boolean) : Promise<any> {
        let desktopMode = (<any>window).desktopMode;
        let sessions = Utils.loadSessionsData();
        let result = null;
        try {
            Utils.debug('Auth - ' + creds.authMode + ' | desktop = ' + desktopMode);
            if (sessions[creds.orgName]) {
                // Utils.debug("Found Existing Session");
                let session = sessions[creds.orgName];
                conn = Utils.newJsforceConnection({
                    loginUrl: creds.loginUrl,
                    instanceUrl: session.instanceUrl,
                    accessToken: session.accessToken,
                    version: conn.version
                }, useProxy);
                result = session.loginResult;
                let identityResult : any;
                if(desktopMode) {
                    identityResult = await conn.identity();
                } else {
                    identityResult = await conn.requestGet((creds.instanceUrl || conn.instanceUrl) + '/services/oauth2/userinfo', {});
                }
                Utils.debug("Session relogged succesfully");
            } else {
                throw new Error("Session not found");
            }
        } catch (err : any) {
            // Utils.debug("Invalid session/Session not found. SOAP LOGIN.");
            Utils.debug(err.message);
            if(creds.authMode == 'soapLogin' || !creds.authMode) {
                if(desktopMode) {
                    result = await conn.login(creds.username, creds.password);
                    Utils.debug("SOAP Login Succesful");
                } else {
                    
                    Utils.debug("Proxy SOAP Login");
                    let conn1;
                    ({result, conn1} = await Utils.proxySoapLogin(conn, creds));
                    Utils.debug("SOAP Login Succesful");

                    if(useProxy) {
                        conn = conn1;
                    }
                    else {
                        conn.accessToken = conn1.accessToken;
                        conn.instanceUrl = conn1.instanceUrl;
                    }
                }
            } else {
                Utils.debug('access token authentication ' , JSON.stringify(creds));
                conn = Utils.newJsforceConnection({
                    // loginUrl: creds.loginUrl,
                    instanceUrl: creds.instanceUrl,
                    accessToken: creds.accessToken,
                    version: conn.version
                }, useProxy);
                let session = sessions[creds.orgName];
                let identityResult : any;
                if(desktopMode) {
                    identityResult = await conn.identity();
                } else {
                    identityResult = await conn.requestGet((creds.instanceUrl || conn.instanceUrl) + '/services/oauth2/userinfo', {});
                }
                result = session?.loginResult || {
                    "id": identityResult.user_id,
                    "organizationId": identityResult.organization_id,
                    "url": `https://test.salesforce.com/id/${identityResult.organization_id}/${identityResult.user_id}`
                };
                Utils.debug('New access token - authentication succesful');
            }
            sessions[creds.orgName] = {
                instanceUrl: conn.instanceUrl,
                accessToken: conn.accessToken,
                loginResult: result
            }
        }
        Utils.saveSessionData(sessions);
        return { res: result, conn: conn };
    }

    static newJsforceConnection(options : any, corsProxy : boolean = false) {
        if(corsProxy) {
            options.proxyUrl = (environment.production ? '/proxy' : 'http://localhost/proxy');
        }
        return new jsforce.Connection(options);
    }

    static async proxySoapLogin( conn : jsforce.Connection , creds : any) : Promise<any> {
        Utils.debug('proxySoapLogin - ' + environment.production);
        let conn1 = Utils.newJsforceConnection({
            loginUrl: creds.loginUrl,
            version: conn.version
        }, true);
        let result = await conn1.login(creds.username, creds.password);
        return {result, conn1};
    }

    static loadSessionsData() : any {
        let session = localStorage.getItem('sessionData');
		if(!session) {
			localStorage.setItem('sessionData', session='{}');
		}
		return JSON.parse(session);
    }

    static saveSessionData(sessions : any) {
        localStorage.setItem('sessionData', JSON.stringify(sessions));
    }

    static getAllOrgs() {
        let orgs : any = localStorage.getItem('configuredOrgs');
		if(!orgs) {
			localStorage.setItem('configuredOrgs', orgs = `{}`);
		}
		orgs = JSON.parse(orgs)
		// for(let key in orgs) {
		// 	orgs[key].orgName = key;
		// }
		return orgs;
    }

    static setAllOrgs(orgs : any) {
        localStorage.setItem('configuredOrgs', JSON.stringify(orgs));
    }

    static getOrg(orgName : string) {
        let org = Utils.getAllOrgs();
        return {
            ...org[orgName],
            orgName : orgName
        }
    }

    static arrayToInClauseRHS(arr : any, quotes : any) {
        let inClauseRHS = ' (';
        let first = true;
        arr.forEach((str : string) => { inClauseRHS += (first ? ' ' : ', ') + Utils.quoter(str, quotes) + ' '; first = false; });
        inClauseRHS += ') ';
        return inClauseRHS;
    }
    
    static quoter(str : string, quotes : boolean) {
        return quotes ? `'${str}'` : str;
    }
    
    static titleCase(txt : string) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }

}

export class EnForceResponse {
    isSuccess : boolean = true;
    errors : any[] = [];
    data : any = null;

    constructor(isSuccess : boolean, errors : any, data : any) {
        this.isSuccess = isSuccess;
        this.errors = errors;
        this.data = data;
    }

    static success(data : any){
        return new EnForceResponse(true, null, data);
    }

    static failure(errors : any, optionalData? : any){
        if(!Array.isArray(errors))
            errors = [errors];
        return new EnForceResponse(false, errors, optionalData || null);
    }
}