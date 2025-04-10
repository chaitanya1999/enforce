import * as mime from 'mime-types';
import * as jsforce from 'jsforce';
const fs = {
    mkdirSync(...x : any) {},
    rmdirSync(...x : any) {},
    rmSync(...x : any) {},
    readFileSync(...x : any) {},
    writeFileSync(...x : any) {},
    unlinkSync(...x : any) {},
    renameSync(...x : any) {},
    existsSync(...x : any) {return false},
    readdirSync(...x : any) : string[] {return []},
    lstatSync(...x : any) {return {isDirectory(){return false;}}},
}

import Utils, { EnForceResponse } from '../enforce-utils';
const debug = Utils.debug;

const defTypesSuffixes = {
    'COMPONENT': '.cmp',
    'HELPER': 'Helper.js',
    'CONTROLLER': 'Controller.js',
    'STYLE': '.css'
}
const ROOT_PATH = /*__dirname +*/ '/../FETCHED/';
const ROOT_PATH2 = /*__dirname +*/ '/../FETCHED_EnForce/';
const keysToIgnore = ['CREDENTIALS', 'OrgNames', 'getCreds'];

const entityFunctionMapping : { [key: string]: string; } = {
    'ApexClass' : 'fetchApexClasses',
    'AuraComponent' : 'fetchAuraComponents',
    'LWC' : 'fetchLWCComponents',
    'VFPage' : 'fetchVisualforcePages',
    'VFComponent' : 'fetchVisualforceComponents',
    'CustomLabels' : 'fetchCustomLabel',
    'Objects' : 'fetchObjects',
    'ObjectRecords' : 'fetchObjectRecords',
    'FieldSets' : 'fetchFieldSets',
    'StaticResource' : 'fetchStaticResource',
    'EmailTemplate' : 'fetchEmailTemplate',
    'CustomMetadataRecords' : 'fetchCustomMetadataRecords'
}


export class CodeFetcher {

    enForceMode = false;
    deleteFlag = false;
    path = ROOT_PATH;

    async main(codeToFetchParam : any, delFlag : boolean, enForceMode : boolean, deltaFlag : boolean) {
        this.enForceMode = enForceMode || false; // refers to call via EnForce Utility , single org, single file at a time concept
        if(enForceMode) {
            this.path = ROOT_PATH2;
        }

        this.deleteFlag = delFlag || false;
        let ORG_NAMES = codeToFetchParam.OrgNames;

        let deleteFlag = this.deleteFlag;
        if(deltaFlag && !deleteFlag) {
            debug('Delete flag "--d" is mandatory with Delta flag "--delta" for consistent comparison\n\n');
            return;
        }
        if(deleteFlag){
            debug('Delete Flag Found.');
            debug('Delta Flag Found.');
            for(let entity in codeToFetchParam) {
                if(keysToIgnore.includes(entity)) continue;
                debug('\t\t' + this.path + entity);
                fs.rmSync(this.path + entity, {recursive: true, force: true});
            }
        }

        let orgFetchReport : any= {
            //org_name : {
                // entity_name : fetched count
            //}
            '*Expected*' : {}
        };

        for(let entity in codeToFetchParam) {
            if(keysToIgnore.includes(entity)) continue;
            orgFetchReport["*Expected*"][entity] = codeToFetchParam[entity].names?.length ?? 'NA';
        }

        let enForceResponseData : any = [];
        for (let orgName of ORG_NAMES) {
            try {
                enForceResponseData[orgName] = [];

                let creds = this.getCreds(codeToFetchParam, orgName);
                console.log('#$#$ ' + JSON.stringify(creds));
                let conn = new jsforce.Connection({
                    loginUrl: creds.loginUrl,
                    version: '52.0'
                });
                debug("\n\n============================================================\n\t\t" + orgName + "\n============================================================\n");
                debug('Authenticating...');
                let res;
                ({ res, conn } = await Utils.handleLogin(conn, creds));
                // let res = await conn.login(creds.username, creds.password);
                debug('Authenticated\n' + JSON.stringify(res));

                this.processNames(codeToFetchParam);
                orgFetchReport[orgName] = {};

                for(let entity in codeToFetchParam) {
                    if(keysToIgnore.includes(entity)) continue;
                    let output = await (<any>this)[entityFunctionMapping[entity]](codeToFetchParam[entity], orgName, conn, entity);
                    orgFetchReport[orgName][entity] = output.data.count;
                    enForceResponseData[orgName].push(output);
                }

            } catch (err : any) {
                debug('Error => ' + err);
                console.log(err.stack);
                return console.error(err);
            }
        }
        console.log('\n\n');
        
        if(deltaFlag)
            this.deltaComparison(codeToFetchParam, orgFetchReport);
        
        debug(`Report => Count of items fetched = `);
        console.table(orgFetchReport);
        return enForceResponseData;
    }

    getCreds(codeToFetchParam : any , orgName : string) {
        return Utils.getOrg(orgName);
    }

    processNames(codeToFetch : any){
        for(let key in codeToFetch) {
            if(keysToIgnore.includes(key)) continue;

            // console.log('###' , codeToFetch[key]);
            if(codeToFetch[key].names) 
                codeToFetch[key].names = codeToFetch[key].names.map((x : string) => x.trim());
            if(codeToFetch[key].fileNames)
                codeToFetch[key].fileNames = codeToFetch[key].fileNames.map((x:string) => x.trim());
        }
    }


    async fetchAuraComponents(auraComponents : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Aura Components');
        let count = 0;
        let returnData : any = { count : 0 , entityName : entityName };
        try {
            if (auraComponents.names.length == 0 || auraComponents.defTypes.length == 0) {
                debug('No AuraComponents to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(auraComponents.names));
            debug('Querying Aura Code...');
            let cmpNames = Utils.arrayToInClauseRHS(auraComponents.names, true);
            let defTypes = Utils.arrayToInClauseRHS(auraComponents.defTypes, true);
            let soqlQuery = `select Id,DefType,source,Format,AuraDefinitionBundle.DeveloperName from AuraDefinition where AuraDefinitionBundle.DeveloperName IN ${cmpNames} and DefType IN ${defTypes}`;
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} records.`);

            let auraRecords = res.records;
            // console.log(auraRecords);
            // let parentDir = './FetchedAuraCmp/' + orgName + '/';
            let parentDir = `${this.path}/${entityName}/${orgName}/`;
            for (let auraRec of auraRecords) {
                try {
                    let bundleName = auraRec['AuraDefinitionBundle'].DeveloperName;
                    let fileName = bundleName;
                    let suffix = Utils.aura_suffixMap[auraRec['DefType'].toUpperCase()];
                    if (!suffix) {
                        suffix = Utils.titleCase(auraRec['DefType']) + '.' + auraRec['Format'];
                    }
                    fileName += suffix;
                    debug('Pushing to file => ' + fileName);
                    let fullPath = parentDir + bundleName + '/';
                    fs.mkdirSync(fullPath, { recursive: true });
                    fullPath += fileName;
                    fs.writeFileSync(fullPath, auraRec['Source']);

                    if(this.enForceMode) {
                        returnData[bundleName+'/'+fileName] = auraRec['Source'];
                        returnData.Id = auraRec.Id;
                    }
                    count++;
                } catch (err : any) {
                    debug('Error => ' + err);
                    console.log(err.stack);
                    console.error(err)
                }
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(err, returnData);
        }
        return count;
    }

    async fetchApexClasses(apexClasses : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Apex Classes');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (apexClasses.names.length == 0) {
                debug('No ApexClass to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(apexClasses.names));
            debug('Querying ApexClass Code...');
            let soqlQuery = `select Id,Name,Body from ApexClass where Name IN ${Utils.arrayToInClauseRHS(apexClasses.names, true)} order by name`;
            debug('QUERY => ' + soqlQuery);
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} records.`);
            let records = res.records;
            try {
                // let path = './FetchedClasses/' + orgName + '/';
                let path = `${this.path}/${entityName}/${orgName}/`;
                for (let apexclass of records) {
                    let className = apexclass['Name'] + '.cls';
                    debug('Pushing to file => ' + className);
                    fs.mkdirSync(path, { recursive: true });
                    fs.writeFileSync(path + className, apexclass['Body'])
                    count++;

                    if(this.enForceMode) {
                        returnData[apexclass['Name']] = apexclass['Body'];
                        returnData.Id = apexclass.Id;
                    }
                }
            } catch (err : any) {
                debug('Error => ' + err);
                console.log(err.stack);
                console.error(err)
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchLWCComponents(lwcComponents : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('LWC Components');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (lwcComponents.names?.length == 0 && lwcComponents.fileNames?.length == 0) {
                debug('No LWC Components to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(lwcComponents.names));
            debug('Querying LWC Code...');
            // let defTypes = Utils.arrayToInClauseRHS(lwcComponents.defTypes, true);
            let soqlQuery = ``;
            if(lwcComponents.names?.length) {
                let cmpNames = Utils.arrayToInClauseRHS(lwcComponents.names, true);
                soqlQuery = `select id,Format,source,FilePath,LightningComponentBundle.DeveloperName from LightningComponentResource where LightningComponentBundle.DeveloperName IN ${cmpNames}`; // and Format IN ${defTypes}
            } else {
                let fileNames = Utils.arrayToInClauseRHS(lwcComponents.fileNames, true);
                soqlQuery = `select Id,Format,source,FilePath,LightningComponentBundle.DeveloperName from LightningComponentResource where FilePath IN ${fileNames}`; // and Format IN ${defTypes}
            }
            debug('SOQL => ' + soqlQuery);
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} records.`);

            let lwcRecords = res.records;
            // console.log(lwcRecords);
            // let parentDir = './FetchedLWC/' + orgName + '/';
            let parentDir = `${this.path}/${entityName}/${orgName}/`;
            for (let lwcRec of lwcRecords) {
                if(lwcRec['FilePath'].endsWith('js-meta.xml') && lwcComponents.ignoreMeta) continue;
                try {
                    let bundleName = lwcRec['LightningComponentBundle'].DeveloperName;
                    // let fileName = bundleName;
                    // let suffix = defTypesSuffixes[lwcRec.DefType.toUpperCase()]
                    // if (!suffix) {
                    //     suffix = Utils.titleCase(lwcRec.DefType) + '.' + lwcRec.Format;
                    // }
                    let fileName = lwcRec['FilePath'].substring(lwcRec['FilePath'].lastIndexOf('/')+1);
                    debug('Pushing to file => ' + fileName);
                    let fullPath = parentDir + bundleName + '/';
                    fs.mkdirSync(fullPath, { recursive: true });
                    fullPath += fileName;
                    fs.writeFileSync(fullPath, lwcRec['Source']);
                    count++;

                    if(this.enForceMode) {
                        returnData[lwcRec['FilePath']] = lwcRec['Source'];
                        returnData.Id = lwcRec.Id;
                    }
                } catch (err : any) {
                    debug('Error => ' + err);
                    console.log(err.stack);
                    console.error(err)
                }
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchVisualforcePages(vfPages : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Visualforce Pages');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (vfPages.names.length == 0) {
                debug('No VF Page to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(vfPages.names));
            debug('Querying Visualforce Pages Code...');
            let soqlQuery = `select Id,Name,Markup from ApexPage where Name IN ${Utils.arrayToInClauseRHS(vfPages.names, true)} order by name`;
            debug('QUERY => ' + soqlQuery);
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} records.`);
            let records = res.records;
            try {
                // let path = './FetchedVFPage/' + orgName + '/';
                let path = `${this.path}/${entityName}/${orgName}/`;
                for (let vfPage of records) {
                    let fileName = vfPage['Name'] + '.page';
                    debug('Pushing to file => ' + fileName);
                    fs.mkdirSync(path, { recursive: true });
                    fs.writeFileSync(path + fileName, vfPage['Markup'])
                    count++;

                    if(this.enForceMode) {
                        returnData[vfPage['Name']] = vfPage['Markup'];
                        returnData.Id = vfPage.Id;
                    }
                }
            } catch (err : any) {
                debug('Error => ' + err);
                console.log(err.stack);
                console.error(err)
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchVisualforceComponents(vfComponents : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Visualforce Components');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (vfComponents.names.length == 0) {
                debug('No VF Page to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(vfComponents.names));
            debug('Querying Visualforce Component Code...');
            let soqlQuery = `select Id,Name,Markup from ApexComponent where Name IN ${Utils.arrayToInClauseRHS(vfComponents.names, true)} order by name`;
            debug('QUERY => ' + soqlQuery);
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} records.`);
            let records = res.records;
            try {
                // let path = './FetchedVFComponents/' + orgName + '/';
                let path = `${this.path}/${entityName}/${orgName}/`;
                for (let vfCmp of records) {
                    let fileName = vfCmp['Name'] + '.component';
                    debug('Pushing to file => ' + fileName);
                    fs.mkdirSync(path, { recursive: true });
                    fs.writeFileSync(path + fileName, vfCmp['Markup'])
                    count++;

                    if(this.enForceMode) {
                        returnData[vfCmp['Name']] = vfCmp['Markup'];
                        returnData.Id = vfCmp.Id;
                    }
                }
            } catch (err : any) {
                debug('Error => ' + err);
                console.log(err.stack);
                console.error(err)
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }


    async fetchCustomLabel(labelNames : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Custom Label');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (labelNames.names.length == 0) {
                debug('No CustomLabels to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(labelNames.names));
            debug('Querying Custom Labels ...');
            let soqlQuery = `select Name,Value from CustomLabel where Name IN ${Utils.arrayToInClauseRHS(labelNames.names, true)} order by name`;
            debug('QUERY => ' + soqlQuery);
            let res = await conn.tooling.query(soqlQuery);
            debug(`Queried Succesfully. ${res.records.length} custom labels.`);
            let records = res.records;
            try {
                // let path = './Fetched_CustomLabels/' + orgName + '/';
                let path = `${this.path}/${entityName}/${orgName}/`;
                for (let customLabel of records) {
                    let fileName = customLabel['Name'] + '.txt';
                    debug('Pushing to file => ' + fileName);
                    fs.mkdirSync(path, { recursive: true });
                    fs.writeFileSync(path + fileName, customLabel['Value'])
                    count++;
                }
            } catch (err : any) {
                debug('Error => ' + err);
                console.log(err.stack);
                console.error(err)
            }
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }


    async fetchObjects(objectNames : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('Objects');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (objectNames.names.length == 0) {
                debug('No Objects to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(objectNames.names));
            debug('Fetching Objects ...');
            
            let res : any = null;
            for(let obj of objectNames.names) {
                debug('Fetch ' + obj);
                try {
                    res = await conn.sobject(obj).describe();
                    let filterFields = ['autoNumber','byteLength','calculated','calculatedFormula','cascadeDelete','caseSensitive','compoundFieldName','controllerName','custom','defaultValue','defaultValueFormula','defaultedOnCreate','dependentPicklist','digits','externalId','label','length','name','nillable','type','unique','picklistValues'];

                    for(let f of res.fields){
                        for(let key in f)
                            if(!filterFields.includes(key))
                                delete f[key];
                    }

                    // console.log(res);
                    let fileName = obj + '.json';
                    debug('Pushing to file => ' + fileName);
                    // let path = './Fetched_Objects/' + orgName + '/';
                    let path = `${this.path}/${entityName}/${orgName}/`;
                    fs.mkdirSync(path, { recursive: true });
                    fs.writeFileSync(path + fileName, JSON.stringify(res,null,4));
                    count++;
                } catch (err : any) {
                    debug('Error => ' + err);
                    console.log(err.stack);
                }
            }
            debug(`Fetched Succesfully. ${count} Objects.`);
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchObjectRecords(objectNames : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
        debug('Object Records');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        let queryMode = !!objectNames.query;
        try {
            if (objectNames.names.length == 0 && !queryMode) {
                debug('No ObjectRecords to be fetched');
                return EnForceResponse.success(returnData);
            } 
            
            let days = objectNames.days;
            let limit = objectNames.limit;
            if(queryMode) {
                debug('Query Mode. Fetching records from specified queries.\n' , Object.keys(objectNames.query));
            } else {
                debug('To Fetch => ' + JSON.stringify(objectNames.names));
                debug(`Fetching ObjectRecords... within ${days} Days`);
            }
            let res : any = null;

            if(!queryMode) {
                for(let obj of objectNames.names) {
                    debug('Querying ' + obj);
                    try {
                        res = await conn.sobject(obj).describe();
                        let fields : any = [];
                        for(let f of res.fields)
                            fields.push(f.name);
    
                        let soql = `SELECT ${fields.join(',')} FROM ${obj} `;
                        if(days) {
                            soql += ` WHERE CreatedDate >= LAST_N_DAYS:${days} OR LastModifiedDate >= LAST_N_DAYS:${days} `;
                        }
                        soql += ` LIMIT ${limit} `;
                        res = await conn.query(soql);
                        count += res.totalSize;
                        debug('Fetched Records = ' + res.totalSize);

                        if(res.totalSize > 0) {
                            for(let r of res.records) {
                                delete r.attributes;
                            }
                        }
    
                        // let path = './Fetched_Records/' + orgName + '/';
                        let path = `${this.path}/${entityName}/${orgName}/`;
                        if(res.totalSize) {
                            let fileName = obj + '.json';
                            debug('Pushing to file => ' + fileName);
                            fs.mkdirSync(path, { recursive: true });
                            fs.writeFileSync(path + fileName, JSON.stringify(res.records,null,4));
                        }
                    } catch (err : any) {
                        debug('Error => ' + err);
                        console.log(err.stack);
                    }
                }
            } else {
                //query mode
                debug('Querying ');
                try {

                    let soqlQueries = objectNames.query;

                    for(let obj in soqlQueries) {
                        let soqlQ = soqlQueries[obj];
                        res = await conn.query(soqlQ);
                        count += res.totalSize;
                        debug('Fetched Records = ' + obj + ' | ' + res.totalSize);
                        if(res.totalSize > 0) {
                            for(let r of res.records) {
                                delete r.attributes;
                            }
                        }

                        let path = `${this.path}/${entityName}/${orgName}/`;
                        if(res.totalSize) {
                            let fileName = obj + '.json';
                            debug('Pushing to file => ' + fileName);
                            fs.mkdirSync(path, { recursive: true });
                            fs.writeFileSync(path + fileName, JSON.stringify(res.records,null,4));
                        }

                    }

                } catch (err : any) {
                    debug('Error => ' + err);
                    console.log(err.stack);
                }

            }

            debug(`Fetched Succesfully. ${count} Records.`);
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchFieldSets(fieldSets : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('FieldSets');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (fieldSets.names.length == 0) {
                debug('No FieldSets to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(fieldSets.names));
            debug('Fetching FieldSets ...');
            
            let res = await conn.metadata.read('FieldSet', fieldSets.names);
            
            if(!Array.isArray(res)) res = [res];

            for(let fieldSet of fieldSets.names) {
                let [objName, fieldSetName] = fieldSet.split('.');
                
                let fileName = fieldSetName + '.json';
                debug('Pushing to file => ' + fileName);
                // let path = `./Fetched_FieldSets/${orgName}/${objName}/`;
                let path = `${this.path}/${entityName}/${orgName}/${objName}`;
                fs.mkdirSync(path, { recursive: true });
                fs.writeFileSync(path + fileName, JSON.stringify(res,null,4));
                count++;
            }
            
            
            debug(`Fetched Succesfully. ${count} FieldSets.`);
            debug('Completed');

            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchStaticResource(staticResources : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('StaticResource');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (staticResources.names.length == 0) {
                debug('No StaticResource to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(staticResources.names));
            debug('Fetching StaticResource ...');
            
            let res = await conn.query(`SELECT Id, Name, Body, ContentType FROM StaticResource WHERE Name IN ${Utils.arrayToInClauseRHS(staticResources.names, true)}`);

            // let path = `./Fetched_StaticResource/${orgName}/`;
            let path = `${this.path}/${entityName}/${orgName}/`;
            for(let staticRes of res.records) {
                let url = staticRes['Body'];
                let body = await conn.request({
                    url: conn.instanceUrl + url,
                    method: 'GET'
                });
                let extension = mime.extension(staticRes['ContentType']);
                let fileName = staticRes['Name'] + '.' + extension;
                debug('Pushing to file => ' + fileName);
                fs.mkdirSync(path, { recursive: true });
                fs.writeFileSync(path + fileName, body);
                count++;
            }
            
            
            debug(`Fetched Succesfully. ${count} StaticResource.`);
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }


    async fetchEmailTemplate(emailTemplates : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('EmailTemplate');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (emailTemplates.names.length == 0) {
                debug('No EmailTemplate to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(emailTemplates.names));
            debug('Fetching EmailTemplate ...');
            
            let res = await conn.query(`SELECT Id, Name, DeveloperName, Body, TemplateType, Markup, HtmlValue FROM EmailTemplate WHERE DeveloperName IN ${Utils.arrayToInClauseRHS(emailTemplates.names, true)}`);

            let typeVsData : any = {
                'text' : { 'ext' : 'txt' , 'contentField' : 'Body' },
                'visualforce' : { 'ext' : 'component' , 'contentField' : 'Markup' },
                'custom' : { 'ext' : 'txt' , 'contentField' : 'HtmlValue' } ,
                'html' : { 'ext' : 'html' , 'contentField' : 'Body' }
            }

            // let path = `./Fetched_StaticResource/${orgName}/`;
            let path = `${this.path}/${entityName}/${orgName}/`;
            for(let emailTemp of res.records) {
                let contentField = typeVsData[emailTemp['TemplateType']].contentField;
                debug('contentField = ' + contentField);
                let body = emailTemp[contentField];
                
                let extension = typeVsData[emailTemp['TemplateType']].ext;
                let fileName = emailTemp['Name'] + '.' + extension;
                debug('Pushing to file => ' + fileName);
                fs.mkdirSync(path, { recursive: true });
                fs.writeFileSync(path + fileName, body);
                count++;
            }
            
            
            debug(`Fetched Succesfully. ${count} EmailTemplate.`);
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    async fetchCustomMetadataRecords(customMetadataRecords : any, orgName : string, conn : jsforce.Connection, entityName : string) {
        console.log('\n');
		debug('CustomMetadataRecords');
        let count = 0;
        let returnData : any =  { count : 0 , entityName : entityName };
        try {
            if (customMetadataRecords.names.length == 0) {
                debug('No CustomMetadataRecords to be fetched');
                return EnForceResponse.success(returnData);
            }
            debug('To Fetch => ' + JSON.stringify(customMetadataRecords.names));
            debug('Fetching CustomMetadataRecords ...');

            let path = `${this.path}/${entityName}/${orgName}/`;
            for(let mdRecName of customMetadataRecords.names) {
                let metadataRec = await conn.metadata.read('CustomMetadata', mdRecName);
                let fileName = mdRecName + '.json';
                debug('Pushing to file => ' + fileName);
                fs.mkdirSync(path, { recursive: true });
                fs.writeFileSync(path + fileName, JSON.stringify(metadataRec, null, 4));
                count++;
            }            
            
            debug(`Fetched Succesfully. ${count} CustomMetadataRecords.`);
            debug('Completed');
            returnData.count = count;
            return EnForceResponse.success(returnData);
        } catch (err : any) {
            debug('Error => ' + err);
            console.log(err.stack);
            returnData.count = count;
            return EnForceResponse.failure(returnData);
        }
        return count;
    }

    deltaComparison(codeToFetchParam : any , orgFetchReport : any){
        // return;
        //path structure = <path>/<entity>/<org_name>/<contents>
        debug('Delta Mode Comparison');
        if(codeToFetchParam.OrgNames.length <= 1) {
            debug('\tInsufficient orgs to compare');
            debug('\tDelta Mode Terminate');
            return;
        }
        if(codeToFetchParam.OrgNames.length > 2) {
            debug('\tMore than two orgs to compare');
            debug('\tDelta Mode Terminate');
            return;
        }

        let org1 = codeToFetchParam.OrgNames[0];
        let org2 = codeToFetchParam.OrgNames[1];
        let actualDelete = false;
        let filesToDelete : any = [];
        debug('\tComparing Orgs = ' + org1 + ' , ' + org2);
        
        // let path = `${this.path}/${entityName}/${orgName}/`;
        let entitiesFetched1 = Object.keys(orgFetchReport[org1]).filter(x => orgFetchReport[org1][x] > 0);
        let entitiesFetched2 = Object.keys(orgFetchReport[org2]).filter(x => orgFetchReport[org2][x] > 0);
        let entitiesFetched = Array.from(new Set([...entitiesFetched1 , ...entitiesFetched2]));
        
        for(let entity of entitiesFetched) {
            debug('\t\tComparing entity = ' + entity);
            let path1 = `${this.path}/${entity}/${org1}`;
            let path2 = `${this.path}/${entity}/${org2}`;
            let contents1 = this.getPathContents(path1);
            let contents2 = this.getPathContents(path2);
            // debug('\t\tcontents1 = ' + contents1);
            // debug('\t\tcontents2 = ' + contents2);
            let superSetOfContents : Set<string> = new Set([...contents1 , ...contents2]);
            // debug('\t\tsuperset = ' + superSetOfContents);
            let exactMatch = this.compareContents(superSetOfContents , path1, path2);
            debug('\t\t ' + exactMatch.length + ' exact matches');
            filesToDelete.push(...exactMatch);
            orgFetchReport[org1][entity] -= exactMatch.length/2;
            orgFetchReport[org2][entity] -= exactMatch.length/2;
        }

        debug('Delta - Files to delete = \n' + filesToDelete.join('\n'));
        debug('\nNo Delta Count = ' + filesToDelete.length + '\n');

        if(actualDelete) {
            for(let file of filesToDelete) {
                fs.unlinkSync(file);
            }
        } else {
            for(let file of filesToDelete) {
                fs.renameSync(file, file + '.enfdel');
            }
        }

        debug('\n\n');

    }

    compareContents(superSet : any, path1 : string, path2 : string ) {
        let exactMatch : any = [];
        for(let element of superSet) {
            let file1path = path1 + '/' + element;
            let file2path = path2 + '/' + element;
            let file1 = '' , file2 = '';
            file1 = this.readFileSafe(file1path);
            file2 = this.readFileSafe(file2path);
            if(file1 == file2){
                exactMatch.push(file1path , file2path);
                // console.log('%%%% pushed to exact match list = ' + file1path);
                // console.log('%%%% pushed to exact match list = ' + file2path);
            }
        }
        return exactMatch;
    }

    readFileSafe(path : string) {
        try{
            return ''+fs.readFileSync(path);
        } catch(err) {
            return '';
        }
    }

    getPathContents(path : string){
        let contents : string[] = [];
        let stack = [''];
        if(fs.existsSync(path)) while(stack.length){
            let element = stack.pop();
            let isFolder = fs.lstatSync(path + '/' + element).isDirectory();
            if(isFolder) {
                let lst = fs.readdirSync(path + '/' + element);
                lst = lst.map(x => element + '/' + x);
                stack.push(...lst);
            } else if(!element!.endsWith('.enfdel')) {
                contents.push(element!);
            }
        }
        return contents;
    }

}

/* ENTRY POINT */
// if(require.main === module) {
//     let df = Array.from(process.argv).some(x => x == '--d')
//     let deltaMode = Array.from(process.argv).some(x => x == '--delta');
//     new CodeFetcher().main(codeToFetch, df, false, deltaMode);
// }
/* ! ENTRY POINT */
