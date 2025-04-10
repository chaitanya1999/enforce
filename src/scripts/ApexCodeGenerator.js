const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const fileStream = new console.Console(fs.createWriteStream('../../output/GeneratedCode.apex'));
const debug = Utils.debug;
const ORG_NAME = '';

class ApexCodeGenerator {
    conn = null;
    fieldsToOmit = ["CreatedDate","CreatedById","LastModifiedDate","LastModifiedById","SystemModstamp","LastViewedDate","LastReferencedDate","Id","RecordTypeId","OwnerId"];
    fieldValuesToOmit = [null, false];

    constructor(){
        this.conn = new jsforce.Connection({
            version: sfApiVersion
        });
    }

    async main(){
        try{
            let creds = codeToFetch.getCreds(ORG_NAME);
            let res = null, conn = null, log = this.log;
            ({res, conn} = await Utils.handleLogin(this.conn, creds));
            let objName = 'Account';
            let query = "select FIELDS(ALL) from Account ORDER BY CreatedDate DESC LIMIT 1";
            let queryResult = await conn.query(query);
            log(`List<${objName}> recordList = new List<${objName}>();`);
            let recordCount = queryResult.totalSize;
            let recs = JSON.parse(JSON.stringify(queryResult.records));

            //for each record
            for(let record of recs){
                console.log(JSON.stringify(record));
                log(`recordList.add( new ${objName}(`);
        
                let str=null;
                //for each field in given record
                for(let field in record){
                    //if field value not standard/lookup record/to be omitted
                    if(typeof record[field] !== 'object' && !this.fieldValuesToOmit.includes(record[field]) && !this.fieldsToOmit.includes(field)  ){
                        //field logging logic
                        if(str!==null){
                            log(str + ',');
                        }
        
                        let value = record[field];
                        if(typeof value === 'string') value = `'${value}'`;
                        str = `\t\t\t${field} = ${value}`
                    }
                }
                if(str!==null){
                    log(str);
                }
                log('));');
            }
        } catch(err){
            debug("Error => " + err);
        }
    }

    log(...x){
        console.log(...x);
        fileStream.log(...x);
    }
}

new ApexCodeGenerator().main();