import * as jsforce from 'jsforce';
import { environment } from './environment';
import { AppConstants, CodeEntity } from './AppConstants';
import { AppComponent } from './app.component';

export default class Utils {

    static AUTH_MODE_SOAP_LOGIN = 'soapLogin';
    static AUTH_MODE_ACCESS_TOKEN = 'accessToken';

    static enableLogging = true;

    static aura_suffixMap : any = {
        'COMPONENT' : '.cmp',
        'APPLICATION' : '.app',
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

    static async handleLogin(conn : jsforce.Connection, creds : any, useProxy : boolean = false) : Promise<any> {
        //CORS proxy server used for - SOAP login , validating access token using userinfo oauth api

        let sessions = Utils.loadSessionsData();
        let result = null;
        try {
            Utils.debug('Auth - ' + creds.authMode);
            if (sessions[creds.orgName] && creds.authMode == Utils.AUTH_MODE_SOAP_LOGIN) {

                let session = sessions[creds.orgName];
                conn = Utils.newJsforceConnection({
                    loginUrl: creds.loginUrl,
                    instanceUrl: session.instanceUrl,
                    accessToken: session.accessToken,
                    version: conn.version,
                    refreshFn: async(conn : jsforce.Connection, callback : any) => {
                        try {
                            console.log('#$#$ reAuth');
                            // re-auth to get a new access token

                            let result;
                            if(creds.authMode == Utils.AUTH_MODE_SOAP_LOGIN || !creds.authMode) {
                                ({result, conn} = await Utils.auth_soapLogin(conn, creds, !!(useProxy || creds.corsProxy) ));
                                let sessions = Utils.loadSessionsData();
                                sessions[creds.orgName] = {
                                    instanceUrl: conn.instanceUrl,
                                    accessToken: conn.accessToken,
                                    loginResult: result
                                }
                                Utils.saveSessionData(sessions);
                            }

                            if (!conn.accessToken) {
                                throw new Error('Access token not found after login');
                            }

                            console.log("#$#$ reAuth Token refreshed")

                            // 1st arg can be an `Error` or null if successful
                            // 2nd arg should be the valid access token
                            callback(null, conn.accessToken);
                        } catch (err) {
                            if (err instanceof Error) {
                                callback(err);
                            } else {
                                throw err;
                            }
                        }
                    }
                }, useProxy || creds.corsProxy);
                result = session.loginResult;

                Utils.debug("Session reusing");
            } else {
                throw new Error("Session not found");
            }

        } catch (err : any) {
            // Utils.debug("Invalid session/Session not found. SOAP LOGIN.");
            Utils.debug(err.message);
            if(creds.authMode == Utils.AUTH_MODE_SOAP_LOGIN || !creds.authMode) {
                    
                Utils.debug("Proxy SOAP Login");
                ({result , conn} = await Utils.auth_soapLogin(conn, creds, !!(useProxy || creds.corsProxy) ));
                
            } else { //for now only access token authentication

                Utils.debug('access token authentication ' , JSON.stringify(creds));
                ({result , conn} = await Utils.auth_accessToken(conn, creds, !!(useProxy || creds.corsProxy) ));
                
                                
                // result = session?.loginResult || {
                //     "id": identityResult.user_id,
                //     "organizationId": identityResult.organization_id,
                //     "url": `https://test.salesforce.com/id/${identityResult.organization_id}/${identityResult.user_id}`
                // };
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

    //Centralized method used to create new jsforce connection object to set proxy URL according to prod/lower env and corsProxy parameter
    static newJsforceConnection(options : any, corsProxy : boolean = false) {
        if(corsProxy) {
            options.proxyUrl = (environment.production ? '/proxy' : `http://${window.location.hostname}/proxy`);
        }
        return new jsforce.Connection(options);
    }


    static async auth_soapLogin(conn : jsforce.Connection , creds : any, useProxy : boolean) : Promise<{result : any , conn : jsforce.Connection}> {
        let conn1 : jsforce.Connection , result;
        //soap login will not work from browser due to CORS restrictions , so proxy api call required from the server

        Utils.debug('auth_soapLogin - ' + environment.production);
        conn1 = Utils.newJsforceConnection({
            loginUrl: creds.loginUrl,
            version: conn.version,
        }, true);
        result = await conn1.login(creds.username, creds.password);

        // ({result, conn1} = await Utils.proxySoapLogin(conn, creds, useProxy));
        Utils.debug("SOAP Login Succesful");
        
        if(useProxy) {
            return {result, conn : conn1};
        }
        else {
            conn.accessToken = conn1.accessToken;
            conn.instanceUrl = conn1.instanceUrl;
            return {result, conn};
        }
    }
    static async auth_accessToken(conn : jsforce.Connection , creds : any, useProxy : boolean) : Promise<{result : any , conn : jsforce.Connection}> {
        conn = Utils.newJsforceConnection({
            // loginUrl: creds.loginUrl,
            instanceUrl: creds.instanceUrl,
            accessToken: creds.accessToken,
            version: conn.version
        }, useProxy);
        let result = {};
        return {result, conn};
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

    static arrayToInClauseRHS(arr : any, quotes : boolean) {
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

export class NormalizedCodeEntity {
    Id: string;
    Name: string;
    entityType : string;
    BundleId: string | null;
    BundleName: string | null;
    ApiVersion: string | null;
    NamespacePrefix: string | null;
    OrgName : string;
    mimeType? : string;
    lastModifiedDate? : string;
    lastModifiedBy? : string;

    constructor(Id: string,Name: string, entityType: string, BundleId: string | null,BundleName: string | null,ApiVersion: string | null,NamespacePrefix: string | null, OrgName : string, mimeType? : string, lastModifiedDate? : string, lastModifiedBy? : string) {
        this.Id = Id;
        this.Name = Name;
        this.entityType = entityType;
        this.BundleId = BundleId;
        this.BundleName = BundleName;
        this.ApiVersion = ApiVersion;
        this.NamespacePrefix = NamespacePrefix;
        this.OrgName = OrgName;
        this.mimeType = mimeType;
        this.lastModifiedDate = lastModifiedDate;
        this.lastModifiedBy = lastModifiedBy;
    }
    /**
     * Converts an ApexClass SOQL row to NormalizedCodeEntity
     */
    static fromApexClass(row: any, orgName: string): NormalizedCodeEntity {
        return new NormalizedCodeEntity(
            row['Id'],
            row['Name'],
            CodeEntity.ApexClass,
            null,
            null,
            row['ApiVersion'] || null,
            row['NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts an ApexTrigger SOQL row to NormalizedCodeEntity
     */
    static fromApexTrigger(row: any, orgName: string): NormalizedCodeEntity {
        return new NormalizedCodeEntity(
            row['Id'],
            row['Name'],
            CodeEntity.ApexTrigger,
            null,
            null,
            row['ApiVersion'] || null,
            row['NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts an AuraDefinition SOQL row to NormalizedCodeEntity (individual Aura file)
     */
    static fromAuraDefinition(row: any, orgName: string): NormalizedCodeEntity {
        // Name: <BundleName>/<BundleName><Suffix>
        const suffixMap = AppConstants.aura_defTypeVsSuffix;
        const bundleName = row['AuraDefinitionBundle']?.DeveloperName || row['AuraDefinitionBundle.DeveloperName'] || row['DeveloperName'];
        const defType = row['DefType'];
        const name = bundleName + '/' + bundleName + (suffixMap[defType] || '');
        return new NormalizedCodeEntity(
            row['Id'],
            name,
            CodeEntity.AuraComponent,
            row['AuraDefinitionBundleId'] || row['AuraDefinitionBundle.Id'] || null,
            bundleName,
            row['AuraDefinitionBundle']?.ApiVersion || row['AuraDefinitionBundle.ApiVersion'] || null,
            row['AuraDefinitionBundle']?.NamespacePrefix || row['AuraDefinitionBundle.NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts a LightningComponentResource SOQL row to NormalizedCodeEntity (individual LWC file)
     */
    static fromLWCResource(row: any, orgName: string): NormalizedCodeEntity {
        const bundleName = row['LightningComponentBundle']?.DeveloperName || row['LightningComponentBundle.DeveloperName'] || row['DeveloperName'];
        return new NormalizedCodeEntity(
            row['Id'],
            row['FilePath'],
            CodeEntity.LWC,
            row['LightningComponentBundleId'] || row['LightningComponentBundle.Id'] || null,
            bundleName,
            row['LightningComponentBundle']?.ApiVersion || row['LightningComponentBundle.ApiVersion'] || null,
            row['LightningComponentBundle']?.NamespacePrefix || row['LightningComponentBundle.NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts a VFPage SOQL row to NormalizedCodeEntity
     */
    static fromVFPage(row: any, orgName: string): NormalizedCodeEntity {
        return new NormalizedCodeEntity(
            row['Id'],
            row['Name'],
            CodeEntity.VFPage,
            null,
            null,
            row['ApiVersion'] || null,
            row['NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts a VFComponent SOQL row to NormalizedCodeEntity
     */
    static fromVFComponent(row: any, orgName: string): NormalizedCodeEntity {
        return new NormalizedCodeEntity(
            row['Id'],
            row['Name'],
            CodeEntity.VFComponent,
            null,
            null,
            row['ApiVersion'] || null,
            row['NamespacePrefix'] || null,
            orgName,
            undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }

    /**
     * Converts a StaticResource SOQL row to NormalizedCodeEntity
     */
    static fromStaticResource(row: any, orgName: string): NormalizedCodeEntity {
        return new NormalizedCodeEntity(
            row['Id'],
            row['Name'],
            CodeEntity.StaticResource,
            null,
            null,
            null,
            row['NamespacePrefix'] || null,
            orgName,
            row['ContentType'] || undefined,
            row['FormattedLastModifiedDate'] || row['LastModifiedDate'],
            row['LastModifiedBy']?.['Name']
        );
    }
}

export class NormalizedBundleDetails {
    bundleId : string;
    bundleId2? : string; //for diff view
    bundleName : string;
    contents : NormalizedBundleItem[];
    apiVersion : string;
    apiVersion2? : string; //for diff view
    entityType : string;
    namespacePrefix : string;
    constructor(bundleId : string , bundleName : string , contents : any , apiVersion : string, entityType : string, namespacePrefix : string) {
        this.bundleId = bundleId;
        this.bundleName = bundleName;
        this.contents = contents;
        this.apiVersion = apiVersion;
        this.entityType = entityType;
        this.namespacePrefix = namespacePrefix;
    }
}

export class NormalizedBundleItem {
    label: string;
    label2?: string;
    value?: string;
    value2?: string;
    id?: string;
    id2?: string; //for diff view
    toBeCreated?: boolean;
    constructor(label: string, value: string, id: string, id2?: string) {
        this.label = label;
        this.value = value;
        this.id = id;
        this.id2 = id2;
    }
}