const codeToFetch = require('./codeToFetch')
const sfApiVersion = '52.0';
const jsforce = require('jsforce');
const fs = require('fs')
const Utils = require('./Utils');
const fileStream = new console.Console(fs.createWriteStream('../../output/ApexCodeCoverage.txt'));
const debug = Utils.debug;

//add apex classes/triggers here
const orgName = "";
const apexClassesOrTrigger = [

];

class ApexCodeCoverage {
    conn = null;

    constructor(){
        this.conn = new jsforce.Connection({
            loginUrl: 'https://test.salesforce.com',
            version: sfApiVersion
        });
    }

    async main(){
        try{
            let creds = codeToFetch.getCreds(orgName);
            let res = null, conn = null, log = this.log;
            ({res, conn} = await Utils.handleLogin(this.conn, creds));

            let args =  Array.from(process.argv);
            if(args.includes('--d')){
                //detail mode
                this.detailedCoverage(conn);
            } else {
                let query = `select id,ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered 
                            from ApexCodeCoverageAggregate where ApexClassOrTrigger.Name IN ${Utils.arrayToInClauseRHS(apexClassesOrTrigger, true)}`;
                let queryResult = await conn.tooling.query(query);
                console.log("==================== Apex Classes Code Coverage ====================");
                for(let record of queryResult.records){
                    let name = record?.ApexClassOrTrigger?.Name;
                    let coveredLines = record.NumLinesCovered;
                    let uncoveredLines = record.NumLinesUncovered;
                    let totalLines = coveredLines + uncoveredLines;
                    let coverage = 100*coveredLines / totalLines;
                    if(coveredLines == 0 || totalLines == 0) coverage = 0;
                    else coverage = Math.round(coverage * 100)/100;
                    console.log(name + ' '.repeat(50-name.length) + coverage + ' (' + coveredLines + ' / ' + totalLines + ')');    
                }
            }
            
        } catch(err){
            debug("Error => " + err);
            console.error(err);
        }
    }

    async detailedCoverage(conn){
        debug('Detail Mode');
        let totalLines = 0;
        let classVsCoveredLines = {};
        let testMethodVsCoverage = {};
        let classVsCoverage = {};
        let query = `SELECT Id, ApexTestClass.Name, TestMethodName, Coverage, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverage
                        WHERE ApexClassOrTrigger.Name = '${apexClassesOrTrigger[0]}'`;
        let queryResult = await conn.tooling.query(query);
        if(queryResult.records.length){
            let records = queryResult.records;
            for(let row of records){
                totalLines = row.NumLinesCovered + row.NumLinesUncovered;
                // debug('## ' + totalLines);
                classVsCoveredLines[row.ApexTestClass.Name] = classVsCoveredLines[row.ApexTestClass.Name] || new Set();
                row.Coverage.coveredLines.forEach( x => classVsCoveredLines[row.ApexTestClass.Name].add(x) )
                testMethodVsCoverage[row.ApexTestClass.Name + '.' + row.TestMethodName] = (row.Coverage.coveredLines.length * 100 / totalLines).toFixed(2);
            }

            for(let cls of Object.keys(classVsCoveredLines)){
                classVsCoverage[cls] = (classVsCoveredLines[cls].size * 100 / totalLines).toFixed(2);
            }
        }
        console.table(classVsCoverage);
        // this.log(classVsCoveredLines);
        console.table(testMethodVsCoverage);
        fileStream.log(testMethodVsCoverage);
    }

    log(...x){
        console.log(...x);
        fileStream.log(...x);
    }
}

new ApexCodeCoverage().main();