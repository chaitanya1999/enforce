const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const Utils = require('./Utils');
const debug = Utils.debug;
const EnForceResponse = Utils.EnForceResponse;

const orgName = "";

class AuthTest {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(orgNm){
        try{
            let creds = codeToFetch.getCreds(orgNm);
            let res = null, conn = null;
            ({res, conn} = await Utils.handleLogin(this.conn, creds));
            debug("Authenticated ==> ");
            console.log(res);
            return EnForceResponse.success(res);
        } catch(err){
            debug("Error => " + err);
            console.error(err);
            return EnForceResponse.failure(err);
        }
    }
}
module.exports = AuthTest;

if(require.main === module) new AuthTest().main(orgName);
