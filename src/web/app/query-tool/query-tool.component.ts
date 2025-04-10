import { Component, Input } from '@angular/core';
import { OrgCredential } from '../OrgCredential';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../../ipc.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QueryOutputTableComponent } from '../query-output-table/query-output-table.component';
import { ChangeDetectorRef } from '@angular/core';
import { EnForceResponse } from '../enforce-utils';



@Component({
  selector: 'app-query-tool',
  standalone: true,
  imports: [FormsModule, MatProgressSpinnerModule, QueryOutputTableComponent],
  templateUrl: './query-tool.component.html',
  styleUrl: './query-tool.component.css'
})
export class QueryToolComponent {
    selectedOrg: string = '';
    selectedEntityType: string = '';
    showSpinner : boolean = false;
    flattenSubqueries : boolean = false;
    // set flattenSubqueries(x : any) {
    //     this._flattenSubqueries = x;
    //     console.log('#$#$ flat = ' + x);
    //     if(this.queryOutputSuccess) {
    //         this.tableData = JSON.parse(JSON.stringify(this.queryOutput));
    //     }
    //     this.ref.detectChanges();
    // }
    // get flattenSubqueries() : boolean {
    //     return this._flattenSubqueries;
    // }
    toolingApi : boolean = false;
    fetchDeleted : boolean = false;

    @Input() orgCredsList: OrgCredential[] = [
        <OrgCredential>{
            orgName: 'dummy',
            username: 'username asdf'
        }
    ];
    @Input() orgCredsMap: Map<string, OrgCredential> = new Map<string, OrgCredential>();
    soqlQuery : string = "SELECT Id FROM Account LIMIT 10";
    queryOutput : any = {};
    queryOutputSuccess : boolean = true;
    queryError : string = '';
    tableData : any = null;
    filterInput : string = '';
    instanceUrl : string = '';
    queryHistory : SelectOption[] = [];
    defaultQueryHistoryOption : SelectOption = {label : 'Query History', value : ''};
    selectedQueryHistory : SelectOption = this.defaultQueryHistoryOption;
    // selectedQueryHistoryQuery : string = '';
    MAX_QUERY_HISTORY : number = 15;

    constructor(private _ipc:IpcService, private ref: ChangeDetectorRef){

    }

    ngOnInit() {
        this.tableData=this.queryOutput;
        this.queryOutputSuccess = true;
        let str = localStorage.getItem('queryHistory');
        if(str) this.queryHistory = JSON.parse(str);
        // this.queryHistory.unshift(this.defaultQueryHistoryOption);
        this.selectedQueryHistory = this.defaultQueryHistoryOption;
    }

    async onOrgSelect(value: any) {
        this.log('onOrgSelect | value = ' , value);
        this.selectedOrg = value;
        this.instanceUrl = '';
        this.log('onOrgSelect | selectedOrg = ' + this.selectedOrg);
        if(this.selectedOrg == '--Org--' || !this.selectedOrg) 
            return;
    }

    async authenticate() {
        this.log('authenticate')
        this.showSpinner = true;
        await this._ipc.authenticate('OneClick');
        this.showSpinner = false;
    }

    async executeQuery() {
        this.log('executeQuery');
        if(!this.selectedOrg) {
            alert('select org');
            return;
        }
        if(!this.soqlQuery) {
            alert('query cannot be empty');
            return;
        }
        this.filterInput = '';
        let params = {
            orgName : this.selectedOrg,
            soqlQuery : this.soqlQuery,
            fetchDeleted : this.fetchDeleted,
            toolingApi : this.toolingApi
        };
        this.showSpinner = true;

        if(!this.instanceUrl || this.instanceUrl == '') {
            let response : string = <string> await this._ipc.callMethod('getInstanceURL', {orgName : this.selectedOrg});
            this.instanceUrl = response;
        }

        let response : EnForceResponse = <EnForceResponse> await this._ipc.callMethod('executeQuery', params);
        if(response.isSuccess) {
            this.queryOutput = response.data;
            this.tableData = this.queryOutput;
            this.queryOutputSuccess = true;
            this.queryError = '';
            
            //add query to history
            let tokens = this.soqlQuery.split(/\s+/g);
            let objIndex = tokens.findIndex(x => !!x.match(/from/i)?.length) + 1;
            this.queryHistory.unshift(<SelectOption>{
                label : /*tokens[objIndex] + ' : ' +*/ this.soqlQuery.substring(0, Math.min(this.soqlQuery.length, 100)) + '...',
                value : this.soqlQuery,
                value1 : tokens[objIndex]
            })

            if(this.queryHistory?.length > this.MAX_QUERY_HISTORY) {
                this.queryHistory.pop();
            }

            //save history
            localStorage.setItem('queryHistory', JSON.stringify(this.queryHistory));
        } else {
            this.queryOutput = response.errors[0].message;
            this.tableData = null;
            this.queryOutputSuccess = false;
            this.queryError = response.errors[0].message;
        }
        this.showSpinner = false;
    }

    onInputFilter() {
        this.log('onInputFilter | ' + this.filterInput)
        if(this.queryOutputSuccess) {
            if(!this.filterInput || this.filterInput == '') {
                this.tableData = this.queryOutput;
            } else {
                this.filter(this.queryOutput, false);
            }
        }
    }

    filter(obj : any, subQuery : boolean) : any{
        this.log('filter');
        let records = obj.records;
        let flag = false;
        let newRecords: any = [];
        for(let rec of records) {
            for(let key in rec) {
                if(key=='attributes') continue;
                if(!rec[key] || typeof rec[key] != 'object') {
                    let value = "" + (rec[key] ?? '');
                    if(value.toUpperCase().includes(this.filterInput.toUpperCase())) {
                        newRecords.push(rec);
                        flag = true;
                        break;
                    }
                } else if('totalSize' in rec[key]) {
                    //subquery
                    flag = this.filter(rec[key] , true)[0];
                } else {
                    //lookup
                    flag = this.filterSearchLookup(rec[key]);
                }
            }
        }

        if(!subQuery) {
            // this.tableData.records = newRecords;
            let newTableData : any = {};
            for(let key in this.tableData) {
                if(key != 'records') 
                    newTableData[key] = this.tableData[key];
            }
            newTableData.totalSize = newRecords.length;
            newTableData.records = newRecords;
            this.tableData = newTableData;
            // this.tableData = this.tableData;
        }
        return [flag, newRecords];
    }

    filterSearchLookup(obj : any) : boolean {
        this.log('filterSearchLookup');
        let flag = false;
        for(let key in obj) {
            if(key == 'attributes') continue;
            if(typeof obj[key] == 'object') 
                flag = this.filterSearchLookup(obj[key]);
            else
                flag = (obj[key] ?? '').toUpperCase().includes(this.filterInput);

            if(flag) break;
        }
        return flag;
    }

    onFlattenCheckbox(value : any) {
        this.flattenSubqueries = value;
        this.ref.detectChanges();
        this.tableData = {
            ...this.tableData
        };
    }

    onQueryTyped() {
        this.selectedQueryHistory = this.defaultQueryHistoryOption;
    }

    onQueryHistorySelect(event: any) {
        if(this.selectedQueryHistory.value != 'Query History')
            this.soqlQuery = this.selectedQueryHistory.value;

        // this.soqlQuery = query.value;
    }

    onKeyPress(evt : KeyboardEvent) {
        this.log('#$#$ Key Down = ' , evt);
        if(evt.key == '\n') {
            this.executeQuery();
        }
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('query-tool.component |');
        console.log(...str);
    }
}
