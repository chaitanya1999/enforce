const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const ORG_NAME = '';

class ValidationRuleExtractor {
    async main(orgName){
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = codeToFetch.getCreds(orgName);
            ({res, conn} = await Utils.handleLogin(conn, creds));
            console.log(res);
            
            res = await conn.tooling.query(`select id from ValidationRule where EntityDefinition.DeveloperName = 'Case' limit 1000`);
            let i=0, allRecords=[];
            for (let record of res.records) {
                i++;
                console.log("Individual Query " + i);
                // console.log('$$ ' , record.Id);
                let resp = await conn.tooling.query(`select id, validationName, metadata from ValidationRule where id = '${record.Id}' `);
                
                console.log(JSON.stringify(resp));
                for (let r of resp.records) {
                    allRecords.push({
                        Id: r.Id,
                        ValidationName: r.ValidationName,
                        ErrorConditionFormula: r.Metadata.errorConditionFormula
                    });
                }
            }
            let content = JSON.stringify(allRecords);
            try {
                fs.writeFileSync('../../output/output.txt', content)
            } catch (err) {
                console.error(err)
            }

            // return EnForceResponse.success(result);
        } catch(err){
            console.log(err);
            // return EnForceResponse.failure();
        }
    }
}

module.exports = ValidationRuleExtractor;

if(require.main === module) {
    new ValidationRuleExtractor().main(ORG_NAME);
}
