
import * as jsforce from 'jsforce';
import {sfApiVersion} from '../salesforce.service';
import Utils,{EnForceResponse} from '../enforce-utils';
const {debug} = Utils;

export class QueryTool {
    conn : jsforce.Connection;
    currentOrgName? : string;
    connected : boolean = false;
    consoleMode : boolean = false;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://login.salesforce.com',
            version: sfApiVersion
        });
    }

    async executeSOQL(orgNm : string, soqlQuery : string, fetchDeleted : boolean, toolingApi : boolean){
        try{
            let creds = Utils.getOrg(orgNm);
            let res : any = null;
            let conn : jsforce.Connection;
            
            if(!this.connected || this.currentOrgName != orgNm){
                ({res, conn} = await Utils.handleLogin(this.conn, creds));
                this.conn = conn;
                this.currentOrgName = orgNm;
            } else {
                conn = this.conn;
            }
            let query = soqlQuery;
            console.log(query);

            let queryResult : any;
            debug('Executing Query');

            let records : any = [];
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
            return EnForceResponse.success(queryResult);
        } catch(err : any){
            debug('ERROR => ')
            console.log(err);
            console.error(err.toString());
            console.error("StackTrace => " + err.stackTrace);
            return EnForceResponse.failure(err);
        }
    }
}