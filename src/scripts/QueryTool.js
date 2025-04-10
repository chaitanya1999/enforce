const { exec } = require('child_process');
const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const {debug, convertToTableData} = Utils;
const tableData_js = new console.Console(fs.createWriteStream('../../output/tableData.js'));
const queryOutputRaw = new console.Console(fs.createWriteStream('../../output/queryOutputRaw.json'));

const ORG_NAME = '';
const FETCH_DELETED = false;

soqlQueryDefault = `Select id from account limit 10`;

class QueryTool {
    conn = null;
    currentOrgName = null;
    connected = false;
    consoleMode = false;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://login.salesforce.com',
            version: sfApiVersion
        });
    }

    async main() {
        this.consoleMode = true;
        try {
            debug('Org - ' + ORG_NAME);
            let output = await new QueryTool().executeSOQL(ORG_NAME, soqlQueryDefault, false);
            debug('Query Executed');
            debug('Success = ' + output.isSuccess);
            if(!output.isSuccess) return;

            let rawOutput = output;

            output = Array.from(output.data.records);
            for(let rec of output){
                delete rec.attributes;
            }

            queryOutputRaw.log(JSON.stringify(rawOutput, null, 4));

            output = JSON.stringify(convertToTableData(output) , null , 4);
            tableData_js.log('var tableData = ' + output);
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
        } catch(err) {
            debug('ERROR => ')
            console.log(err);
            console.error(err.toString());
            console.error("StackTrace => " + err.stackTrace);
        }
    }

    async executeSOQL(orgNm, soqlQuery, fetchDeleted, toolingApi){
        try{
            let creds = codeToFetch.getCreds(orgNm);
            let res = null, conn = null, log = this.log;
            if(!this.connected || this.currentOrgName != orgNm){
                ({res, conn} = await Utils.handleLogin(this.conn, creds));
                this.conn = conn;
                this.currentOrgName = orgNm;
            } else {
                conn = this.conn;
            }
            let query = soqlQuery;
            console.log(query);
            // debug('MS before - ' + new Date().getTime());
            let queryResult;
            debug('Executing Query');

            let records = [];
            if(toolingApi) {
                queryResult = await conn.tooling.query(query,{scanAll: fetchDeleted});
                records = [...records , ...queryResult.records];
                while(!queryResult?.done){
                    debug("\tqueryMore");
                    queryResult = await conn.requestGet(queryResult.nextRecordsUrl);
                    records = [...records , ...queryResult.records];
                }
            } else {
                queryResult = await conn.query(query,{scanAll: fetchDeleted});
                records = [...records , ...queryResult.records];
                while(!queryResult?.done){
                    debug("\tqueryMore");
                    queryResult = await conn.requestGet(queryResult.nextRecordsUrl);
                    records = [...records , ...queryResult.records];
                }
            }
            debug('Query Executed');
            queryResult.records = records;
            // debug('MS after - ' + new Date().getTime());
            

            // let output = JSON.stringify(convertToTableData(recs) , null , 4);
            // log('var tableData = ' + output);
            // exec(`start ${__dirname}\\table.html`, (err, stdout, stderr) => {
            //     if (err) {
            //         console.error(err);
            //       // node couldn't execute the command
            //       return;
            //     }
              
            //     // the *entire* stdout and stderr (buffered)
            //     console.log(`stdout: ${stdout}`);
            //     console.log(`stderr: ${stderr}`);
            // });
            // return {isError: false, error: null, result : queryResult, instanceUrl : this.conn.instanceUrl};
            return Utils.EnForceResponse.success(queryResult);
        } catch(err){
            debug('ERROR => ')
            console.log(err);
            console.error(err.toString());
            console.error("StackTrace => " + err.stackTrace);
            return Utils.EnForceResponse.failure(err);
            // if(err.errorCode == 'INVALID_SESSION_ID'){
            //     this.connected = false;
            // }
            // return {isError: true, error: err.toString(), result: null};
        }
    }

    log(...x){
        tableData_js.log(...x);
    }
}

module.exports = QueryTool;

if(require.main === module) {
    new QueryTool().main();
}