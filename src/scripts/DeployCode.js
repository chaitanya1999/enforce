const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const Utils = require('./Utils');
const EnForceResponse = Utils.EnForceResponse;
const debug = Utils.debug;

const ORG_NAME = '';


let codeToDeploy = {
    type : '',
    id : '',
    Body : ``
}

/*Bulk Deployment Mode - TO be used later*/
// let codeToDeploy = {
//     ApexClass : [
//         {id : '', Body : classContent}
//     ],
//     AuraComponent : [
//         {id : '', Body : `
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
class DeployCode {

    containerDeployable = {
        'ApexClass' : 'ApexClassMember', 'VFPage' : 'ApexPageMember', 'VFComponent' : 'ApexComponentMember'
    };

    nonContainerDeployable  = {'AuraComponent' : 'AuraDefinition', 'LWC' : 'LightningComponentResource'};

    async main(orgName, codeToDeploy) {
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = codeToFetch.getCreds(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds));

            // await this.bulkDeploy(conn, codeToDeploy);
            let response = await this.singleDeploy(conn, codeToDeploy);
            return response;
        } catch(err) {
            console.log(err);
            return EnForceResponse.failure(err);
        }
    }

    async singleDeploy(conn, codeToDeploy) {
        try {

            if(codeToDeploy.type in this.containerDeployable) {
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
                let response = await this.nonContainerDeployment(conn, codeToDeploy);
                debug('Response => ');
                console.log(response);
                return response; //enforce response
            }

        } catch(err) {
            console.log(err);
        }
    }

    async nonContainerDeployment(conn, codeToDeploy) {
        debug('Deploying ' + codeToDeploy.type + ' | ' + codeToDeploy.id);
        let resp = null;
        try {
            resp = await conn.tooling.sobject(this.nonContainerDeployable[codeToDeploy.type]).update({
                Id : codeToDeploy.id, Source : codeToDeploy.Body
            });
            return EnForceResponse.success(resp);
        } catch(err) {
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

    async metadataContainer(conn, name) {
        debug('MetadataContainer');
        let mdContainer = await conn.tooling.query(`SELECT Id, Name FROM MetadataContainer WHERE Name = '${name}' LIMIT 1`);
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

    async metadataContainerMember(conn, type, contentEntityId, content, metadataContainerId) {
        let memberJson = {
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
        let memberRec = await conn.tooling.query(`SELECT Id, MetadataContainerId, Body, ContentEntityId FROM ${sobj} WHERE MetadataContainerId='${metadataContainerId}' AND ContentEntityId='${contentEntityId}' LIMIT 1`);
        if(memberRec.totalSize > 0) {
            debug('Reusing ' + sobj);
            memberRec = memberRec.records[0];
            // memberJson['id'] = 
            memberJson['Id'] = memberRec.Id;
            memberRec = await conn.tooling.sobject(sobj).update({
                Id : memberRec.Id,
                Body : memberJson.Body
            });
        } else {
            debug('Creating ' + sobj);
            memberRec = await conn.tooling.sobject(sobj).create(memberJson);
        }
        return memberRec;
    }

    async containerAsyncRequest(conn, mdcId) {
        debug('Creating ContainerAsyncRequest');
        let containerAsyncReq = await conn.tooling.sobject('ContainerAsyncRequest').create({
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

    async bulkDeploy(conn, codeToDeploy){

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
                let count = codeToDeploy[key].length;
                mdcCount += count;
                if(count <= 0) {
                    debug('No ' + key + ' to deploy');
                    continue;
                }

                debug(count + ' ' + key + ' to deploy');
                for(let member of codeToDeploy[key]) {
                    await this.metadataContainerMember(conn, member.id, member.Body, mdcId);
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
                let count = codeToDeploy[key].length;
                if(count <= 0) {
                    debug('No ' + key + ' to deploy');
                    continue;
                }
                debug(count + ' ' + key + ' to deploy');
                for(let member of codeToDeploy[key]) {
                    try{
                        debug('Deploying ' + member.id);
                        let res = await conn.tooling.sobject(this.nonContainerDeployable[key]).update({
                            Id : member.id, Source : member.Body
                        });
                        debug('Deployed ' + member.id);
                        console.log(res);
                    } catch(err) {
                        member.error = err;
                        console.log(err.message);
                    }
                }
            }
        } catch(err) {
            console.log(err);
        }

    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms)); // Poll every 5 seconds
    }
}

module.exports = DeployCode;

if(require.main === module) {
    new DeployCode().main(ORG_NAME, codeToDeploy);
}