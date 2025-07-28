import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { OrgCredential } from '../OrgCredential';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../../ipc.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QueryOutputTableComponent } from '../query-output-table/query-output-table.component';
import { ChangeDetectorRef } from '@angular/core';
import { EnForceResponse } from '../enforce-utils';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { MatSnackBar, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { GlobalEventsService } from '../global-events.service';



@Component({
  selector: 'app-query-tool',
  standalone: true,
  imports: [FormsModule, MatProgressSpinnerModule, QueryOutputTableComponent, CodeEditorComponent],
  templateUrl: './query-tool.component.html',
  styleUrl: './query-tool.component.css'
})
export class QueryToolComponent {
    @Input() isComponentActive : boolean = false;
    
    selectedOrg: string = '--Org--';
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

    get isOrgSelected() {
        return this.selectedOrg && this.selectedOrg != '--Org--';
    }

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
    defaultQueryHistoryOption : SelectOption = {label : 'Query History', value : 'Query History'};
    selectedQueryHistory : SelectOption = this.defaultQueryHistoryOption;
    // selectedQueryHistoryQuery : string = '';
    MAX_QUERY_HISTORY : number = 15;

    // @ViewChild('queryInput') queryInputBox : ElementRef | undefined;
    @ViewChild('queryInput') queryInputBox! : CodeEditorComponent;
    parseQuerySituation : string = ''

    // Store latest cursor position for context-aware parsing
    latestCursorPos: number = 0;
    objectSuggestions: string[] = [];

    constructor(private _ipc:IpcService, private ref: ChangeDetectorRef, private snackBar: MatSnackBar, private globalEventsSvc: GlobalEventsService){

    }

    ngOnInit() {
        this.tableData=this.queryOutput;
        this.queryOutputSuccess = true;
        let str = localStorage.getItem('queryHistory');
        if(str) this.queryHistory = JSON.parse(str);
        // this.queryHistory.unshift(this.defaultQueryHistoryOption);
        this.selectedQueryHistory = this.defaultQueryHistoryOption;

        this.globalEventsSvc.tabSelectEvent.subscribe((x:any) => {
            if(x.tab.tabName == 'Query Tool') this.queryInputBox.focus();
        });
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
        if(!this.isOrgSelected) {
            this.showSnackBar('Please select an org first');
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

    // Called when code changes in the editor
    onQueryTyped(event: any) {
        this.selectedQueryHistory = this.defaultQueryHistoryOption;
        // event.value is the code string
        this.soqlQuery = event.value;
        //this.parseQueryWithLatest();
    }

    // Helper to always parse with latest state
    parseQueryWithLatest() {
        //this.parseQuery(this.soqlQuery, this.latestCursorPos);
    }

    /**
     * Parses the SOQL query and determines the context at the cursor position.
     * Sets parseQuerySituation to one of: 'select', 'field', 'from', 'object', 'where', 'condition', 'unknown', 'expecting select'.
     * @param query The current SOQL query string
     * @param cursorPos The current cursor position (number)
     */
    parseQuery(query: string, cursorPos: number) {
        if (!query || cursorPos == null || cursorPos < 0) {
            this.parseQuerySituation = '';
            this.objectSuggestions = [];
            return;
        }
        // Lowercase for easier matching, but keep original for slicing
        const upToCursor = query.slice(0, cursorPos);
        const lower = upToCursor.toLowerCase();
        // Find keyword positions (first occurrence)
        const selectMatch = /select\b/i.exec(lower);
        const fromMatch = /from\b/i.exec(lower);
        const whereMatch = /where\b/i.exec(lower);
        const groupByMatch = /group\s+by\b/i.exec(lower);
        const orderByMatch = /order\s+by\b/i.exec(lower);
        // 1. Before SELECT
        if (!selectMatch || cursorPos <= selectMatch.index + 6) {
            this.parseQuerySituation = 'select';
            this.objectSuggestions = [];
            return;
        }
        // 2. Between SELECT and FROM
        if (!fromMatch || cursorPos <= fromMatch.index + 4) {
            this.parseQuerySituation = 'field';
            this.objectSuggestions = [];
            return;
        }
        // 3. Between FROM and WHERE/GROUP BY/ORDER BY
        let afterFrom = fromMatch.index + 4;
        let nextClauseIndex = lower.length;
        if (whereMatch && whereMatch.index > afterFrom) nextClauseIndex = Math.min(nextClauseIndex, whereMatch.index);
        if (groupByMatch && groupByMatch.index > afterFrom) nextClauseIndex = Math.min(nextClauseIndex, groupByMatch.index);
        if (orderByMatch && orderByMatch.index > afterFrom) nextClauseIndex = Math.min(nextClauseIndex, orderByMatch.index);
        if (cursorPos > afterFrom && cursorPos <= nextClauseIndex) {
            this.parseQuerySituation = 'object';
            this.objectSuggestions = ['Account', 'Contact', 'Lead', 'Opportunity'];
            // Call the code editor's method to show the dropdown
            if (this.queryInputBox && this.queryInputBox.showObjectDropdown) {
                this.queryInputBox.showObjectDropdown(this.objectSuggestions);
            }
            return;
        }
        // 4. WHERE clause
        if (whereMatch && cursorPos > whereMatch.index + 5 && (!groupByMatch || cursorPos <= groupByMatch.index) && (!orderByMatch || cursorPos <= orderByMatch.index)) {
            this.parseQuerySituation = 'where';
            this.objectSuggestions = [];
            return;
        }
        // 5. GROUP BY clause
        if (groupByMatch && cursorPos > groupByMatch.index + 8 && (!orderByMatch || cursorPos <= orderByMatch.index)) {
            this.parseQuerySituation = 'groupby';
            this.objectSuggestions = [];
            return;
        }
        // 6. ORDER BY clause
        if (orderByMatch && cursorPos > orderByMatch.index + 8) {
            this.parseQuerySituation = 'orderby';
            this.objectSuggestions = [];
            return;
        }
        // Fallback
        this.parseQuerySituation = 'unknown';
        this.objectSuggestions = [];
    }

    // Called when cursor position changes in the editor
    onCodeEditorCursor(pos: { lineNumber: number, column: number }) {
        // this.latestCursorPos = this.getAbsoluteCursorPos(this.soqlQuery, pos);
        // this.parseQueryWithLatest();
    }

    // Utility: Convert (line, column) to absolute offset in the string
    getAbsoluteCursorPos(text: string, pos: { lineNumber: number, column: number }): number {
        if (!pos || !text) return 0;
        const lines = text.split('\n');
        let offset = 0;
        for (let i = 0; i < pos.lineNumber - 1; i++) {
            offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
        }
        offset += pos.column - 1;
        return offset;
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

    onMonacoInitialized(event: boolean) {
        this.log('onMonacoInitialized | event = ' + event);
        this.queryInputBox.toggleMinimap(false);
        this.queryInputBox.wordWrap(true);
    }


    showSnackBar(message : string, action? : string | null, duration? : number, verticalPosition? : MatSnackBarVerticalPosition) {
        this.snackBar.open(message, action || 'Close', {
            horizontalPosition: 'center',
            duration: duration || 2000,
            verticalPosition : verticalPosition || 'top'
        });
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('query-tool.component |');
        console.log(...str);
    }
}
