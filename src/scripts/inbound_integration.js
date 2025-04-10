const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const Utils = require('./Utils');

const ORG_NAME = '';

async function main(){
    try {
        let conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
        let res = null;
        let creds = codeToFetch.getCreds(ORG_NAME);
        ({res, conn} = await Utils.handleLogin(conn, creds));
        console.log(res);
        // let endPoint = '/endPoint1/';
        let endPoint = '/endPoint2/';

        res = await conn.apex.post(endPoint, {
            
        });
        
        console.log(JSON.stringify(res, 2));
    } catch(err){
        console.log(err);
    }
}

main();