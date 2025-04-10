const codeToFetch = require('../codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('../Utils');
const fileStream = new console.Console(fs.createWriteStream('../../output/DependencyTree.js'));
const debug = Utils.debug;

//add apex classes/triggers here
const orgName = "";
const apexClass = "";

class ApexDependencyTree {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(){
        try{
            let adjList = {};

            let creds = codeToFetch.getCreds(orgName);
            let res = null, conn = null, log = this.log;
            debug('orgName = ' + orgName);
            ({res, conn} = await Utils.handleLogin(this.conn, creds));

            debug('Fetching Apex classes Ids');
            let query = `SELECT Id , Name FROM ApexClass ORDER BY LastModifiedDate DESC LIMIT 15 OFFSET 100`;
            let queryResult = await conn.tooling.query(query);

            // let apexClassIds = new Set();
            for(let rec of queryResult.records) {
                let id = rec.Id;
                debug('Fetching dependency of - ' + rec.Name);
                let query2 = `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentName , MetadataComponentId FROM MetadataComponentDependency WHERE RefMetadataComponentType = 'ApexClass' AND MetadataComponentId = '${id}'`;
                let queryResult2 = await conn.tooling.query(query2);
                debug('Count - ' + queryResult2.totalSize);
                adjList[rec.Name] = adjList[rec.Name] || { outlinks : [] , inlinks : []};
                for(let dependencyRecord of queryResult2.records) {
                    let dependentClass = dependencyRecord.RefMetadataComponentName;
                    adjList[dependentClass] = adjList[dependentClass] || { outlinks : [] , inlinks : []} ;
                    adjList[rec.Name].outlinks.push(dependentClass);
                    adjList[dependentClass].inlinks.push(rec.Name);
                }
            }


            // adjList[apexClass] = new Set();            
            // let bfs = [];
            // let parentMap = {}
            // let query = `SELECT Id, Body, Name FROM ApexClass WHERE Name = '${apexClass}'`;
            // let queryResult = await conn.tooling.query(query);
            // for(let record of queryResult.records){
            //     let regexResult = record.Body.matchAll(/(prefix)[a-zA-Z0-9_]+/gi);
            //     let childClasses = new Set([...regexResult].map(x => x[0]).filter(x => x != apexClass));
            //     bfs = Array.from(childClasses);
            //     childClasses.forEach(cc => {parentMap[cc] = apexClass} );
            //     adjList[apexClass] = new Set(Array.from(childClasses));
            //     console.log(adjList);
            // }
            // // console.log(parentMap);

            // let d = 1;
            // while(bfs.length && d++ <= 3){
            //     let query = `SELECT Id, Body, Name FROM ApexClass WHERE Name IN ${Utils.arrayToInClauseRHS(bfs, true)}`;
            //     let queryResult = await conn.tooling.query(query);
            //     let newbfs = [];
            //     let newParentMap = {};
            //     for(let record of queryResult.records){
            //         let classParent = parentMap[record.Name];
            //         adjList[classParent] = (adjList[classParent] || new Set()).add(record.Name);

            //         let regexResult = record.Body.matchAll(/(prefix)[a-zA-Z0-9_]+/gi);
            //         let childClasses = new Set([...regexResult].map(x => x[0]).filter(x => x != record.Name));
            //         childClasses.forEach(cc => {newParentMap[cc] = record.Name} );
            //         newbfs = [...newbfs , ...childClasses];                    
            //     }

            //     parentMap = newParentMap;
            //     bfs = newbfs;
            //     // console.log(bfs);
            // }

            // for(let x in adjList){
            //     adjList[x] = Array.from(adjList[x]);
            // }
            
            fileStream.log('var apexTree = ' + JSON.stringify(adjList, null, 2));
            // console.log(JSON.stringify(adjList));
            
        } catch(err){
            debug("Error => " + err);
            console.error(err);
        }
    }

    log(...x){
        console.log(...x);
        fileStream.log(...x);
    }
}

new ApexDependencyTree().main();