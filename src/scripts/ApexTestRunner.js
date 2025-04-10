const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const Utils = require('./Utils');
const debug = Utils.debug;
const ORG_NAME = '';


class ApexTestRunner {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(orgName){
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
    
            let identity = await conn.identity();
            let toolingUrl = identity.urls.tooling_rest;
            toolingUrl = toolingUrl.replace('{version}', sfApiVersion);
            debug("Tooling API Url = " + toolingUrl);
    
            debug('Running Tests');
            res = await conn.requestPost(
                toolingUrl + 'runTestsAsynchronous',
                {
                    "tests" : [
                        {
                            className : '',
                            testMethods : ['']
                        },
                        // {
                        //     className : '',
                        //     testMethods : ['','']
                        // }
                    ]
                }
            );
    
            debug('Test Run Job Id = ' + res);
            let jobId = res;
    
            res = await conn.query(`SELECT Id, ApexClass.Name, MethodName, Outcome FROM ApexTestResult WHERE AsyncApexJobId = '${jobId}' `);
            
            debug('ApexTestResult = ' + res.records.length);
            for(let r of res.records){
                delete r.attributes;
                r.ApexClass = r.ApexClass.Name;
            }
            console.table(res.records);
        } catch(err){
            console.log(err);
        }
    }
}
module.exports = ApexTestRunner;

if(require.main === module) new ApexTestRunner().main(ORG_NAME);