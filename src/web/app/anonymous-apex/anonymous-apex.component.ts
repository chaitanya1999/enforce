import { Component, Input, ViewChild } from '@angular/core';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { OrgCredential } from '../OrgCredential';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../../ipc.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-anonymous-apex',
  standalone: true,
  imports: [CodeEditorComponent, MatProgressSpinnerModule, FormsModule, MatSnackBarModule],
  templateUrl: './anonymous-apex.component.html',
  styleUrl: './anonymous-apex.component.css'
})
export class AnonymousApexComponent {
    selectedOrg: string = '';
    showSpinner : boolean = false;

    selectedTab : string = 'code'; //code , log

    @ViewChild('codeTab') codeTab: any;
    @ViewChild('logTab') logTab: any;
    @ViewChild('codeEditor') codeEditor! : CodeEditorComponent;
    codeModelId : string = 'editor_0';
    logModelId : string = 'editor_1';

    @Input() orgCredsList: OrgCredential[] = [
        <OrgCredential>{
            orgName: 'dummy',
            username: 'username asdf'
        }
    ];

    @Input() orgCredsMap: Map<string, OrgCredential> = new Map<string, OrgCredential>();

    code: string= "System.debug('Hello World');";
    
    apexLog: string= "";

    constructor(private _ipc : IpcService, private snackBar : MatSnackBar, private dialog : MatDialog){

    }

    async ngAfterViewInit() {
        await this.codeEditor.loadMonacoLibrary();
        this.codeModelId = this.codeEditor.createCodeEditorModel(this.code, 'apex');
        this.log('codeModelId = ' + this.codeModelId);
        this.logModelId = this.codeEditor.createCodeEditorModel(this.apexLog, 'apexlog');
        this.log('logModelId = ' + this.logModelId);
        this.codeEditor.switchModel(this.codeModelId);
        // if(!this.codeEditor.loadedMonaco) {
        // }
    }

    onOrgSelect(value : any){
        this.log('onOrgSelect | value = ' , value);
        this.selectedOrg = value;
        this.log('onOrgSelect | selectedOrg = ' + this.selectedOrg);
    }

    onTabClick(str : string) {
        this.selectedTab = str;
        console.log('#$#$#$ ' + str);

        this.codeEditor.switchModel(str == 'code' ? this.codeModelId : this.logModelId);
    }

    async executeApexScript() {
        try {
            if(this.selectedOrg == '--Org--' || !this.selectedOrg) {
                let dialogRef = this.dialog.open(AlertDialogComponent, {
                    data : {
                        content : "Select an org first."
                    }
                });
                return;
            }
            if(!this.orgCredsMap.get(this.selectedOrg)?.allowAnonymousApex) {
                let dialogRef = this.dialog.open(AlertDialogComponent, {
                    data : {
                        content : "Anonymous Apex not allowed. Enable it from org manager."
                    }
                });
                return;
            }
            this.showSpinner = true;
            this.code = this.codeEditor.getContent(this.codeModelId) || '';
            // console.log('%%%%%% ' + this.code);
            let response = <any>await this._ipc.callMethod('executeAnonymous', {
                code : this.code,
                orgName : this.selectedOrg
            });
            console.log('#$#$#$#$ apex resp' , response);
            let content = '';
            if(response.isSuccess) {
                let result = response.data?.['soapenv:Envelope']?.['soapenv:Body']?.executeAnonymousResponse?.result ?? {};
                if(result.compiled == 'true') {
                    this.snackBar.open('Anonymous apex executed succesfully', 'Close', {
                        duration: 2000,
                        verticalPosition : 'top'
                    });
                    content = response.data['soapenv:Envelope']?.['soapenv:Header']?.DebuggingInfo?.debugLog;
                } else {
                    this.snackBar.open('Anonymous apex compile error', 'Close', {
                        duration: 2000,
                        verticalPosition : 'top'
                    });
                    content = `Error : Line ${result.line}, Column ${result.column}\n${result.compileProblem}`;
                }

            } else {
                this.snackBar.open('ERROR : ' + response.errors[0].message, 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            }

            this.codeEditor.setContent(content, this.logModelId);
            this.onTabClick('log');
        } catch(err) {
            console.error(err);
        } finally {
            this.showSpinner = false;
        }
    }
    
    log(...str: any) {
        if(!str) str = [];
        str.unshift('anonymous-apex.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }
}
