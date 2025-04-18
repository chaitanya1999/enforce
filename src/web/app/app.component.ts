import { Component, ChangeDetectorRef, importProvidersFrom, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IpcService } from '../ipc.service';
import {FormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatTabsModule} from '@angular/material/tabs';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import { CodeBrowserComponent } from './code-browser/code-browser.component';
import { OrgCredential } from './OrgCredential';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { Title } from '@angular/platform-browser';
import { QueryToolComponent } from './query-tool/query-tool.component';
import { AppHelpComponent } from './app-help/app-help.component';
import { AnonymousApexComponent } from './anonymous-apex/anonymous-apex.component';
import { GlobalEventsService } from './global-events.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AlertDialogComponent } from './alert-dialog/alert-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { NewOrgDialogComponent } from './new-org-dialog/new-org-dialog.component';
import { EnForceResponse } from './enforce-utils';
import {MatTooltipModule} from '@angular/material/tooltip';


class NavTab {
    tabName : string = '';
    template : string = '';
    active : boolean = false;
    icon? : string;
    iconActive? : string;
}

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, MatTabsModule, MatCardModule, MatButtonModule, CodeBrowserComponent, MatSnackBarModule, QueryToolComponent, AnonymousApexComponent, MatDialogModule, AppHelpComponent, MatTooltipModule ],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})

export class AppComponent {

    webMode : boolean = false;

    selectedOrg: String = '';

    _orgCredsList: OrgCredential[] = [
        <OrgCredential>{
            orgName: 'dummy',
            username: 'username asdf'
        }
    ];

    set orgCredsList(value : OrgCredential[]) {
        this._orgCredsList = value;
        this.filteredCredsList = value;
        this.searchText = '';
        this.orgCredsMap = new Map<string, OrgCredential>();
        for(let x of this.orgCredsList) {
            this.orgCredsMap.set(x.orgName, x);
        }
    }

    get orgCredsList() : OrgCredential[] {
        return this._orgCredsList;
    }

    filteredCredsList = this.orgCredsList;
    @ViewChild('credsSearch') credsSearch : ElementRef | undefined;

    orgCredsMap : Map<string, OrgCredential> = new Map<string, OrgCredential>();

	title = 'EnForce'; 
	electron : any = null;
    ipcService : IpcService;
    authentication = false;

    navTabs : NavTab[] = [
        // { tabName : '&#9729; Org<br/>Manager' , active : false , template : 'credentialsManager', icon : '../assets/tab-icon-org-manager.png'},
        // { tabName : '&#128187; Code<br/>Browser' , active : false , template : 'codeBrowser'},
        // { tabName : '&#128269; Query<br/>Tool' , active : false , template : 'queryTool'},
        // { tabName : '&#128295; Anon<br/>Apex' , active : false , template : 'anonApex'},
        // { tabName : '&#63; Help' , active : true , template : 'help'},
        { tabName : 'Org Manager' , active : false , template : 'credentialsManager', icon : '../assets/tab-icon-org-manager.png', iconActive : '../assets/tab-icon-org-manager-active.png' },
        { tabName : 'Code Browser' , active : false , template : 'codeBrowser', icon : '../assets/tab-icon-code-browser.png', iconActive : '../assets/tab-icon-code-browser-active.png' },
        { tabName : 'Query Tool' , active : false , template : 'queryTool', icon : '../assets/tab-icon-query-tool.png', iconActive : '../assets/tab-icon-query-tool-active.png' },
        { tabName : 'Anonymous Apex' , active : false , template : 'anonApex', icon : '../assets/tab-icon-anonymous-apex.png', iconActive : '../assets/tab-icon-anonymous-apex-active.png' },
        { tabName : 'Help' , active : true , template : 'help', icon : '../assets/tab-icon-help.png', iconActive : '../assets/tab-icon-help-active.png' },
    ]
    selectedTabTemplate : string = 'codeBrowser';

    searchText : string = '';

    constructor(private readonly _ipc: IpcService, private ref: ChangeDetectorRef, private snackBar: MatSnackBar, private titleService:Title
        , private globalEventsSvc: GlobalEventsService 
        , private dialog : MatDialog
    ){ 
        this.ipcService = _ipc;
        this.getCreds(ref);
        titleService.setTitle('EnForce IDE');
        this.webMode = !(<any>window).desktopMode;
    }

    setTitle(x: string) {
        this.title = x;
    }

    async getCreds(ref: ChangeDetectorRef) {
        console.log('app.component | getCreds');
        let creds = await this.ipcService.getOrgs();
        this.orgCredsList = <OrgCredential[]>Object.values(<object>creds);
        this.orgCredsList.sort((a: OrgCredential , b: OrgCredential) : number => {
            return a.orgName.localeCompare(b.orgName);
        });
        this.orgCredsMap = new Map<string, OrgCredential>();
        for(let x of this.orgCredsList) {
            this.orgCredsMap.set(x.orgName, x);
        }
        console.log('app.component | getCreds | this.orgCredsList = ' , this.orgCredsList);
        this.filteredCredsList = this.orgCredsList;
        ref.detectChanges();
    }

    async authenticate(orgCred : OrgCredential) {
        let orgName = orgCred.orgName;
        try {
            this.authentication = true;
            console.log('app.component | authorize')
            let response : EnForceResponse = <EnForceResponse>(await this._ipc.authenticate(orgName));
            console.log('app.component | response = ' , response);
            if(response.isSuccess) {
                orgCred.authenticated = 'Success';
                this.snackBar.open('Authentication Success', 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            } else {
                orgCred.authenticated = 'Failure';
                this.snackBar.open('Auth Error : ' + response.errors[0].message, 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            }
        } catch(err) { 
            console.error(err);
        } finally {
            this.authentication = false;
        }
    }

    deleteOrg(orgCred : OrgCredential) {
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data : {
                text : "Are you sure to delete Org - " + orgCred.orgName + " ?"
            }
        });
        dialogRef.afterClosed().subscribe(async result => {
            if(result) {
                console.log('deleting org');
                this.orgCredsList = this.orgCredsList.filter((x : OrgCredential) => !this.compareCreds(x, orgCred));
                this.saveOrgCreds();
            }
        });
    }

	async ngOnInit() {
		this.selectedTabTemplate = this.navTabs.find(x => x.active)?.template ?? '';
        document.addEventListener('click', (e) => {
            this.globalEventsSvc.globalClickEvent.emit(e);
        })
	}

    selectTab(tab : NavTab) {
        this.navTabs.forEach(x => x.active = false);
        tab.active = true;
        this.selectedTabTemplate = tab.template;
    }

    minimize() {
        this._ipc.callMethod('minimize');
    }
    
    maximize() {
        this._ipc.callMethod('maximize');
    }

    close() {
        this._ipc.callMethod('close');
    }

    async editOrg(orgCred: OrgCredential) {
        if(orgCred.edit) {
            this.saveOrgCreds();
        }
        orgCred.edit = !orgCred.edit;
    }
    async saveOrgCreds() {
        try{
            this.authentication = true;
            let credsList = JSON.parse(JSON.stringify(this.orgCredsList));
            let modifiedCredsList : any = {};
            for(let cred of credsList) {
                let orgName = cred.orgName;
                delete cred.edit;
                delete cred.orgName;
                delete cred.authenticated;
                modifiedCredsList[orgName] = cred;
            }
            console.log('app.component | saveCreds | ' , modifiedCredsList);
            await this._ipc.callMethod('setCredentials', modifiedCredsList);
        } finally {
            this.authentication = false;
        }
    }

    onCredentialSearch() {
        let text = (this.credsSearch?.nativeElement?.value || '').toLowerCase();
        console.log('onCredentialSearch | ' + text);
        this.filteredCredsList = this.orgCredsList.filter(x => (x.orgName.toLowerCase().includes(text)/* || x.username.toLowerCase().includes(text)*/));
        this.filteredCredsList.push(...this.orgCredsList.filter(x => (x.username.toLowerCase().includes(text) && !this.filteredCredsList.includes(x))));
        console.log('onCredentialSearch | ' + this.filteredCredsList.length);
    }

    compareCreds(orgCred1 : OrgCredential, orgCred2 : OrgCredential) {
        return orgCred1.orgName == orgCred2.orgName && orgCred1.loginUrl == orgCred2.loginUrl && orgCred1.username == orgCred2.username
        && orgCred1.password == orgCred2.password;
    }

    addNewOrg() {
        this.dialog.open(NewOrgDialogComponent, {
            data : this.orgCredsMap
        }).afterClosed().subscribe((result) => {
            if(result) {
                result = <OrgCredential> result;
                this.orgCredsList.push(result);
                this.orgCredsList = this.orgCredsList;
                this.saveOrgCreds();
            }
        });
    } 

}

// bootstrapApplication(CodeBrowserComponent, {
//     providers: [importProvidersFrom(CodeEditorModule.forRoot({
//         // ... config
//     }))]
// });
