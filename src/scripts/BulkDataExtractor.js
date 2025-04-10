const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const debug = Utils.debug;

//DEFINE the params here
const PARAMS = {

    orgName : '', 
    
    query : '',
    
    columns : 'A,B,C\n',

    filterMode : false, //defines whether to use filter function or not. in latter case, streams will directly be piped for better performance.

    filterRecord : function(data) {
        /* object keys will be flattened for lookup fields example - data['Lookup1__r.Lookup2__r.Field__c'] */

        // return data['Lookup1__r.Lookup2__r.Field__c'] != data['Lookup3__r.Field__c'];
        return true;
    }

}


class BulkDataExtractor {
    async main(params) {
        let orgName = params.orgName;
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            debug(orgName);
            let res = null;
            let creds = codeToFetch.getCreds(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds));
            console.log(res);
            let writeStream = fs.createWriteStream(__dirname + '/../../output/dump.csv');
            writeStream.write(params.columns);
            let soqlQuery = params.query;
    
            let recordStream = await conn.bulk.query(soqlQuery);
            let total = 0, filtered = 0;

            debug('FILTER MODE = ' + params.filterMode);
            if(!params.filterMode) {
                recordStream.stream().pipe(writeStream);
            }
            else {
                recordStream.on('record', (data) => {
                    total++;
                    if(params.filterRecord(data)) {
                        filtered++;
                        console.log('found filtered record');
                        writeStream.write(this.convertObjectToCSVRow(data));
                    }
                });
    
            }
            recordStream.on('finish', ()=>{
                debug('Total = ' + total + ' , Filtered = ' + filtered);
            })
    
        } catch (err) {
            console.log(err);
        }
    }

    convertObjectToCSVRow(object) {
        //assumption - object is single level onyl
        let str = ``;
        for(let key in object) {
            str += object[key] + ','
        }
        return str.replace(/,$/, '\n');
    }
}

new BulkDataExtractor().main(PARAMS);