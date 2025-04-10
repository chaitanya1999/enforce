import Utils, { EnForceResponse } from '../enforce-utils';
import * as jsforce from 'jsforce';
import { SalesforceService } from '../salesforce.service';
const debug = Utils.debug;

export class ClassCmpListFetcher {

    sfSvc : SalesforceService;
    constructor(sfSvc : SalesforceService) {
        this.sfSvc = sfSvc;
    }

    async main(orgName : string, toFetch : any) {
        // let ORG_NAMES = OrgNames;
        // for (let orgName of ORG_NAMES) {
        toFetch = new Set(toFetch || []);
        try {
            let creds = this.sfSvc.loadedOrgs[orgName];
            let conn = new jsforce.Connection({
                loginUrl: creds.loginUrl,
                version: '52.0'
            });
            debug("\n\n============================================================\n\t\t" + orgName + "\n============================================================\n");
            debug('Authenticating...');
            let res : any;
            ({ res, conn } = await Utils.handleLogin(conn, creds));
            debug('Authenticated\n' + JSON.stringify(res));

            let apexList, auraList, lwcList, vfPageList, vfCmpList, returnData = [];

            if(toFetch.has('ApexClass')) {
                apexList = await this.fetchApexClassesList(orgName, conn);
                returnData.push(apexList);
            }
            if(toFetch.has('AuraComponent')) {
                auraList = await this.fetchAuraComponentsList(orgName, conn);
                returnData.push(auraList);
            }
            if(toFetch.has('LWC')) {
                lwcList = await this.fetchLightningWebComponentList(orgName, conn);
                returnData.push(lwcList);
            }
            if(toFetch.has('VFPage')) {
                vfPageList = await this.fetchVisualforcePageList(orgName, conn);
                returnData.push(vfPageList);
            }
            if(toFetch.has('VFComponent')) {
                vfCmpList = await this.fetchVisualforceCmpList(orgName, conn);
                returnData.push(vfCmpList);
            }

            return returnData;

        } catch (err) {
            debug('Error => ' + err);
            console.error(err);
            return [EnForceResponse.failure(err)];
        }
        // }
    }


    async fetchAuraComponentsList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Aura Components List...');
            let soqlQuery = `select id,AuraDefinitionBundle.DeveloperName, DefType from AuraDefinition order by AuraDefinitionBundle.DeveloperName, DefType asc`;
            let res : any = {done: false};
            let auraRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            auraRecords = [...auraRecords , ...res.records];
            while(!res?.done){
                debug("\tqueryMore");
                res = await conn.requestGet(res.nextRecordsUrl);
                auraRecords = [...auraRecords , ...res.records];
            }
            debug(`Queried Succesfully. ${auraRecords.length} records.`);
            let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            outputFile += `${orgName}_aura.txt`;
            let suffix = Utils.aura_suffixMap;
            let auraList = Array.from(auraRecords).filter((y:any) => y['DefType'] in suffix).map((x:any) => {
                return x['AuraDefinitionBundle'].DeveloperName + '/' + x['AuraDefinitionBundle'].DeveloperName + suffix[x['DefType']];
            })
            let auraListStr = auraList.reduce( (x,y) => `${x}\n${y}`);
            debug('Pushing to file => ' + outputFile);
            // fs?.writeFileSync(outputFile, auraListStr);
            debug('Completed');
            return EnForceResponse.success({
                type: 'AuraComponent', list : auraList
            });
        } catch (err) {
            debug('Error => ' + err);
            return EnForceResponse.failure(err);
        }
    }

    async fetchApexClassesList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Apex Classes List...');
            let soqlQuery = `select Name from ApexClass order by name asc`;
            let res : any = {done: false};
            let apexRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            apexRecords = [...apexRecords , ...res.records];
            while(!res?.done){
                debug("\tqueryMore");
                res = await conn.requestGet(res.nextRecordsUrl);
                apexRecords = [...apexRecords , ...res.records];
            }

            debug(`Queried Succesfully. ${apexRecords.length} records.`);
            let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            outputFile += `${orgName}_apex.txt`;
            let apexList = Array.from(apexRecords).map((x:any) => x['Name']);
            let apexListStr = apexList.reduce( (x,y) => `${x}\n${y}`);
            debug('Pushing to file => ' + outputFile);
            // fs?.writeFileSync(outputFile, apexListStr);
            debug('Completed');
            return EnForceResponse.success({
                type: 'ApexClass', list : apexList
            });
        } catch (err) {
            debug('Error => ' + err);
            console.error(err);
            return EnForceResponse.success(err);
        }
    }

    async fetchLightningWebComponentList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Lightning Web Components List...');
            let soqlQuery = `select id, LightningComponentBundle.DeveloperName, FilePath from LightningComponentResource order by LightningComponentBundle.DeveloperName, FilePath asc`;
            let res : any = {done:false};
            let lwcRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            lwcRecords = [...lwcRecords , ...res.records];
            while(!res?.done){
                debug('\tqueryMore')
                res = await conn.requestGet(res.nextRecordsUrl);
                lwcRecords = [...lwcRecords , ...res.records];
            }
            debug(`Queried Succesfully. ${lwcRecords.length} records.`);
            let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            outputFile += `${orgName}_lwc.txt`;
            let lwcList = Array.from(lwcRecords).map((x:any) => x['FilePath']);
            let lwcListStr = lwcList.reduce( (x,y) => `${x}\n${y}`);
            debug('Pushing to file => ' + outputFile);
            // fs?.writeFileSync(outputFile, lwcListStr);
            debug('Completed');
            return EnForceResponse.success({
                type: 'LWC', list : lwcList
            });
        } catch (err) {
            debug('Error => ' + err);
            return EnForceResponse.failure(err);
        }
    }

    async fetchVisualforcePageList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Visualforce Pages List...');
            let soqlQuery = `select Name from ApexPage order by name asc`;
            let res : any = {done: false};
            let vfRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            vfRecords = [...vfRecords , ...res.records];
            while(!res?.done){
                debug("\tqueryMore");
                res = await conn.requestGet(res.nextRecordsUrl);
                vfRecords = [...vfRecords , ...res.records];
            }

            debug(`Queried Succesfully. ${vfRecords.length} records.`);
            let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            outputFile += `${orgName}_vfpage.txt`;
            let vfList = Array.from(vfRecords).map((x:any) => x['Name']);
            let vfListStr = vfList.reduce( (x,y) => `${x}\n${y}`);
            debug('Pushing to file => ' + outputFile);
            // fs?.writeFileSync(outputFile, vfListStr);
            debug('Completed');
            return EnForceResponse.success({
                type: 'VFPage', list : vfList
            });
        } catch (err) {
            debug('Error => ' + err);
            console.error(err);
            return EnForceResponse.success(err);
        }
    }

    async fetchVisualforceCmpList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Visualforce Components List...');
            let soqlQuery = `select Name from ApexComponent order by name asc`;
            let res : any = {done: false};
            let vfRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            vfRecords = [...vfRecords , ...res.records];
            while(!res?.done){
                debug("\tqueryMore");
                res = await conn.requestGet(res.nextRecordsUrl);
                vfRecords = [...vfRecords , ...res.records];
            }

            debug(`Queried Succesfully. ${vfRecords.length} records.`);
            let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            outputFile += `${orgName}_vfcmp.txt`;
            let vfList = Array.from(vfRecords).map((x:any) => x['Name']);
            let vfListStr = vfList.reduce( (x,y) => `${x}\n${y}`);
            debug('Pushing to file => ' + outputFile);
            // fs?.writeFileSync(outputFile, vfListStr);
            debug('Completed');
            return EnForceResponse.success({
                type: 'VFComponent', list : vfList
            });
        } catch (err) {
            debug('Error => ' + err);
            console.error(err);
            return EnForceResponse.success(err);
        }
    }

}