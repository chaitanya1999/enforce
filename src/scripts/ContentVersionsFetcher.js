const { exec } = require('child_process');
const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const {debug, convertToTableData} = Utils;
const fileStream = new console.Console(fs.createWriteStream('../../output/FetchedContentVersions.txt'));
const tableData_js = new console.Console(fs.createWriteStream('../../output/tableData.js'));

const ORG_NAME = '';
const linkedEntityId = '';
const FETCH_DELETED = true;

class ContentVersionFetcher {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(){
        try{
            let creds = codeToFetch.getCreds(ORG_NAME);
            let res = null, conn = null, log = this.log;
            ({res, conn} = await Utils.handleLogin(this.conn, creds));
            let query = `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${linkedEntityId}'`;
            let queryResult = await conn.query(query,{scanAll: FETCH_DELETED});
            let recs = JSON.parse(JSON.stringify(queryResult.records));

            let contentDocIds = Array.from(recs).map(r => r.ContentDocumentId);
            let count = queryResult.totalSize;
            console.log('Total Records = ' + count);
            let mainQuery = '';
            let i = 0;
            mainQuery += ('select Id,createddate,createdby.name,IsDeleted,ContentDocumentId,Title,VersionNumber from contentversion where contentdocumentid in (');
            for(let docId of contentDocIds){
                let str = '';
                if(i!=0) str += ',';
                str += `'${docId}'`;
                i++;
                mainQuery += (str);
            }
            mainQuery += (')');
            
            let contentVersions = await conn.query(mainQuery,{scanAll: FETCH_DELETED});
            console.log(contentVersions);

            contentVersions = Array.from(contentVersions.records);

            for(let cv of contentVersions){
                delete cv.attributes;
            }
            fileStream.log(JSON.stringify(contentVersions));
            let output = JSON.stringify(convertToTableData(contentVersions) , null , 4);
            log('var tableData = ' + output);
            exec(`start ${__dirname}\\table.html`, (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                  // node couldn't execute the command
                  return;
                }
              
                // the *entire* stdout and stderr (buffered)
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
            });
        } catch(err){
            debug('ERROR => ')
            console.error(err);
            console.error("StackTrace => " + err.stackTrace);
        }
    }

    log(...x){
        // fileStream.log(...x);
        tableData_js.log(...x);
    }
}

new ContentVersionFetcher().main();