import { sfApiVersion } from '../salesforce.service';
import * as jsforce from 'jsforce';
import Utils, { EnForceResponse } from '../enforce-utils';
import { CodeEntity } from '../AppConstants';
const debug = Utils.debug;

let codeToDeploy = {
    type : '',
    id : '',
    Body : ``
}

type CodeToDeploy = {
    type : string;
    id : string;
    Body : string;
    apiVersion? : number
    name? : string,
    bundle? : Bundle[]
    TableEnumOrId? : string;
    mimeType? : string;
}

type Bundle = {
    filePath? : string,
    defType? : string,
    format? : string,
    Source : string
}

/*Bulk Deployment Mode - TO be used later*/
// let codeToDeploy = {
//     ApexClass : [
//         {id : '01p9B0000008dZdQAI', Body : classContent}
//     ],
//     AuraComponent : [
//         {id : '0Ad720000008zUXCAY', Body : `
// <aura:application extends="force:slds">
//     <div>
// </aura:application>
//         `}
//     ],
//     LWC : [
//         // {id : '', Body : ''}
//     ],
//     VFPage : [
//         // {id : '', Body : ''}
//     ],
//     VFComponent : [
//         // {id : '', Body : ''}
//     ]
// };

/* USES TOOLING API */
export class DeployCode {

    containerDeployable : {[key : string] : string} = {
        'ApexClass' : 'ApexClassMember', 'ApexTrigger' : 'ApexTriggerMember', 'VFPage' : 'ApexPageMember', 'VFComponent' : 'ApexComponentMember'
    };
    
    apexObjectNames : any = {
        'ApexClass' : 'ApexClass', 'ApexTrigger' : 'ApexTrigger', 'VFComponent' : 'ApexComponent', 'VFPage' : 'ApexPage'
    }

    bundleObjectNames : any = {
        'AuraComponent' : 'AuraDefinitionBundle',
        'LWC' : 'LightningComponentBundle'
    }

    nonContainerDeployable : {[key : string] : string}  = {'AuraComponent' : 'AuraDefinition', 'LWC' : 'LightningComponentResource', 'StaticResource' : 'StaticResource'};

    async main(orgName : string, codeToDeploy : CodeToDeploy) {
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = Utils.getOrg(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds));

            // await this.bulkDeploy(conn, codeToDeploy);

            let response : any = null;
            if(codeToDeploy.id)
                response = await this.singleDeploy(conn, codeToDeploy);
            else 
                response = await this.createCodeComponents(conn, codeToDeploy);

            return response;
        } catch(err : any) {
            console.log(err);
            return EnForceResponse.failure(err);
        }
    }

    async createCodeComponents(conn : jsforce.Connection, codeToDeploy : CodeToDeploy) {
        let bundleId = null;
        try {
            let response : any = null;
            console.log('sfApiVersion = ' , sfApiVersion );
            if(codeToDeploy.type in this.apexObjectNames) {
                let objName = this.apexObjectNames[codeToDeploy.type];
                let payload : any = {
                    "Name" : codeToDeploy.name,
                    "ApiVersion" : codeToDeploy.apiVersion ?? (+sfApiVersion)
                };

                if(objName == 'ApexComponent' || objName == 'ApexPage') {
                    payload['Markup'] = codeToDeploy.Body;
                    payload['MasterLabel'] = codeToDeploy.name;
                } else {
                    payload['Body'] = codeToDeploy.Body;
                }

                if(objName == 'ApexTrigger') {
                    payload['TableEnumOrId'] = codeToDeploy.TableEnumOrId;
                    response = await conn.sobject(objName).create(payload); //https://salesforce.stackexchange.com/questions/9603/how-do-i-use-the-tooling-api-to-create-a-new-apex-trigger
                } else {
                    response = await conn.tooling.sobject(objName).create(payload);
                }
                
                return EnForceResponse.success(response);
                
            } else if(codeToDeploy.type == CodeEntity.StaticResource){
                
                response = await conn.tooling.sobject(codeToDeploy.type).create({
                   'Body' : codeToDeploy.Body,
                   'ContentType' : codeToDeploy.mimeType,
                   'Name' : codeToDeploy.name 
                });
                return EnForceResponse.success(response);

            } else {
                
                let bundleName = codeToDeploy.name;
                let bundleObjName = this.bundleObjectNames[codeToDeploy.type];
                let defObjName = this.nonContainerDeployable[codeToDeploy.type];

                //create Bundle
                let payload : any = {
                    "DeveloperName" : bundleName,
                    "MasterLabel" : bundleName,
                    "ApiVersion" : codeToDeploy.apiVersion ?? (+sfApiVersion),
                };
                if(codeToDeploy.type == 'AuraComponent') {
                    payload = {
                        ...payload, 
                        "Description" : "A Lightning Component"
                    }
                } else {
                    payload = {
                        "Metadata": {
                            "apiVersion": codeToDeploy.apiVersion ?? (+sfApiVersion),
                            "isExposed": false,
                            "masterLabel": bundleName,
                            "description" : "A Lightning web component"
                        },
                        "FullName" : bundleName
                    }
                }
                response = await conn.tooling.sobject(bundleObjName).create(payload);

                if(!response.success) return EnForceResponse.failure(response.errors);
                bundleId = response.id ?? response.id;

                let allResponses : any = [response];
                for(let bundleItem of codeToDeploy.bundle ?? []) {
                    let payload  : any = {};
                    if(codeToDeploy.type == 'AuraComponent') {
                        payload = {
                            "AuraDefinitionBundleId" : bundleId,
                            "Source" : bundleItem.Source,
                            "DefType": bundleItem.defType,
                            "Format": bundleItem.format
                        };
                    } else {
                        payload = {
                            "LightningComponentBundleId" : bundleId,
                            "Source" : bundleItem.Source,
                            "FilePath": bundleItem.filePath,
                            "Format": bundleItem.format
                        };
                    }
                    response = await conn.tooling.sobject(defObjName).create(payload);
                    allResponses.push(response);
                }

                return EnForceResponse.success(allResponses);
            }
            // return EnForceResponse.failure("Not implemented yet for non apex object types");
        } catch(err) {
            console.log(err);
            // if(bundleId) {
            //     let bundleObjName = this.bundleObjectNames[codeToDeploy.type];
            //     await conn.tooling.sobject(bundleObjName).delete([bundleId]);
            //     console.log('Deleted bundle due to exception');
            // }
            return EnForceResponse.failure(err);
        }
    }

    async singleDeploy(conn : jsforce.Connection, codeToDeploy : CodeToDeploy) {
        try {

            if(codeToDeploy.type in this.containerDeployable) {
                Utils.debug('Container Deployment');
                //1. Create MetadataContainer
                let containerName = 'EnforceDeployment' + Date.now();
                // let containerName = 'EnforceDeployment';
                let mdContainer = await this.metadataContainer(conn, containerName);
                let mdcId = mdContainer.id || mdContainer.Id;

                //2. Create MetadataContainer Member records
                let member = await this.metadataContainerMember(conn, codeToDeploy.type, codeToDeploy.id, codeToDeploy.Body, mdcId);

                //3. Create ContainerAsyncRequest
                let response = await this.containerAsyncRequest(conn, mdcId);
                if(response.State == 'Completed') {
                    return EnForceResponse.success(response);
                } else {
                    return EnForceResponse.failure(new Error("Deployment failed"), response);
                }

            } else {
                Utils.debug('Non Container Deployment');
                let response = await this.nonContainerDeployment(conn, codeToDeploy);
                debug('Response => ');
                console.log(response);
                return response; //enforce response
            }

        } catch(err : any) {
            console.log(err);
            return EnForceResponse.failure(err);
        }
    }

    async nonContainerDeployment(conn : jsforce.Connection, codeToDeploy : CodeToDeploy) {
        debug('Deploying ' + codeToDeploy.type + ' | ' + codeToDeploy.id);
        let resp : any = null;
        try {
            if(codeToDeploy.id) {
                debug('UPDATE')
                let payload : any = {
                    Id : codeToDeploy.id
                }
                if(codeToDeploy.type == CodeEntity.StaticResource) {
                    payload['Body'] = codeToDeploy.Body;
                    payload['ContentType'] = codeToDeploy.mimeType;
                } else {
                    payload['Source'] = codeToDeploy.Body;
                }
                resp = await conn.tooling.sobject(this.nonContainerDeployable[codeToDeploy.type]).update(payload);
            }
            return EnForceResponse.success(resp);
        } catch(err : any) {
            resp = {
                id : codeToDeploy.id,
                success: false,
                errors : [{
                    errorCode : err.errorCode,
                    fields : err.fields,
                    name : err.name,
                    message : err.message,
                }]
            };
            return EnForceResponse.failure(new Error('Deployment failed'), resp);
        }
    }

    async metadataContainer(conn : jsforce.Connection, name : string) {
        debug('MetadataContainer');
        let mdContainer : any = await conn.tooling.query(`SELECT Id, Name FROM MetadataContainer WHERE Name = '${name}' LIMIT 1`);
        if(mdContainer.totalSize == 0) {
            debug('Creating MetadataContainer...');
            mdContainer = await conn.tooling.sobject('MetadataContainer').create({
                Name : name
            });
        } else {
            mdContainer = mdContainer.records[0];
            debug('MetadataContainer found');
        }
        debug('MetadataContainer = ' + JSON.stringify(mdContainer));
        return mdContainer;
    }

    async metadataContainerMember(conn : jsforce.Connection, type : string, contentEntityId : string, content : string, metadataContainerId : string) {
        let memberJson : {[key : string] : string} = {
            ContentEntityId : contentEntityId,
            Body : content,
            MetadataContainerId : metadataContainerId,
            // Metadata : {
            //     apiVersion : 54,
            //     packageVersions : [],
            //     status : "Active",
            //     urls : null
            // }
        };

        let sobj = this.containerDeployable[type];
        let memberRec : any = {};
        if(contentEntityId) {
            memberRec = await conn.tooling.query(`SELECT Id, MetadataContainerId, Body, ContentEntityId FROM ${sobj} WHERE MetadataContainerId='${metadataContainerId}' AND ContentEntityId='${contentEntityId}' LIMIT 1`);
        }
        if(contentEntityId && memberRec.totalSize > 0) {
            debug('Reusing ' + sobj);
            memberRec = memberRec.records[0];
            // memberJson['id'] = 
            memberJson['Id'] = memberRec.Id;
            memberRec = await conn.tooling.sobject(sobj).update({
                Id : memberRec.Id,
                Body : memberJson['Body']
            });
        } else {
            debug('Creating ' + sobj);
            memberRec = await conn.tooling.sobject(sobj).create(memberJson);
        }
        return memberRec;
    }

    async containerAsyncRequest(conn : jsforce.Connection, mdcId : string) {
        debug('Creating ContainerAsyncRequest');
        let containerAsyncReq : any = await conn.tooling.sobject('ContainerAsyncRequest').create({
            isCheckOnly : false,
            IsRunTests : false,
            MetadataContainerId : mdcId
        });
        debug('ContainerAsyncRequest = ' + JSON.stringify(containerAsyncReq));
        
        while(containerAsyncReq.State != 'Completed' && containerAsyncReq.State != 'Failed') {
            containerAsyncReq = await conn.tooling.query(`SELECT Id, State, MetadataContainerId, DeployDetails FROM ContainerAsyncRequest WHERE Id = '${containerAsyncReq.id || containerAsyncReq.Id}' LIMIT 1`);
            containerAsyncReq = containerAsyncReq.records[0];
            debug('ContainerAsyncRequest State = ' + containerAsyncReq.State);
            await this.sleep(1000);
        }

        debug(`Deployment ${containerAsyncReq.State} [ApexClass, VFPage, VFComponent] -> `);
        console.log(containerAsyncReq.DeployDetails);

        return containerAsyncReq;
    }

    async bulkDeploy(conn : jsforce.Connection, codeToDeploy : CodeToDeploy){

        try {
            //! PENDING ERROR HANDLING TO RETURN/DISPLAY ERROR PROPERLY AGAINST EACH DEPLOYABLE
            //! PENDING ENFORCE HANDLING
    
            //1. Create MetadataContainer
            let mdContainer = await this.metadataContainer(conn, 'EnforceDeployment');
            let mdcId = mdContainer.id || mdContainer.Id;
            
            //2. Create <*>Member
            debug('Members of MetadataContainer');
            let mdcCount = 0;
            for(let key in codeToDeploy) {
                if(!(key in this.containerDeployable)) continue;

                debug('Checking ' + key);
                let count = (<any>codeToDeploy)[key].length;
                mdcCount += count;
                if(count <= 0) {
                    debug('No ' + key + ' to deploy');
                    continue;
                }

                debug(count + ' ' + key + ' to deploy');
                for(let member of (<any>codeToDeploy)[key]) {
                    await this.metadataContainerMember(conn, key, member.id, member.Body, mdcId);
                    // debug('ApexClassMember ');
                    // console.log(member);
                }
            }
    
            //3. Create ContainerAsyncRequest
            if(mdcCount > 0) {
                await this.containerAsyncRequest(conn, mdcId);
            }

            debug('Now Deploying [Aura, LWC]');

            
            for(let key in codeToDeploy) {
                if(!(key in this.nonContainerDeployable)) continue;
                debug('Checking ' + key);
                let count = (<any>codeToDeploy)[key].length;
                if(count <= 0) {
                    debug('No ' + key + ' to deploy');
                    continue;
                }
                debug(count + ' ' + key + ' to deploy');
                for(let member of (<any>codeToDeploy)[key]) {
                    try{
                        debug('Deploying ' + member.id);
                        let res = await conn.tooling.sobject(this.nonContainerDeployable[key]).update({
                            Id : member.id, Source : member.Body
                        });
                        debug('Deployed ' + member.id);
                        console.log(res);
                    } catch(err : any) {
                        member.error = err;
                        console.log(err.message);
                    }
                }
            }
        } catch(err : any) {
            console.log(err);
        }

    }

    async sleep(ms : number) {
        return new Promise(resolve => setTimeout(resolve, ms)); // Poll every 5 seconds
    }
}