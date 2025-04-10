const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const debug = Utils.debug;

const ORG_NAME = '';

class DebugLogDownloader {

    async main(orgName, logIds) {
        try {
            let conn = new jsforce.Connection({
                loginUrl: 'https://test.salesforce.com',
                version: sfApiVersion
            });
            let res = null;
            let creds = codeToFetch.getCreds(orgName);
            ({ res, conn } = await Utils.handleLogin(conn, creds));
            console.log(res);

            let args = new Set(Array.from(process.argv));
            if(args.has('--q')) {
                debug('Query Mode');
                let soql = `SELECT Id FROM ApexLog LIMIT 10`;
                debug('Query => ' + soql);
                let res = await conn.tooling.query(soql);
                debug('Debug Log count = ' + res.totalSize);
                logIds = [];
                for(let rec of res.records) {
                    logIds.push(rec.Id);
                }
            }
            let folderName = new Date().toLocaleString().replace(/[\/:]/g,'-').replace(/,/,'');
            let path = `../../output/debugLogs/${orgName}/` + folderName + '/';
            for (let logId of logIds) {
                let filePath = path + logId + '.log';
                fs.mkdirSync(path, { recursive: true });
                debug('Fetching Log = ' + logId);
                let logBody = await conn.request({
                    url: conn.instanceUrl + `/services/data/v${conn.version}/sobjects/ApexLog/${logId}/Body/`,
                    method: 'GET'
                });
                debug('Writing Log = ' + filePath);
                fs.writeFileSync(filePath, logBody);
            }
        } catch (err) {
            console.log(err);
        }
    }
}

let logIds = []
new DebugLogDownloader().main(ORG_NAME, logIds);