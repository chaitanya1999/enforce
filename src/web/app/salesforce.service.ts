import { Injectable } from '@angular/core';
import * as jsforce from 'jsforce';
import Utils, { EnForceResponse, NormalizedBundleDetails, NormalizedBundleItem, NormalizedCodeEntity } from './enforce-utils';
import {ClassCmpListFetcher} from './salesforce-operations/ClassCmpListFetcher';
import {CodeFetcher} from './salesforce-operations/FetchCode';
import { DeployCode } from './salesforce-operations/DeployCode';
import { AnonymousApex } from './salesforce-operations/AnonymousApex';
import { QueryTool } from './salesforce-operations/QueryTool';
import LZString from 'lz-string';
import { AppConstants, CodeEntity } from './AppConstants';
import { EditorSession } from './EditorSession';
// let Utils = {
//     loadSessionsData : () => {},
//     getAllOrgs : () => {}
// };
export const sfApiVersion = '64.0';//52.0
const debug = Utils.debug;
const log = Utils.debug;
type BundlesMap = {[key: string] : NormalizedBundleDetails};
type BundleTypeMap = {[key: string] : BundlesMap};
type OrgBundleInfo = {[key: string] : BundleTypeMap};

@Injectable({
    providedIn: 'root'
})
export class SalesforceService {

    channelVsFunction : any = {};
    loadedOrgs : any = [];
    loadedSessions : any = [];
    MAX_ORG_COUNT_FOR_CACHED_COMPONENTS = 5;
    loadedBundleInfo : OrgBundleInfo = {
        // map <orgname , map <keys lwc aura , map<bundlename , NormalizedBundleDetails > > > 
        /*org name vs map of keys lwc, aura vs map of bundle name vs array of bundle contents*/
    }
    loadedOrganizationDetails : any = {
        //orgname vs { organizationType, organizationName }
    }
    MAX_ORG_COUNT_FOR_SOBJECT_LIST = 2;
    loadedSObjectsList : any = {
        //orgName vs array of sobjects
    };
    loadedSObjectsList_orgs : any = [];

    constructor() { }

    async send(channel : string, ...args : any[]) {
        if(!(<any>this)[channel]) {
            alert("Operation not Implemented or Released yet : " + channel);
            return;
        }
        let response = await (<any>this)[channel](args);
        // setTimeout(() => {
        //     if(!this.channelVsFunction[channel]) alert("Callback not found for Operation : " + channel);
        // 	this.channelVsFunction[channel](null, [response]);
        // },1);
        return response;
    }
    
    // on(channel: string, listener: Function) : void {
    // 	this.channelVsFunction[channel] = listener;
    // }
    
    // once(channel: string, listener: Function) : void {
    // 	this.channelVsFunction[channel] = listener;
    // }

    getSessionData() {
        return (this.loadedSessions = Utils.loadSessionsData());
    }

    getOrgs() {      
        this.loadedOrgs = Utils.getAllOrgs();
        for(let key in this.loadedOrgs) {
            this.loadedOrgs[key].orgName = key;
        }
        return this.loadedOrgs;
    }

    async authenticate(params : any) {
        let orgName = params[0];
        try {
            let org = this.loadedOrgs[orgName];
            let res = null, conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            ({res, conn} = await Utils.handleLogin(conn, org));
            await conn.query('SELECT Id FROM Organization LIMIT 1');
            debug("Authenticated ==> ");
            // console.log(conn);
            console.log(res);
            return EnForceResponse.success(res);
        } catch(err){
            debug("Error => " + err);
            console.error(err);
            return EnForceResponse.failure(err);
        }
    }

    setCredentials(param : any) {
        let orgCreds = param[0];
        Utils.setAllOrgs(orgCreds);
        // this.loadedOrgs = orgCreds;
        this.getOrgs();
        return true;
    }

    async FetchClassCmpList(x : any) {
        log('SalesforceService - FetchClassCmpList | ' , x);
        let param = x[0];
        let orgName = param.orgName;
        let toFetchList = param.toFetchList;
        let ignoreCache = param.ignoreCache;
        let result : any = null;
        log('SalesforceService - FetchClassCmpList | Checking cache - ' + orgName + ' | ignoreCache = ' + ignoreCache);
        
        if(toFetchList.length) {
            // let cached = /*sessionStorage.getItem('fetchedClassCmpList') ||*/ '{}';
            // let cachedData = JSON.parse(cached);
            let cachedDataStr = sessionStorage.getItem('cachedClassCmpList');
            cachedDataStr = <string>(cachedDataStr ? LZString.decompressFromUTF16(cachedDataStr) : '{}');
            let cachedData = JSON.parse(cachedDataStr);

            let loadedComponentsOrgs = JSON.parse(sessionStorage.getItem('cachedClassCmpOrgs') || '[]');

            result = cachedData[orgName] || [];
            if(ignoreCache || !cachedData[orgName]) {
                log('SalesforceService - FetchClassCmpList | Making SF call ' + toFetchList);
                let tempResult = await (new ClassCmpListFetcher(this).main(orgName, toFetchList));
                result = [...result , ...tempResult];
                if(result.every((x:EnForceResponse) => x.isSuccess)) {
                    log('SalesforceService - FetchClassCmpList | Caching Data ');
                    cachedData[orgName] = result;
                    if(!loadedComponentsOrgs.includes(orgName)) loadedComponentsOrgs.push(orgName);
                    while(loadedComponentsOrgs.length > this.MAX_ORG_COUNT_FOR_CACHED_COMPONENTS) {
                        log('SalesforceService - FetchClassCmpList | Cache limit exceeded. Deleting org - ' + loadedComponentsOrgs[0]);
                        delete cachedData[loadedComponentsOrgs[0]];
                        let delOrg = loadedComponentsOrgs.shift();
                    }
                    sessionStorage.setItem('cachedClassCmpOrgs', JSON.stringify(loadedComponentsOrgs || []));
                    let compressedString = LZString.compressToUTF16(JSON.stringify(cachedData));
                    sessionStorage.setItem('cachedClassCmpList', compressedString);
                }
                // cachedData[orgName] = result;
                // sessionStorage.setItem('fetchedClassCmpList', JSON.stringify(cachedData));
            }
        }

        return result;
    }

    async FetchCode(x : any) {
        log('SalesforceService - FetchCode | ' + JSON.stringify(x));
        let params = x[0];
        let enforceResp = await new CodeFetcher().main(params, false, true, false);
        log('SalesforceService - FetchCode | fetched')
        // let response = enforceResp[params.OrgNames[0]][0];
        log('SalesforceService - FetchCode | sending response back');
        // console.log('#$#$ ' + JSON.stringify(response));
        return enforceResp;
    }

    async DeployCode(x : any) {
        let params = x[0];
        let orgName = params.orgName;
        log('DeployCode - ' + orgName);
        delete params.orgName;
        let response = await (new DeployCode().main(orgName, params));
        return response;
    }

    async executeAnonymous(x : any) {
        log('SalesforceService - executeAnonymous');
        let params = x[0];
        let response = await new AnonymousApex().main(params.code, params.orgName);
        return response;
    }

    async executeQuery(x : any) {
        log('SalesforceService - executeQuery | ' + JSON.stringify(x));
        let params = x[0];
        let enforceResp = await new QueryTool().executeSOQL(params.orgName, params.soqlQuery, params.fetchDeleted, params.toolingApi);
        log('SalesforceService - executeQuery | executed. Sending response.');
        return enforceResp;
    }

    async getInstanceURL(x : any) {
        log('SalesforceService - getInstanceURL');
        let params = x[0];
        this.getSessionData();
        return this.loadedSessions[params.orgName]?.instanceUrl;
    }

    async getOrgLoginUrl(x : any) {
        log('SalesforceService - getOrgLoginUrl | ' + JSON.stringify(x));
        await this.getSessionData();
        let org = x[0];
        let y = this.loadedSessions;
        let session = this.loadedSessions[org];
        return session.instanceUrl + '/secur/frontdoor.jsp?sid=' + session.accessToken;
    }

    /* Loads bundle details of multiple bundles of same type at once from ONE ORG*/
    async getBundleDetails(x : any) {
        let orgName = x[0].orgName;
        let bundleNames = x[0].bundleName;
        let entityType = x[0].entityType;
        let ignoreCache = x[0].ignoreCache;
        let query = ``;
        let bundleContents : NormalizedBundleItem[] = [];
        let apiVersion = null;
        let namespace = null
        let bundleId = null;
        
        debug('SalesforceService - getBundleDetails | orgName = ' + orgName + ' | entityType = ' + entityType + ' | bundleNames = ' + bundleNames.length + ' | ignoreCache = ' + ignoreCache);

        let bundlesToFetch : string[] = [];
        let bundlesPresent : string[] = [];

        let bundleVsDetails : {[key: string] : NormalizedBundleDetails} = {};

        for(let bundleName of bundleNames) {
            let bundlePresent : NormalizedBundleDetails = this.loadedBundleInfo[orgName]?.[entityType]?.[bundleName];
            if(bundlePresent && !ignoreCache)
                bundleVsDetails[bundleName] = bundlePresent;
            else
                bundlesToFetch.push(bundleName);
        }

        if(bundlesToFetch.length) {
            if(entityType == CodeEntity.AuraComponent) {
                let sortOrder : any = {
                    "COMPONENT" : 1,
                    "APPLICATION" : 1,
                    "CONTROLLER" : 2,
                    "HELPER" : 3,
                    "STYLE" : 4,
                    "RENDERER" : 5,
                    "EVENT" : 6,
                    "DOCUMENTATION" : 7,
                    "DESIGN" : 8,
                    "SVG" : 9
                }
                let existingDefTypes = Object.keys(sortOrder).reduce((p: any, c : string) => {
                    p[c] = false;
                    return p;
                }, {});
                //aura
                query = `Select id, AuraDefinitionBundleId, DefType, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.NamespacePrefix, AuraDefinitionBundle.DeveloperName from AuraDefinition where AuraDefinitionBundle.DeveloperName IN ${Utils.arrayToInClauseRHS(bundlesToFetch, true)}`;
                let res : EnForceResponse = await this.executeQuery([{orgName , soqlQuery : query}]);
                if(!res.isSuccess) return res;
    
                
                for(let record of res.data.records) {
                    existingDefTypes[record['DefType']] = true;
                    let bundleName = record['AuraDefinitionBundle']['DeveloperName'];
                    let name = bundleName + '/' + bundleName + AppConstants.aura_defTypeVsSuffix[record['DefType']];
    
                    apiVersion = record['AuraDefinitionBundle']['ApiVersion'];
                    bundleId = record['AuraDefinitionBundleId'];
                    namespace = record['AuraDefinitionBundle']['NamespacePrefix'];
    
                    let bundleDetails = <NormalizedBundleDetails>{
                        bundleId : bundleId,
                        bundleName : bundleName,
                        contents : [],
                        apiVersion : apiVersion,
                        entityType,
                        namespacePrefix : namespace
                    };
    
                    if(!bundleVsDetails[bundleName]) {
                        bundleVsDetails[bundleName] = bundleDetails;
                    }
    
                    bundleVsDetails[bundleName].contents.push({label : record['DefType'] , value : name, id : record['Id']});
                    
                }
    
                for(let bundleDetails of Object.values(bundleVsDetails)) {
                    bundleDetails.contents = bundleDetails.contents.sort((x:any, y:any) => {
                        return sortOrder[x.label] - sortOrder[y.label];
                    });
                    bundleContents.push(...bundleDetails.contents);
                }
                // for(let key in existingDefTypes) {
                //     if(existingDefTypes[key] == false && key != 'COMPONENT' && key != 'APPLICATION' ) { //either application or component, one must exist
                //         let value = bundleName + '/' + bundleName + AppConstants.aura_defTypeVsSuffix[key];
                //         bundleContents.push({label : key , value : value, toBeCreated : true});
                //     }
                // }
                
    
            } else {
                //lwc
                query = `select id,Format,FilePath,LightningComponentBundleId, LightningComponentBundle.DeveloperName, LightningComponentBundle.ApiVersion, LightningComponentBundle.NamespacePrefix from LightningComponentResource where LightningComponentBundle.DeveloperName IN ${Utils.arrayToInClauseRHS(bundlesToFetch, true)}`;
                let res : EnForceResponse = await this.executeQuery([{orgName , soqlQuery : query, toolingApi : true}]);
                if(!res.isSuccess) return res;
    
                for(let record of res.data.records) {
                    let bundleName = record['LightningComponentBundle']['DeveloperName'];
                    let name = record['FilePath'];
                    name = name.substring(name.lastIndexOf('/')+1);
    
                    apiVersion = record['LightningComponentBundle']['ApiVersion'];
                    bundleId = record['LightningComponentBundleId'];
                    namespace = record['LightningComponentBundle']['NamespacePrefix'];
    
                    let bundleDetails = <NormalizedBundleDetails>{
                        bundleId : bundleId,
                        bundleName : bundleName,
                        contents : [],
                        apiVersion : apiVersion,
                        entityType,
                        namespacePrefix : namespace
                    };
    
                    if(!bundleVsDetails[bundleName]) {
                        bundleVsDetails[bundleName] = bundleDetails;
                    }
    
                    bundleVsDetails[bundleName].contents.push({label : name , value : record['FilePath'], id : record['Id']});
                }

                
                function afterFirst(str : string, char : string) {
                    const i = str.indexOf(char);
                    return i === -1 ? '' : str.slice(i + 1);
                }
                for(let bundleDetails of Object.values(bundleVsDetails)) {
                    bundleDetails.contents = bundleDetails.contents.sort((x:any, y:any) => {
                        let order = AppConstants.lwc_typeVsSortOrder[ afterFirst(x.value, '.') ] - AppConstants.lwc_typeVsSortOrder[ afterFirst(y.value, '.') ];
                        if(order == 0)
                            return x.value.localeCompare(y.value);
                        else return order;
                    });
                    bundleContents.push(...bundleDetails.contents);
                }

            }
        }


        if(!this.loadedBundleInfo[orgName]) {
            this.loadedBundleInfo[orgName] = {}
        }
        if(!this.loadedBundleInfo[orgName][entityType]){
            this.loadedBundleInfo[orgName][entityType] = {};
        }

        for(let bundleName in bundleVsDetails) {
            this.loadedBundleInfo[orgName][entityType][bundleName] = bundleVsDetails[bundleName];
        }

        return EnForceResponse.success(bundleVsDetails);         
    }

    async getOrganizationDetails(params : any) {
        let organizationName = '';
        let organizationType = '';
        if(!this.loadedOrganizationDetails[params[0]]) {
            let qParams = {
                orgName : params,
                soqlQuery : `select Id, Name, PrimaryContact, OrganizationType, InstanceName, IsSandbox, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById from Organization LIMIT 1`,
                fetchDeleted : false,
                toolingApi : false
            };
            let response = await this.executeQuery([qParams]);
            
            if(response.isSuccess) {
                organizationName = response.data.records?.[0]?.Name ?? '';
                organizationType = response.data.records?.[0]?.OrganizationType ?? '';
            } else {
                organizationName = '';
                organizationType = '';
            }
            this.loadedOrganizationDetails[params[0]] = {organizationName, organizationType}
        }
        return this.loadedOrganizationDetails[params[0]];
    }

    async loadSObjectsList(params : any) {
        params = params[0];
        let orgName = params.orgName;
        let ignoreCache = params.ignoreCache;
        debug(`loadSObjectsList | ${orgName} , ignoreCache=${ignoreCache}`);
        
        try {
            if(!ignoreCache && this.loadedSObjectsList[orgName]) {
                debug(`loadSObjectsList | Found in cache. Returning.`);
                return EnForceResponse.success(this.loadedSObjectsList[orgName]);
            }

            let org = this.loadedOrgs[orgName];
            let res : any = null, conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            ({res, conn} = await Utils.handleLogin(conn, org));
            debug("loadSObjectsList | Authenticated ==> " + orgName);
            console.log(res);

            res = await conn.query('select count() from EntityDefinition');

            let totalSize = res.totalSize;
            debug("loadSObjectsList | EntityDefinition : totalSize = " + totalSize);

            let promiseList = []; //offsets
            let count = 0;
            while(count < totalSize) {
                promiseList.push(count);
                count += 2000;
            }
            // promiseList.push(count);
            

            debug("loadSObjectsList | Parallel promises = " + promiseList.length);

            res = await Promise.all(promiseList.map( (offset : Number) => {
                return conn.query(`SELECT DurableId, QualifiedApiName, IsQueryable, IsApexTriggerable, IsTriggerable, IsCustomizable, IsCustomSetting, NamespacePrefix, DeveloperName, KeyPrefix FROM EntityDefinition
                    LIMIT 2000 OFFSET ${offset}`);
            } ));

            debug("loadSObjectsList | SObjects list fetched");
            
            let allRecords = res.reduce((total : any, response : any) => {
                total.push(...response.records);
                return total;
            }, [])

            // //? store only required data
            // for(let sobj of res.sobjects) {
            //     for(let key of Object.keys(sobj)) {
            //         if(!['custom','customSetting','keyPrefix','label','labelPlural','name','queryable','triggerable','urls'].includes(key)) {
            //             delete sobj[key];
            //         }
            //     }
            // }
            debug("loadSObjectsList | SObjects list processed");
            
            this.loadedSObjectsList[orgName] = allRecords;
            this.loadedSObjectsList_orgs.push(orgName);
            if(this.loadedSObjectsList_orgs.length > this.MAX_ORG_COUNT_FOR_SOBJECT_LIST) {
                let orgToDelete = this.loadedSObjectsList_orgs.shift();
                delete this.loadedSObjectsList[orgToDelete];
                debug("loadSObjectsList | SObjects list deleted for - " + orgToDelete);
                debug("loadSObjectsList | SObjects list cached org count - " + this.loadedSObjectsList_orgs.length);
            }

            console.log('#$#$ res ' ,res);

            return EnForceResponse.success(res);
        } catch(err){
            debug("loadSObjectsList | Error => " + err);
            console.error(err);
            return EnForceResponse.failure(err);
        }
    }

    async codeGlobalSearch(params : any) {
        log('SalesforceService - codeGlobalSearch | ' + JSON.stringify(params));
        let orgName = params[0].orgName;
        let searchText = params[0].searchText;

        try {
            let org = this.loadedOrgs[orgName];
            let res : any = null, conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            ({res, conn} = await Utils.handleLogin(conn, org));
            log('SalesforceService - codeGlobalSearch | Authenticated');

            let soslQuery = `FIND {${searchText}} IN ALL FIELDS RETURNING ApexClass(id, name, namespaceprefix, body), ApexTrigger(id, name, namespaceprefix, body), ApexPage(id, name, namespaceprefix, markup), ApexComponent(id, name, namespaceprefix, markup)`;
            let searchResult = await conn.search(soslQuery);

            if (!searchResult || !searchResult.searchRecords) {
                log('SalesforceService - codeGlobalSearch | SOSL returned no records or failed');
                return EnForceResponse.failure('SOSL returned no records or failed');
            }

            let resultsTable: any[] = [];
            const searchLower = searchText.toLowerCase();

            function isApexTestClass(code: string): boolean {
                // Remove single-line and multi-line comments
                const withoutComments = code.split('\n').slice(0, 100).join('\n') //check only in first 100 lines - Approximate
                    .replace(/\/\/.*$/gm, '')                            // remove single-line comments
                    .replace(/\/\*[\s\S]*?\*\//g, '')                    // remove multi-line comments

                    // Remove string literals ('...' or "...")
                    .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '');

                // Regex to detect @isTest on a class declaration
                // const testClassRegex = /@isTest\s*(public\s+|private\s+|protected\s+|global\s+)?(class|interface)\s+\w+/i;
                // const testClassRegex = /@isTest(?:\s*\([^)]*\))?\s*(?:@[\w]+\s*)*(?:(public|private|protected|global)\s+)?(class|interface)\s+\w+/i;
                const testClassRegex = /@isTest(?:\s*\([^)]*\))?[\s\S]*?(?:@[a-zA-Z]+\s*)*(?:public|private|protected|global)?\s*(class|interface)\s+\w+/i;



                return testClassRegex.test(withoutComments);
            }


            function processRecords(records: any[], type: string, displayType : string, bodyField: string) {
                if (!records) return;
                for (const rec of records) {
                    const body = rec[bodyField];
                    if (!body) continue;
                    let isTestClass = (type == CodeEntity.ApexClass && isApexTestClass(body));
                    if(isTestClass)
                        console.log("$^$^&%& TEST CLASS " + rec['Name']);
                    const lines = body.split(/\r?\n/);
                    lines.forEach((line: string, idx: number) => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.toLowerCase().includes(searchLower)) {
                            // Build NormalizedCodeEntity (minimal, similar to ClassCmpListFetcher)
                            let codeEntity = {
                                Id: rec['Id'],
                                Name: rec['Name'],
                                BundleName: null,
                                BundleId: null,
                                ApiVersion: rec['ApiVersion'] || null,
                                NamespacePrefix: rec['NamespacePrefix'] || '',
                                OrgName: orgName,
                                SObjectType: null,
                                entityType: type
                            };
                            resultsTable.push({
                                Namespace: rec['NamespacePrefix'] || '',
                                Name: rec['Name'] || '',
                                Type: displayType,
                                LineNo: idx + 1,
                                Text: trimmedLine.length > 500 ? trimmedLine.substring(0,500)+'...' : trimmedLine, // Limit to 1000 chars
                                NormalizedCodeEntity: codeEntity,
                                isTestClass
                            });
                        }
                    });
                }
            }

            const records = searchResult.searchRecords || [];
            const apexClassRecords = records.filter((r: any) => r.attributes && r.attributes.type === 'ApexClass');
            const apexTriggerRecords = records.filter((r: any) => r.attributes && r.attributes.type === 'ApexTrigger');
            const apexPageRecords = records.filter((r: any) => r.attributes && r.attributes.type === 'ApexPage');
            const apexComponentRecords = records.filter((r: any) => r.attributes && r.attributes.type === 'ApexComponent');

            processRecords(apexClassRecords, CodeEntity.ApexClass, 'ApexClass', 'Body');
            processRecords(apexTriggerRecords, CodeEntity.ApexTrigger, 'ApexTrigger', 'Body');
            processRecords(apexPageRecords, CodeEntity.VFPage, 'ApexPage', 'Markup');
            processRecords(apexComponentRecords, CodeEntity.VFComponent, 'ApexComponent', 'Markup');

            log('SalesforceService - codeGlobalSearch | SOSL executed and parsed');
            return EnForceResponse.success(resultsTable);
        } catch(err) {
            debug("codeGlobalSearch | Error => " + err);
            console.error(err);
            return EnForceResponse.failure(err);
        }
    }

    async storePackageXml(params : any) {
        log('SalesforceService - storePackageXml | ' + JSON.stringify(params));
        const packageXml = params[0];
        localStorage.setItem('lastPackageXml', packageXml || '');
        return EnForceResponse.success(true);
    }

    async getLastPackageXml() {
        log('SalesforceService - getLastPackageXml');
        const packageXml = localStorage.getItem('lastPackageXml') || '';
        return EnForceResponse.success(packageXml);
    }

    /**
     * Saves the current editor session to localStorage using a namespaced key.
     * @param editorSession The EditorSession object to persist.
     */
    saveEditorSession(param: any): EnForceResponse {
        let editorSession : EditorSession = param[0];
        if (!editorSession) {
            debug('SalesforceService.saveEditorSession | No editorSession provided.');
            return EnForceResponse.failure('No editorSession provided');
        }
        const STORAGE_KEY = 'enforce.EditorSession';
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(editorSession));
            debug('SalesforceService.saveEditorSession | Editor session saved successfully.');
            return EnForceResponse.success('Editor session saved successfully');
        } catch (error) {
            debug(`SalesforceService.saveEditorSession | Error saving to localStorage: ${error}`);
            return EnForceResponse.failure(`Error saving editor session: ${error}`);
        }
    }

    /**
     * Loads the editor session from localStorage.
     * @returns EnForceResponse containing the loaded EditorSession or an error.
     */
    loadEditorSession(): EnForceResponse {
        const STORAGE_KEY = 'enforce.EditorSession';
        try {
            const sessionStr = localStorage.getItem(STORAGE_KEY);
            if (!sessionStr) {
                debug('SalesforceService.loadEditorSession | No editor session found in localStorage.');
                return EnForceResponse.failure('No editor session found');
            }
            const editorSession: EditorSession = JSON.parse(sessionStr);
            debug('SalesforceService.loadEditorSession | Editor session loaded successfully.');
            return EnForceResponse.success(editorSession);
        } catch (error) {
            debug(`SalesforceService.loadEditorSession | Error loading from localStorage: ${error}`);
            return EnForceResponse.failure(`Error loading editor session: ${error}`);
        }
    }
    /**
     * Fetches recently modified code entities (ApexClass, AuraComponent, LWC, etc.) in the last N days, grouped by entity type.
     * @param params [ { orgName: string, days: number } ]
     * @returns EnForceResponse with { [entityType]: NormalizedCodeEntity[] }
     */
    async fetchRecentCodeChanges(params: any): Promise<EnForceResponse> {
        const { orgName, days } = params[0];
        const result: { [key: string]: NormalizedCodeEntity[] } = {};
        try {
            let org = this.loadedOrgs[orgName];
            let res: any = null, conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            ({ res, conn } = await Utils.handleLogin(conn, org));
            debug(`fetchRecentCodeChanges | Authenticated org: ${orgName}`);

            // ApexClass
            let apexClassRes = await conn.query(`SELECT Id, Name, NamespacePrefix, ApiVersion, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LastModifiedBy.Name FROM ApexClass WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY Name ASC`);
            result[CodeEntity.ApexClass] = (apexClassRes.records || []).map((rec: any) => NormalizedCodeEntity.fromApexClass(rec, orgName));

            // ApexTrigger
            let apexTriggerRes = await conn.query(`SELECT Id, Name, NamespacePrefix, ApiVersion, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LastModifiedBy.Name FROM ApexTrigger WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY Name ASC`);
            result[CodeEntity.ApexTrigger] = (apexTriggerRes.records || []).map((rec: any) => NormalizedCodeEntity.fromApexTrigger(rec, orgName));

            // VFPage
            let vfPageRes = await conn.query(`SELECT Id, Name, NamespacePrefix, ApiVersion, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LastModifiedBy.Name FROM ApexPage WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY Name ASC`);
            result[CodeEntity.VFPage] = (vfPageRes.records || []).map((rec: any) => NormalizedCodeEntity.fromVFPage(rec, orgName));

            // VFComponent
            let vfComponentRes = await conn.query(`SELECT Id, Name, NamespacePrefix, ApiVersion, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LastModifiedBy.Name FROM ApexComponent WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY Name ASC`);
            result[CodeEntity.VFComponent] = (vfComponentRes.records || []).map((rec: any) => NormalizedCodeEntity.fromVFComponent(rec, orgName));

            // Aura: Bundle and Definitions
            let auraDefRes = await conn.tooling.query(`SELECT Id, AuraDefinitionBundleId, DefType, Source, Format, FORMAT(LastModifiedDate) FormattedLastModifiedDate, AuraDefinitionBundle.DeveloperName, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.NamespacePrefix, LastModifiedBy.Name FROM AuraDefinition WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY AuraDefinitionBundle.DeveloperName ASC`);
            result[CodeEntity.AuraComponent] = (auraDefRes.records || []).map((rec: any) => NormalizedCodeEntity.fromAuraDefinition(rec, orgName));

            // LWC: Bundle and Resources
            let lwcResRes = await conn.tooling.query(`SELECT Id, LightningComponentBundleId, FilePath, Format, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LightningComponentBundle.DeveloperName, LightningComponentBundle.ApiVersion, LightningComponentBundle.NamespacePrefix, LastModifiedBy.Name FROM LightningComponentResource WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY LightningComponentBundle.DeveloperName ASC`);
            result[CodeEntity.LWC] = (lwcResRes.records || []).map((rec: any) => NormalizedCodeEntity.fromLWCResource(rec, orgName));

            // StaticResource
            let staticResourceRes = await conn.query(`SELECT Id, Name, NamespacePrefix, ContentType, FORMAT(LastModifiedDate) FormattedLastModifiedDate, LastModifiedBy.Name FROM StaticResource WHERE LastModifiedDate = LAST_N_DAYS:${days} ORDER BY Name ASC`);
            result[CodeEntity.StaticResource] = (staticResourceRes.records || []).map((rec: any) => NormalizedCodeEntity.fromStaticResource(rec, orgName));

            return EnForceResponse.success(result);
        } catch (err) {
            debug(`fetchRecentCodeChanges | Error => ${err}`);
            console.error(err);
            return EnForceResponse.failure(err);
        }
    }
}
