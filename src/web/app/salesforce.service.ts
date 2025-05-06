import { Injectable } from '@angular/core';
import * as jsforce from 'jsforce';
import Utils, { EnForceResponse } from './enforce-utils';
import {ClassCmpListFetcher} from './salesforce-operations/ClassCmpListFetcher';
import {CodeFetcher} from './salesforce-operations/FetchCode';
import { DeployCode } from './salesforce-operations/DeployCode';
import { AnonymousApex } from './salesforce-operations/AnonymousApex';
import { QueryTool } from './salesforce-operations/QueryTool';
import LZString from 'lz-string';
// let Utils = {
//     loadSessionsData : () => {},
//     getAllOrgs : () => {}
// };
export const sfApiVersion = '52.0';
const debug = Utils.debug;
const log = Utils.debug;
@Injectable({
    providedIn: 'root'
})
export class SalesforceService {

	channelVsFunction : any = {};
	loadedOrgs : any = [];
	loadedSessions : any = [];
    MAX_ORG_COUNT_FOR_CACHED_COMPONENTS = 5;

    constructor() { }

	async send(channel : string, ...args : any[]) {
        if(!(<any>this)[channel]) {
            alert("Operation not Implemented or Released yet : " + channel);
            return;
        }
		let response = await (<any>this)[channel](args);
		setTimeout(() => {
            if(!this.channelVsFunction[channel]) alert("Callback not found for Operation : " + channel);
			this.channelVsFunction[channel](null, [response]);
		},1);
	}
	
	on(channel: string, listener: Function) : void {
		this.channelVsFunction[channel] = listener;
	}
	
	once(channel: string, listener: Function) : void {
		this.channelVsFunction[channel] = listener;
	}

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
            cachedDataStr = cachedDataStr ? LZString.decompressFromUTF16(cachedDataStr) : '{}';
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
        let response = enforceResp[params.OrgNames[0]][0];
        log('SalesforceService - FetchCode | sending response back');
        // console.log('#$#$ ' + JSON.stringify(response));
        return response;
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

}
