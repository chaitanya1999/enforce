const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const debug = Utils.debug;
const fileStream = new console.Console(fs.createWriteStream('../output/tempoutput.txt'));

const ORG_NAME = '';
const recordId = '';

class RecordHistory {
    async main(){
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = codeToFetch.getCreds(ORG_NAME);
            ({res, conn} = await Utils.handleLogin(conn, creds));
            console.log(res);
            
            let map = {};

            res = await conn.describeGlobal();
            for(let obj of res.sobjects){
                map[obj.keyPrefix] = { custom : obj.custom , name : obj.name };
            }

            let prefix = recordId.substring(0,3);
            if(map[prefix]){
                debug('Object Identified : ' + map[prefix].name);
                if(map[prefix].custom){
                    let name = map[prefix].name;
                    name = name.substring(0,name.length-3);
                    debug('Querying Record History');
                    let soql = `SELECT Id, Field, OldValue, NewValue, CreatedDate , CreatedBy.Name FROM ${name}__History WHERE ParentId = '${recordId}' 
                    ORDER BY CreatedDate DESC`;
                    
                    debug('Done');
                    res = await conn.query(soql);
                    fileStream.log(JSON.stringify(res,2));
                    
                    debug('Generating CSV');
                    let csvContent = 'Field,OldValue,NewValue,CreatedDate,CreatedBy.Name\n';
                    let tableLog = [ csvContent.split(",") ];
                    
                    for(let record of res.records){
                        csvContent += `"${record.Field}","${record.OldValue}","${record.NewValue}","${record.CreatedDate}","${record.CreatedBy.Name}"\n`;
                        tableLog.push([ record.Field, record.OldValue, record.NewValue, record.CreatedDate, record.CreatedBy.Name ]);
                    }
                    
                    fs.writeFileSync('../output/recordHistory.csv', csvContent);
                    debug('Saved CSV - /output/recordHistory.csv');

                    debug('Logging Table in Console');
                    console.table(tableLog);

                } else {
                    debug('Standard objects not supported yet');
                }
            } else {
                debug('ERROR : Unidentified Object');
            }


            // fileStream.log(JSON.stringify(res.sobjects));
            
        } catch(err){
            console.log(err);
        }
    }
}

new RecordHistory().main();
