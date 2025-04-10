const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const debug = Utils.debug;

const ORG_NAME = '';

class AttachmentDownloader {

    async main(orgName, attachmentIds) {
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
            let attachmentIdVsName = {};
            if(args.has('--q')) {
                debug('Query Mode');
                let soql = `SELECT Id, Name, Body from Attachment where parentid = ''`;
                debug('Query => ' + soql);
                let res = await conn.query(soql);
                debug('Attachment count = ' + res.totalSize);
                for(let rec of res.records) {
                    attachmentIdVsName[rec.Id] = rec.Name;
                }
            } else {
                for(let aid of attachmentIds) {
                    attachmentIdVsName[aid] = '';
                }
            }
            let folderName = new Date().toLocaleString().replace(/[\/:]/g,'-').replace(/,/,'');
            let path = `../../output/attachments/${orgName}/` + folderName + '/';
            for (let attachmentId of Object.keys(attachmentIdVsName)) {
                let filePath = '';
                
                if(args.has('--q')){
                    filePath = path + attachmentId + '_' + attachmentIdVsName[attachmentId];
                } else {
                    filePath = path + attachmentId + '.txt';
                }

                fs.mkdirSync(path, { recursive: true });
                debug('Fetching Log = ' + attachmentId);
                let body = await conn.request({
                    url: conn.instanceUrl + `/services/data/v${conn.version}/sobjects/Attachment/${attachmentId}/Body/`,
                    method: 'GET'
                });
                debug('Writing Attachment = ' + filePath);
                fs.writeFileSync(filePath, body);
            }
        } catch (err) {
            console.log(err);
        }
    }
}

let attachmentIds = ['']
new AttachmentDownloader().main(ORG_NAME, attachmentIds);