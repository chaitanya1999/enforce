import { Injectable } from '@angular/core';
import * as jsforce from 'jsforce';
import Utils, { EnForceResponse } from './enforce-utils';
import {ClassCmpListFetcher} from './salesforce-operations/ClassCmpListFetcher';
import {CodeFetcher} from './salesforce-operations/FetchCode';
import { DeployCode } from './salesforce-operations/DeployCode';
import { AnonymousApex } from './salesforce-operations/AnonymousApex';
import { QueryTool } from './salesforce-operations/QueryTool';
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
        this.loadedOrgs = orgCreds;
        return true;
    }

    async FetchClassCmpList(x : any) {
        log('IPC - FetchClassCmpList | ' , x);
        let param = x[0];
        let orgName = param.orgName;
        let toFetchList = param.toFetchList;
        let ignoreCache = param.ignoreCache;
        let result : any = null;
        log('IPC - FetchClassCmpList | Checking cache - ' + orgName + ' | ignoreCache = ' + ignoreCache);
        
        if(toFetchList.length) {
            let cached = sessionStorage.getItem('fetchedClassCmpList') || '{}';
            let cachedData = JSON.parse(cached);
            result = cachedData[orgName] || [];
            if(ignoreCache || !cachedData[orgName]) {
                log('IPC - FetchClassCmpList | Making SF call ' + toFetchList);
                let tempResult = await (new ClassCmpListFetcher(this).main(orgName, toFetchList));
                result = [...result , ...tempResult];
                cachedData[orgName] = result;
                sessionStorage.setItem('fetchedClassCmpList', JSON.stringify(cachedData));
            }
        }

        return result;
    }

    async FetchCode(x : any) {
        log('IPC - FetchCode | ' + JSON.stringify(x));
        let params = x[0];
        let enforceResp = await new CodeFetcher().main(params, false, true, false);
        log('IPC - FetchCode | fetched')
        let response = enforceResp[params.OrgNames[0]][0];
        log('IPC - FetchCode | sending response back');
        // console.log('#$#$ ' + JSON.stringify(response));
        return response;
    }

    async DeployCode(x : any) {
        let params = x[0];
        log('DeployCode - ' + params.orgName);
        let response = await (new DeployCode().main(params.orgName, {
            type : params.Type,
            id : params.Id,
            Body : params.Code
        }));
        return response;
    }

    async executeAnonymous(x : any) {
        log('IPC - executeAnonymous');
        let params = x[0];
        let response = await new AnonymousApex().main(params.code, params.orgName);
        return response;
    }

    async executeQuery(x : any) {
        log('IPC - executeQuery | ' + JSON.stringify(x));
        let params = x[0];
        let enforceResp = await new QueryTool().executeSOQL(params.orgName, params.soqlQuery, params.fetchDeleted, params.toolingApi);
        log('IPC - executeQuery | executed. Sending response.');
        return enforceResp;
    }

    async getInstanceURL(x : any) {
        log('IPC - getInstanceURL');
        let params = x[0];
        this.getSessionData();
        return this.loadedSessions[params.orgName]?.instanceUrl;
    }

}
