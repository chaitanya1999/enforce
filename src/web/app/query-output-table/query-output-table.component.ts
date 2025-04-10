import { KeyValuePipe } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-query-output-table',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './query-output-table.component.html',
  styleUrl: './query-output-table.component.css'
})
export class QueryOutputTableComponent implements OnChanges {
    // @Input() data : any = {};
    @Input() instanceUrl : string = '';
    _data : any = {};
    @Input() set data(x : any){
        this._data = JSON.parse(JSON.stringify(x));
        this.size = this._data?.totalSize || 0;
        this.records = this._data?.records || [];
        // this.log('set data | data = ' , this.data);
        this.log('set data | size = ' , this.size);
        this.columnsSet = new Set<string>();
        this.columns = [];
        this.parseRecords();
        // this.parseColumns();
        this.log('set data | records = ' , this.records);
        // ($('table[data-id=soqlTable]')).floatThead({
        //     position: 'fixed'
        // });
    }
    get data() : any{
        return this._data;
    }
    
    size = 0;
    records = [];
    columns : string[] = [];
    columnsSet : Set<string> = new Set<string>();
    @Input() flattenSubqueries : boolean = false;

    ngOnInit(){   
        // this.log('data set default value')
    }

    parseColumns(){
        this.columns = [];
        if(this.records && this.records.length) {
            for(let col in this.records[0]) {
                // if(col != 'attributes' && !col.startsWith('attributes.') && !col.includes('.attributes.')) 
                    this.columns.push(col);
            }
        }
    }

    parseRecords() {
        if(this.records && this.records.length) {
            let newRecords : any = [];
            for(let rec of this.records) {

                let newRec : any = {};
                for(let key in rec) {
                    let ret : any = this.processField(key, rec, '');
                    newRec = {
                        ...newRec, ...ret
                    }
                }
                newRecords.push(newRec);

                //parse columns
                for(let col in newRec) {
                    let flatBool = (this.flattenSubqueries && (!col.endsWith('__r') && !col.endsWith('__pr'))) || !this.flattenSubqueries;
                    if(!this.columnsSet.has(col) && (flatBool)) {
                        this.columns.push(col);
                        this.columnsSet.add(col);
                    }
                }
            }
            this.records = newRecords;
        }
    }

    processField(key : string, rec : any, keyPrefix : string) {
        let newRec : any = {};
        if(rec[key] && (typeof rec[key] == 'object')) {
            //either it might be lookup field of parent or subquery over child
            if('totalSize' in rec[key]) {
                //subquery
                if(this.flattenSubqueries) {
                    let i : number = 0;
                    let newRec2: any = {};
                    for(let rec2 of rec[key].records) {
                        for(let key2 in rec2) {
                            let ret : any = this.processField(key2, rec2, key+'.'+i+'.');
                            newRec = {
                                ...newRec, ...ret
                            }
                        }
                        i++;
                    }
                } else {
                    newRec[keyPrefix + key] = rec[key];
                }

            } else {
                //lookup , needs to be flattened
                newRec = this.flattenLookupFields(keyPrefix + key+'.', rec[key], true);
            }
        } else {
            newRec[keyPrefix + key] = rec[key];
        }
        return newRec;
    }

    flattenLookupFields(prefixKey : string, objToFlatten : any, keepAttribute : boolean){
        let returnObj: any = {};
        for(let key in objToFlatten) {
            if(key == 'attributes' && !keepAttribute) continue;

            if(typeof objToFlatten[key] == 'object') {
                //this means it is a nested lookup. subquery within lookup not possible hence surity.
                let obj : any = this.flattenLookupFields(prefixKey + key + '.' , objToFlatten[key], false);
                returnObj = {
                    ...returnObj , ...obj
                }
            } else {
                returnObj[prefixKey + key] = objToFlatten[key];
            }
        }
        return returnObj;
    }

    isObject(obj : any) {
        return obj && (typeof obj == 'object');
    }

    isAttribute(colName : string) {
        return colName.startsWith('attributes.') || colName.includes('.attributes.');
    }
    isAttributeType(colName : string) {
        return (colName.startsWith('attributes.type') || colName.includes('.attributes.type'));
    }
    isColumnValid(colName : string, rec : any) {
        return !!rec[colName];
    }
    getAttributeUrl(colName : string, rec : any) {
        let colUrl = colName.replace(/\.type$/, '.url');
        let url : string = rec[colUrl];
        if(!url) return '';
        let recId = url.substring(url.lastIndexOf('/'));
        return this.instanceUrl + '/' + recId;
    }

    ngOnChanges(changes: SimpleChanges) {
        // if(changes['data']) {
        //     this.log('ngOnChanges | data changed = ' , this.data);
        //     if(this.data) {
        //         this.size = this.data.totalSize || 0;
        //         this.records = this.data.records || [];
        //         this.log('ngOnChanges | data changed | size='+this.size + ' , this.records=', this.records);
        //         this.log('ngOnChanges | data changed | data.totalSize='+this.data.totalSize + ' , data.records=', this.data.records);
        //     }
        // }
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('query-output-table.component |');
        console.log(...str);
    }

    
}
