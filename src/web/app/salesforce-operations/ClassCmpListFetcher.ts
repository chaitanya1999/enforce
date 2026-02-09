import Utils, { EnForceResponse, NormalizedCodeEntity } from '../enforce-utils';
import * as jsforce from 'jsforce';
import { SalesforceService } from '../salesforce.service';
import { AppConstants, CodeEntity } from '../AppConstants';
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

            // let apexList, apexTriggerList, auraList, lwcList, vfPageList, vfCmpList, srList, returnData : any = [];
            let returnData : any = [] , promises : any = [];

            if(toFetch.has('ApexClass')) {
                promises.push(this.fetchApexClassesList(orgName, conn));
            }
            if(toFetch.has('ApexTrigger')) {
                promises.push(this.fetchApexTriggerList(orgName, conn));
            }
            if(toFetch.has('AuraComponent')) {
                promises.push(this.fetchAuraComponentsList(orgName, conn));
            }
            if(toFetch.has('LWC')) {
                promises.push(this.fetchLightningWebComponentList(orgName, conn));
            }
            if(toFetch.has('VFPage')) {
                promises.push(this.fetchVisualforcePageList(orgName, conn));
            }
            if(toFetch.has('VFComponent')) {
                promises.push(this.fetchVisualforceCmpList(orgName, conn));
            }
            if(toFetch.has('StaticResource')) {
                promises.push(this.fetchStaticResourceList(orgName, conn));
            }

            returnData = await Promise.all(promises);

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
            let soqlQuery = `select id,AuraDefinitionBundleId, AuraDefinitionBundle.DeveloperName, DefType, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.NamespacePrefix from AuraDefinition order by AuraDefinitionBundle.DeveloperName, DefType asc`;
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
            // let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            // outputFile += `${orgName}_aura.txt`;
            let suffix = Utils.aura_suffixMap;
            let auraList = Array.from(auraRecords)
            .sort((x : any,y : any) => {
                
                let bundleCompare = x['AuraDefinitionBundle']['DeveloperName'].localeCompare(y['AuraDefinitionBundle']['DeveloperName']);
                if(bundleCompare !== 0) return bundleCompare;
                return AppConstants.aura_defTypeVsSortOrder[ x['DefType'] ] - AppConstants.aura_defTypeVsSortOrder[ y['DefType'] ];

            }).filter((y:any) => y['DefType'] in suffix).map((x:any) => {
                let name = x['AuraDefinitionBundle'].DeveloperName + '/' + x['AuraDefinitionBundle'].DeveloperName + suffix[x['DefType']];
                return new NormalizedCodeEntity(x['Id'], name, CodeEntity.AuraComponent, x['AuraDefinitionBundleId'], x['AuraDefinitionBundle']['DeveloperName'], x['AuraDefinitionBundle']['ApiVersion'], x['AuraDefinitionBundle']['NamespacePrefix'], orgName)
            })
            // let auraListStr = auraList.reduce( (x,y) => `${x}\n${y}`, '');
            // debug('Pushing to file => ' + outputFile);
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
            let soqlQuery = `select Id, Name, NamespacePrefix, ApiVersion from ApexClass order by Name asc`;
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
            // let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            // outputFile += `${orgName}_apex.txt`;
            let apexList = Array.from(apexRecords).map((x:any) => new NormalizedCodeEntity(x['Id'], x['Name'], CodeEntity.ApexClass, null, null, x['ApiVersion'], x['NamespacePrefix'], orgName));
            // let apexListStr = apexList.reduce( (x,y) => `${x}\n${y}`, '');
            // debug('Pushing to file => ' + outputFile);
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

    async fetchApexTriggerList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Apex Triggers List...');
            let soqlQuery = `select Id, Name, NamespacePrefix, ApiVersion from ApexTrigger order by Name asc`;
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
            let apexList = Array.from(apexRecords).map((x:any) => new NormalizedCodeEntity(x['Id'], x['Name'], CodeEntity.ApexTrigger, null, null, x['ApiVersion'], x['NamespacePrefix'], orgName));
            debug('Completed');
            return EnForceResponse.success({
                type: 'ApexTrigger', list : apexList
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
            let soqlQuery = `select id, LightningComponentBundleId, LightningComponentBundle.DeveloperName, FilePath, LightningComponentBundle.NamespacePrefix, LightningComponentBundle.ApiVersion from LightningComponentResource order by LightningComponentBundle.DeveloperName, FilePath asc`;
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
            // let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            // outputFile += `${orgName}_lwc.txt`;
            let lwcList = Array.from(lwcRecords)
            .sort((x : any, y : any)=>{
                let bundleCompare = x['LightningComponentBundle']['DeveloperName'].localeCompare(y['LightningComponentBundle']['DeveloperName']);
                if(bundleCompare !== 0) return bundleCompare;
                function afterFirst(str : string, char : string) {
                    const i = str.indexOf(char);
                    return i === -1 ? '' : str.slice(i + 1);
                }
                let typeCompare = AppConstants.lwc_typeVsSortOrder[ afterFirst(x['FilePath'], '.') ] - AppConstants.lwc_typeVsSortOrder[ afterFirst(y['FilePath'], '.') ];
                if(typeCompare !== 0) return typeCompare;

                return x['FilePath'].localeCompare(y['FilePath']);
            })
            .map((x:any) => new NormalizedCodeEntity(x['Id'], x['FilePath'], CodeEntity.LWC, x['LightningComponentBundleId'], x['LightningComponentBundle']['DeveloperName'] , x['LightningComponentBundle']['ApiVersion'], x['LightningComponentBundle']['NamespacePrefix'], orgName));
            // let lwcListStr = lwcList.reduce( (x,y) => `${x}\n${y}`, '');
            // debug('Pushing to file => ' + outputFile);
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
            let soqlQuery = `select Id,Name,ApiVersion,NamespacePrefix from ApexPage order by name asc`;
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
            // let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            // outputFile += `${orgName}_vfpage.txt`;
            let vfList = Array.from(vfRecords).map((x:any) => new NormalizedCodeEntity(x['Id'], x['Name'], CodeEntity.VFPage, null, null, x['ApiVersion'], x['NamespacePrefix'], orgName));
            // let vfListStr = vfList.reduce( (x,y) => `${x}\n${y}`, '');
            // debug('Pushing to file => ' + outputFile);
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
            let soqlQuery = `select Name,Id, NamespacePrefix, ApiVersion from ApexComponent order by name asc`;
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
            // let outputFile = `../FetchedClassCmpList/`;
            // fs?.mkdirSync(outputFile, { recursive: true });
            // outputFile += `${orgName}_vfcmp.txt`;
            let vfList = Array.from(vfRecords).map((x:any) => new NormalizedCodeEntity(x['Id'], x['Name'], CodeEntity.VFComponent, null, null, x['ApiVersion'], x['NamespacePrefix'], orgName));
            // let vfListStr = vfList.reduce( (x,y) => `${x}\n${y}`, '');
            // debug('Pushing to file => ' + outputFile);
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

    async fetchStaticResourceList(orgName : string, conn : jsforce.Connection) {
        try {
            debug('Querying Static Resources List...');
            let soqlQuery = `SELECT Id, Name, Body, ContentType, NamespacePrefix FROM StaticResource WHERE ContentType IN ${Utils.arrayToInClauseRHS(AppConstants.staticResMimeTypes, true)} ORDER BY Name ASC`;
            let res : any = {done: false};
            let srRecords : any = [];

            res = await conn.tooling.query(soqlQuery);
            srRecords = [...srRecords , ...res.records];
            while(!res?.done){
                debug("\tqueryMore");
                res = await conn.requestGet(res.nextRecordsUrl);
                srRecords = [...srRecords , ...res.records];
            }

            debug(`Queried Succesfully. ${srRecords.length} records.`);
            let srList = Array.from(srRecords).map((x:any) => new NormalizedCodeEntity(x['Id'], x['Name'], CodeEntity.StaticResource, null, null, null, x['NamespacePrefix'], orgName, x['ContentType']));
            
            debug('Completed');
            return EnForceResponse.success({
                type: 'StaticResource', list : srList
            });
        } catch (err) {
            debug('Error => ' + err);
            console.error(err);
            return EnForceResponse.success(err);
        }
    }

}