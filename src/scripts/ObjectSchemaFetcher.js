const { exec } = require('child_process');
const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const {debug} = Utils;
const fileStream = new console.Console(fs.createWriteStream('../../output/tempoutput.txt'));

const ORG_NAME = '';

class ObjectSchemaFetcher {
    conn = null;
    currentOrgName = null;
    connected = false;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://login.salesforce.com',
            version: sfApiVersion
        });
    }

    async fetchSchema(orgNm, objName){
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
           
            let result = await conn.sobject(objName).describe();
            let ret = Array.from(result.fields).map(x => x.name)
            fileStream.log(JSON.stringify(result, 2));
            return {isError: false, error: null, result : ret};
        } catch(err){
            debug('ERROR => ')
            console.log(err);
            console.error(err.toString());
            console.error("StackTrace => " + err.stackTrace);
            if(err.errorCode == 'INVALID_SESSION_ID'){
                this.connected = false;
            }
            return {isError: true, error: err.toString(), result: null};
        }
    }
}

module.exports = ObjectSchemaFetcher;

if(require.main === module) new ObjectSchemaFetcher().fetchSchema(ORG_NAME, 'Account');