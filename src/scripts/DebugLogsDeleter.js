const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const Utils = require('./Utils');
const debug = Utils.debug;

//add apex classes/triggers here
const orgName = "";
const logCount = 1000;

// MODE. 0 => Debug Log delete , 1 => Trace Flag Delete
const MODE = 0;

class DebugLogsDeleter {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(mode){
        try{
            let args =  Array.from(process.argv);
            // console.log(args);
            let creds = codeToFetch.getCreds(orgName);
            let res = null, conn = null, log = this.log;
            ({res, conn} = await Utils.handleLogin(this.conn, creds));
            let whereClause = `WHERE LogUser.Name != 'some user'`;
            let query1 = null;
            let query2 = null;
            
            if(args.includes('-d') && args.includes('-t')) mode = 2;
            else if(args.includes('-t')) mode = 1;
            else if(args.includes('-d')) mode = 0;

            if(mode == 0 || mode == 2){
                debug('MODE = DEBUG LOG');
                query1 = `SELECT Id FROM ApexLog ${whereClause} ORDER BY LastModifiedDate DESC LIMIT ${logCount}`;
            }
            if(mode == 1 || mode == 2){
                debug('MODE = TRACE FLAG');
                query2 = `SELECT Id, Apexcode, CreatedBy.name, System, TracedEntity.name FROM TraceFlag `;
            }

            let queryResult1 = null;
            let queryResult2 = null;
            if(query1) queryResult1 = await conn.tooling.query(query1);
            if(query2) queryResult2 = await conn.tooling.query(query2);
            if(queryResult1) debug("Fetched " + queryResult1.totalSize + " Debug Log IDs");
            if(queryResult2) debug("Fetched " + queryResult2.totalSize + " Trace Flag IDs");

            let logIds = [], flagIds = [];
            if(queryResult1) logIds = Array.from(queryResult1.records).map( x => x.Id );;
            if(queryResult2) flagIds = Array.from(queryResult2.records).map( x => x.Id );;

            if(mode == 1){
                // logIds = logIds.filter(x => Date.parse(x.ExpirationDate) < new Date(Date.now()));
            }

            // debug(logIds); 
            debug('COUNT = ' + logIds.length);

            if(mode == 0 || mode == 2){
                console.log(await conn.tooling.sobject('ApexLog').delete(logIds));
                console.log('Deleted ' + logIds.length + ' debug logs');
            } 
            if(mode == 1 || mode == 2){
                console.log(await conn.tooling.sobject('TraceFlag').delete(flagIds));
                console.log('Deleted ' + flagIds.length + ' trace flags');
            }
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

new DebugLogsDeleter().main(MODE);