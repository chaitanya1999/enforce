const excelWriter = require('write-excel-file/node')
const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const debug = Utils.debug;
const fileStream = new console.Console(fs.createWriteStream('../output/customSettingDump.txt'));
const ORG_NAME = '';

async function main(orgName){
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
        let workbook = {};
        
        debug('Fetching custom setting object list');
        debug('describeGlobal');
        res = await conn.describeGlobal();
        let CSLIST = [];
        for(let object of res.sobjects){
            if(object.customSetting) CSLIST.push(object.name);
        }
        fileStream.log(JSON.stringify(CSLIST));
        workbook['Dump Report'] = [
            [
                {
                    value: 'Custom Setting Object Name',
                    align: 'center',
                    alignVertical: 'center',
                    fontWeight : 'bold',
                    backgroundColor: '#FFFF00',
                    borderColor: '#000000',
                    borderStyle: 'thin'
                },
                {
                    value: 'Number of Records pulled',
                    align: 'center',
                    alignVertical: 'center',
                    fontWeight : 'bold',
                    backgroundColor: '#FFFF00',
                    borderColor: '#000000',
                    borderStyle: 'thin'
                }
            ]
        ];

        let objVsFields = {};
        let i=0;
        for(let customSetting of CSLIST){
            let excelData = [];
            debug('Fetching custom setting fields - ' + customSetting);
            res = await conn.sobject(customSetting).describe();
            objVsFields[customSetting] = [];
            for(let field of res.fields){
                if(field.custom || ['Id', 'Name', 'SetupOwnerId'].includes(field.name)){
                    objVsFields[customSetting].push(field.name);
                }
            }

            //header row
            let headerRow = [];
            for(let field of objVsFields[customSetting]){
                headerRow.push({
                    value: field,
                    align: 'center',
                    alignVertical: 'center',
                    fontWeight : 'bold',
                    backgroundColor: '#FFFF00',
                    borderColor: '#000000',
                    borderStyle: 'thin'
                });
            }
            excelData.push(headerRow);

            //custom setting records
            debug('Fetching records');
            let soql = `SELECT ${objVsFields[customSetting].join(',')} FROM ${customSetting}`;
            res = await conn.query(soql);

            workbook['Dump Report'].push([
                {
                    type: String,
                    value: customSetting,
                    alignVertical: 'center',
                    borderColor: '#000000',
                    borderStyle: 'thin'
                },
                {
                    type: Number,
                    value: res.totalSize,
                    alignVertical: 'center',
                    borderColor: '#000000',
                    borderStyle: 'thin'
                }
            ])

            for(let record of res.records){
                let row = [];
                for(let field of objVsFields[customSetting]){
                    row.push({
                        type: String,
                        value: String(record[field]),
                        alignVertical: 'center',
                        borderColor: '#000000',
                        borderStyle: 'thin'
                    });
                }
                excelData.push(row);
            }
            let sheetName = customSetting.substring(0,31);
            workbook[sheetName] = excelData;
            // if(i++ == 10) break;
        }        
        
        debug('Writing Excel File');
        await excelWriter(Object.values(workbook), { filePath: '../output/customSettingReport.xlsx' , sheets : Object.keys(workbook) });
        debug('Finished');
    } catch(err){
        console.log(err);
    }
}
main(ORG_NAME);