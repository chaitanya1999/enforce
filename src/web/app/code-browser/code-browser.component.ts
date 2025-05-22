import { ApplicationConfig, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef, Component, ElementRef, HostListener, Injector, Input, NgZone, SchemaMetadata, ViewChild, afterNextRender, importProvidersFrom, viewChild } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { IpcService } from '../../ipc.service';
import { OrgCredential } from '../OrgCredential';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { CustomTypeaheadComponent } from '../custom-typeahead/custom-typeahead.component';
// import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { AppConstants , CodeEntity } from '../AppConstants';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
// import { CodeEditorModule, CodeModel } from '@ngstack/code-editor';
import { bootstrapApplication } from '@angular/platform-browser';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { ContextMenuEvent } from 'electron';
import { GlobalEventsService } from '../global-events.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';
import Utils, { EnForceResponse, NormalizedBundleDetails, NormalizedBundleItem, NormalizedCodeEntity } from '../enforce-utils';
import { PromptDialogComponent } from '../prompt-dialog/prompt-dialog.component';
import { sfApiVersion } from '../salesforce.service';
import { ResizableModule } from 'angular-resizable-element';
// import { provideRouter } from '@angular/router';

// export const appConfig: ApplicationConfig = {
//     providers: [importProvidersFrom(CodeEditorModule.forRoot({
//       // ... config
//     }))]
// };

class CodeTab {
    tabName : string;
    modelId : string;
    tabValue : string;
    icon : string;
    orgName : string;
    entityType : string;
    editorType : string = AppConstants.CODE_EDITOR;
    recordId? : string;
    temporary : boolean = false;
    contentChanged : boolean = false;
    entityDisplayType : string = '';
    bundleName : string = '';
    deploymentInProgess : boolean = false;
    codeEntity? : NormalizedCodeEntity;
    bundleDetails? : NormalizedBundleDetails;
    loadingSpinner : boolean = false;
    get isAuraApplication(){
        return this.bundleDetails?.entityType == CodeEntity.AuraComponent && this.bundleDetails?.contents.some(x => x.label == 'APPLICATION');
    }

    get isCodeEditor() {
        return this.editorType == AppConstants.CODE_EDITOR;
    }

    constructor(tabName : string, modelId : string, tabValue : string, icon : string, orgName : string, editorType : string, entityType : string, recordId? : string, temporary? : boolean) {
        this.tabName = tabName;
        this.modelId = modelId;
        this.tabValue = tabValue;
        this.icon = icon;
        this.orgName = orgName;
        this.editorType = editorType;
        this.entityType = entityType;
        this.recordId = recordId;
        this.temporary = !!temporary;
        this.entityDisplayType = AppConstants.entityTypeVsName[entityType] || entityType;
    }
}

@Component({
    selector: 'app-code-browser',
    standalone: true,
    imports: [CodeEditorComponent, FormsModule, MatInputModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatTabsModule, MatCardModule, MatButtonModule, MatSnackBarModule, CustomTypeaheadComponent, MatProgressSpinnerModule, MatDialogModule, ResizableModule],
    templateUrl: './code-browser.component.html',
    styleUrl: './code-browser.component.css',
    // schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CodeBrowserComponent {

    get $codeEditor() : string {
        return AppConstants.CODE_EDITOR;
    }
    get $diffEditor() : string {
        return AppConstants.DIFF_EDITOR;
    }
    get $entityTypeAura() : string {
        return CodeEntity.AuraComponent;
    }
    get $entityTypeLWC() : string {
        return CodeEntity.LWC;
    }

    selectedOrg: string = '--Org--';
    selectedOrgInstanceUrl : string = '';
    selectedEntityType: string = '--Type--';
    showSpinner : boolean = false;

    get isOrgSelected() {
        return this.selectedOrg && this.selectedOrg != '--Org--';
    }

    @Input() orgCredsList: OrgCredential[] = [
        <OrgCredential>{
            orgName: 'dummy',
            username: 'username asdf'
        }
    ];

    @Input() orgCredsMap: Map<string, OrgCredential> = new Map<string, OrgCredential>();

    entityTypeList: Array<SelectOption> = Object.keys(AppConstants.entityTypeVsName).map(x => ({ label : AppConstants.entityTypeVsName[x], value : x}));
    entityTypeList_singular: Array<SelectOption> = Object.keys(AppConstants.entityTypeVsName_singular).map(x => ({ label : AppConstants.entityTypeVsName_singular[x], value : x}));;

    entityTypeVsList: {[key: string] : Array<NormalizedCodeEntity>} = {
        ApexClass: [],
        AuraComponent: [],
        LWC: []
    }

    entityList: any = []
    entityIdVsObjectMap : {[key: string] : NormalizedCodeEntity} = {};

    selectedEntity: string = '';
    searchKeyword: string = 'name';
    historyListMaxNumber : number = 5;

    displayTypeahead : boolean = false;

    code: string = this.setCode();
    language : string = 'html';

    options = {
        contextmenu: true,
        minimap: {
          enabled: true
        }
    };    

    @ViewChild('editor') editorCmp! : CodeEditorComponent;
    @ViewChild('editorContainer') editorContainer! : any;
    @ViewChild('entityTypeahead') typeahead! : CustomTypeaheadComponent;
    @ViewChild('orgselect') orgSelect! : any;
    @ViewChild('tabContainer') tabContainer! : any;


    openTabs : CodeTab[] = [
        new CodeTab("Welcome" , 'codeEditor_-1' , 'welcome' , 'assets/sfLogo.png' , 'Welcome', AppConstants.CODE_EDITOR, 'Welcome', '', true),
        // new CodeTab("Apple Apple" , 'codeEditor_-10' , 'Temp' , 'assets/sfLogo.png' , 'dummyOrg', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple" , 'codeEditor_-11' , 'Temp' , 'assets/sfLogo.png' , 'dummyOrg1', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple Apple Apple" , 'codeEditor_-12' , 'Temp' , 'assets/sfLogo.png' , 'dummyOrg22', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("SomeFunnyLongComponentNameToTest" , 'codeEditor_-19' , 'Temp' , 'assets/sfLogo.png' , 'dummyOrg23', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-13' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-14' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-15' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-16' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-17' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-18' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
    ];
    defaultTabOpen : boolean = true;
    _activeTabModelId : string = 'codeEditor_-1';
    set activeTabModelId(x) {
        this._activeTabModelId = x;
        this.activeTab = this.openTabs.filter(y => y.modelId == x)[0] ?? null;
        // document.querySelector(`div.tab[data-tab-modelid=${x}]`)?.scrollIntoView({block:"nearest"});
        this.scrollToTab(this.activeTab);
    }
    get activeTabModelId() {
        return this._activeTabModelId;
    }
    activeTab : CodeTab | null = null;
    pressedKeys : Set<String> = new Set<String>();

    //drag drop
    draggedTab : HTMLElement | undefined;

    //tab right click
    showTabRightClickMenu : boolean = false;
    tabForContextMenu: CodeTab | undefined;

    //select for compare
    compareTab: CodeTab | undefined;

    //focus issue on model switch
    ignoreUnfocus: boolean = false;

    //LANGUAGE SELECTOR
    @ViewChild('languageSelector') languageSelector! : CustomTypeaheadComponent;
    languageList : SelectOption[] = [
        this.createOption('java'),
        this.createOption('apex'),
        this.createOption('javascript'),
        this.createOption('html'),
        this.createOption('xml'),
        this.createOption('css'),
        this.createOption('typescript'),
    ]
    selectedLanguage : string = 'apex';

    errorsPaneVisibility : boolean = false;
    deploymentErrors : any = {
        //tabModelId vs list of errors
        // 'abc' : [
        //     {orgName : 'test', tabName : 'welcome', lineNumber: '3:34', problem: ' Severe deployment error. Entire production destroyed.'}
        // ]
    }
    get deploymentErrorsKeys() {
        return Object.keys(this.deploymentErrors);
    }
    get deploymentErrorsCount() {
        return Object.keys(this.deploymentErrors).reduce((p,c) => p+this.deploymentErrors[c].length, 0);
    }

    wordWrap : boolean = false;
    whitespaceDifferences : boolean = true;
    cursorPosition : any = {lineNumber : 0 , column : 0};
    organizationName : string = '';
    organizationType : string = '';

    get activeEntityTypeLabel() {
        return AppConstants.entityTypeVsName_singular[this.activeTab!.entityType];
    }

    constructor(private readonly _ipc: IpcService, private ref: ChangeDetectorRef, private snackBar: MatSnackBar
        , private globalEventsSvc: GlobalEventsService , private zone: NgZone, private injector : Injector , private changeDetectorRef : ChangeDetectorRef
        , private dialog : MatDialog
    ) {
        
    }

    createOption(value: string) {
        return <SelectOption>{label : value, value : value};
    }

    async ngOnInit() {
        this.globalEventsSvc.globalClickEvent.subscribe( (data) => {
            this.showTabRightClickMenu = false;
            let contextMenu: HTMLElement = document.querySelector('.tabRightClickMenu')!;
            contextMenu.setAttribute('style',`
                left : ${window.innerWidth}px;
                top : ${0}px;
            `);
            this.log('globalClickEvent');
        } );

        document.querySelector('.tabRightClickMenu')?.addEventListener('click', (e)=>{
            // this.showTabRightClickMenu = false;
            // e.stopPropagation();
            // e.preventDefault();
        })
        this.activeTab = this.openTabs[0];
        this.openTabs[0].entityType = 'AuraComponent';
        this.openTabs[0].tabValue = 'asdf';
        this.openTabs[0].bundleDetails = new NormalizedBundleDetails(
            '', 'Dummy Bundle', [
                new NormalizedBundleItem('APPLICATION', '', ''),
                new NormalizedBundleItem('CONTROLLER', 'asdf', ''),
                new NormalizedBundleItem('HELPER', '', ''),
                new NormalizedBundleItem('STYLE', '', '')
            ], '59.0', 'AuraComponent', ''
        )

        this.globalEventsSvc.tabSelectEvent.subscribe((x:any) => {
            if(x.reselected == true && x.tab.tabName == 'Code Browser') this.toggleSidePanel(null);
        });
    }

    async authenticate() {
        console.log('code-browser.component | authorize')
        this.showSpinner = true;
        await this._ipc.authenticate('OneClick');
        this.showSpinner = false;
    }

    async onOrgSelect(value: any) {
        try {
            this.log('onOrgSelect | value = ' , value);
            this.selectedOrg = value;
            this.log('onOrgSelect | selectedOrg = ' + this.selectedOrg);
            if(this.selectedOrg == '--Org--' || !this.selectedOrg) 
                return;

            if(this.defaultTabOpen) {
                this.defaultTabOpen = false;
                this.openTabs = [];
                this.editorCmp.clearAllModels();
            }
            
            // Fetching organization details
            this.log('fetching org details');
            let params = {
                orgName : this.selectedOrg,
                soqlQuery : `select Id, Name, PrimaryContact, OrganizationType, InstanceName, IsSandbox, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById from Organization LIMIT 1`,
                fetchDeleted : false,
                toolingApi : false
            };
            this._ipc.callMethod('executeQuery', params).then(x =>{
                if(x.isSuccess) {
                    this.organizationName = x.data.records?.[0]?.Name ?? '';
                    this.organizationType = x.data.records?.[0]?.OrganizationType ?? '';
                } else {
                    this.organizationName = '';
                    this.organizationType = '';
                }
            }).catch(e => {
                this.log('fetching org details - ' + JSON.stringify(e));
                this.organizationName = '';
                this.organizationType = '';
            });

            this.selectedOrgInstanceUrl = await this._ipc.callMethod('getOrgLoginUrl', this.selectedOrg);

            await this.fetchAllEntities(false);

        } catch(err) {
            this.log('onOrgSelect ERROR => ' + JSON.stringify(err));
        }
    }

    async fetchAllEntities(ignoreCache : boolean){
        this.showSpinner = true;
        // this.selectedEntity = '';
        // this.selectedEntityType = '';
        this.entityList = [];
        this.entityTypeVsList = {
            ApexClass: [],
            AuraComponent: [],
            LWC: []
        };

        this.snackBar.open('Loading all class components list', 'Close', {
            duration: 2000,
            verticalPosition : 'top'
        });

        let response: EnForceResponse[] = <EnForceResponse[]>(await this._ipc.callMethod('FetchClassCmpList', {
            orgName: this.selectedOrg,
            toFetchList: this.entityTypeList.map((x) => x.value),
            ignoreCache: ignoreCache
        }));
        this.log('onOrgSelect | response = ', response);

        let success = true;
        let error = '';
        for (let resp of response) {
            if(!resp.isSuccess) {
                success = false;
                this.snackBar.open('ERROR : ' + resp.errors[0].message, 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            } else {
                this.entityTypeVsList[resp.data.type] = resp.data.list || [];
            }
        }

        this.log('onOrgSelect | this.entityTypeVsList = ', this.entityTypeVsList);

        if(success) {
            this.onEntityTypeSelect(this.selectedEntityType);
            this.snackBar.open('List fetched succesfully', 'Close', {
                duration: 2000, // Set the duration in milliseconds
                verticalPosition : 'top'
            });
        }
        this.showSpinner = false;
    }

    async onEntityTypeSelect(value: any) {
        let clearSearch = value != this.selectedEntityType;
        this.selectedEntityType = value;

        if(value == '--Type--') return;
        
        this.log('onEntityTypeSelect | ' + value);
        let i=0;
        this.setEntityList();
        if(clearSearch)
            this.typeahead.clearSearchQuery();
        this.log('onOrgSelect | this.entityList = ', this.entityList);
    }

    setEntityList() {
        this.entityIdVsObjectMap = {};
        (this.entityTypeVsList[this.selectedEntityType] || []).forEach((codeEntity: NormalizedCodeEntity) => {
            this.entityIdVsObjectMap[codeEntity.Id] = codeEntity;
        });
        this.entityList = (this.entityTypeVsList[this.selectedEntityType] || []).map( (codeEntity:NormalizedCodeEntity) => {
            let x = codeEntity.Name;
            if(this.selectedEntityType == CodeEntity.LWC)
                return { label : x.substring(4), value : codeEntity.Id }
            else 
                return { label : x, value : codeEntity.Id }
        });
    }

    onFocused(evt: any) {

    }
    onEntitySelect(selectOption: SelectOption) {
        this.log('onEntitySelect');
        let id = selectOption.value;
        let codeEntity = this.entityIdVsObjectMap[id];
        this.loadEntity(codeEntity.Name, null, this.selectedEntityType, this.selectedOrg, codeEntity);
    }

    async loadEntity(identifier: string, tabToReload: CodeTab | null, entityType: string, org: string, codeEntity?: NormalizedCodeEntity) {
        this.showSpinner = true;

        this.log('loadEntity | ' , identifier);

        // this.code = '';
        let params : any = {};
        let name = identifier;
        let lang = 'java';
        let icon = 'assets/log icon.png';
        let code = '';
        
        //check if tab already open , then switch to the tab
        let existingTab = this.openTabs.filter(x => x.tabValue == name && x.orgName == org && x.entityType == entityType);
        if(!tabToReload && existingTab.length) {

            this.activeTabModelId = existingTab[0].modelId;
            this.editorCmp.switchModel(this.activeTabModelId);

        } else {
            let bundleName = '';
            if(entityType == CodeEntity.AuraComponent) {
                
            }
            if(entityType == CodeEntity.LWC) {
                bundleName = name.substring(name.indexOf('lwc/') + 4)
                bundleName = bundleName.substring(0, bundleName.lastIndexOf('/'));
            }

            if(entityType == CodeEntity.ApexClass) {
                params[CodeEntity.ApexClass] = {
                    names : [name]
                }
                lang = 'apex';
            } else if(entityType == CodeEntity.AuraComponent) {
                let componentName = name , defType = 'COMPONENT';
                bundleName = name.substring(0,name.indexOf('/'));
                for(let suffix in AppConstants.aura_suffixVsDefTypes) {
                    if(name.endsWith(suffix)) {
                        defType = AppConstants.aura_suffixVsDefTypes[suffix];
                        componentName = name.substring(0 , name.lastIndexOf(suffix));
                    }
                }
                params[CodeEntity.AuraComponent] = {
                    names : [bundleName],
                    defTypes : [defType]
                }
                lang = AppConstants.defTypeVsLanguage[defType];
            } else if(entityType == CodeEntity.LWC) {
                params[CodeEntity.LWC] = {
                    fileNames : [name]
                }
                if(name.endsWith('js')) lang = 'javascript';
                else if(name.endsWith('html')) lang = 'html';
                else if(name.endsWith('css')) lang = 'css';
                else if(name.endsWith('xml')) lang = 'xml';

            } else if(entityType == CodeEntity.VFPage || entityType == CodeEntity.VFComponent) {
                params[entityType] = {
                    names : [name]
                }
                lang = 'xml';
            } 
    
            params['OrgNames'] = [org];
            params['CREDENTIALS'] = {
                [org] : this.orgCredsMap.get(org)
            }
            
            let response = <EnForceResponse>(await this._ipc.callMethod('FetchCode', params));
    
            if(!response.isSuccess) {
                this.snackBar.open('ERROR : ' + response.errors[0].message, 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            } else {
                code = response.data[name];
                let recordId = response.data.Id;
    
                if(!tabToReload) {
                    let modelId = this.editorCmp.createCodeEditorModel(code, lang);

                    //decide tab name
                    let tabName = name , isBundle = false;
                    if(entityType == CodeEntity.LWC || entityType == CodeEntity.AuraComponent) {
                        tabName = tabName.substring(tabName.lastIndexOf('/') + 1);
                        isBundle = true;
                    }
                    if(entityType == CodeEntity.ApexClass) {
                        tabName += '.cls';
                    }
                    if(entityType == CodeEntity.VFPage) {
                        tabName += '.page';
                    }
                    if(entityType == CodeEntity.VFComponent) {
                        tabName += '.component';
                    }

                    //decide icon
                    if(lang == 'javascript') {
                        icon = 'assets/js.png';
                    } else if(lang == 'apex') {
                        icon = 'assets/sfLogo.png';
                    } else if(lang == 'html' || lang == 'visualforce' || lang == 'xml') {
                        icon = 'assets/html_icon.png';
                    } else if(lang == 'css') {
                        icon = 'assets/cssIcon_2.png';
                    }

                    //create tab
                    let codeTab = new CodeTab(tabName , modelId , name , icon , org, AppConstants.CODE_EDITOR, entityType, recordId);
                    codeTab.bundleName = bundleName;
                    codeTab.codeEntity = codeEntity;
                    this.openTabs.push(codeTab);
                    this.changeDetectorRef.detectChanges();
                    this.activeTabModelId = modelId;
                    this.editorCmp.switchModel(modelId);
                    this.editorCmp.focus();

                    this.log('loadEntity | loadBundleDetails ');
                    if(isBundle) this.loadBundleDetails(codeTab, false);

                } else {
                    this.editorCmp.setContent(code, tabToReload.modelId);
                    this.snackBar.open('Reloaded ' + tabToReload.tabName, 'Close', {
                        duration: 2000,
                        verticalPosition : 'top'
                    });
                }

                this.selectedLanguage = this.editorCmp.getModelLanguage();
                this.languageSelector.setSearchQuery(this.selectedLanguage);

            }
        }       

        this.showSpinner = false;
    }
    
    onTabMouseUp(tab : CodeTab, event: any) {
        // this.log('onTabClick - ' + tab);
        // this.selectTab(tab);
        if(event.button == 1) {
            this.onTabClose(tab);
        }
    }

    onTabClick(tab : CodeTab) {
        this.log('onTabClick - ' + tab);
        this.selectTab(tab);
    }

    selectTab(tab : CodeTab) {
        this.ignoreUnfocus = true;
        this.activeTabModelId = tab.modelId;
        this.editorCmp.switchModel(tab.modelId);
        console.log(Date.now() + ' #$#$ FOCUS DEBUG 0 ' , document.activeElement);
        this.editorCmp.focus();
        this.selectedLanguage = this.editorCmp.getModelLanguage();
        this.languageSelector.setSearchQuery(this.selectedLanguage);
        console.log(Date.now() + ' #$#$ FOCUS DEBUG ' , document.activeElement);
        this.ignoreUnfocus = false;
    }

    onTabClose(tab : CodeTab) {
        this.log('onTabClose | tab modelId CLOSE = ' + tab.modelId);
        if(!tab.temporary) this.editorCmp.clearModel(tab.modelId);
        let switchTabModelId = null;
        this.openTabs = this.openTabs.filter(x => x.modelId != tab.modelId);
        
        if(!tab.temporary && tab.modelId == this.activeTab?.modelId) {
            switchTabModelId = this.openTabs[0]?.modelId ?? null;
            this.log('onTabClose | switchTabModelId = ' + switchTabModelId)
            this.editorCmp.switchModel(switchTabModelId);
            this.activeTabModelId = switchTabModelId;
        }

        if(this.tabForContextMenu?.modelId == tab.modelId) this.tabForContextMenu = undefined;
        if(this.compareTab?.modelId == tab.modelId) this.compareTab = undefined;

        this.deploymentErrors[tab.modelId] = [];
        this.editorCmp.focus();
    }

    open() {

    }

    async reloadList() {
        await this.fetchAllEntities(true);
    }

    clearCachedList() {
        sessionStorage.setItem('fetchedClassCmpList', '{}');
        this.snackBar.open('Cached list cleared', 'Close', {
            duration: 1500,
            verticalPosition : 'top'
        });
    }

    onCodeChanged(evt : any) { 
        this.log('onCodeChanged | ' + evt.modelId + " " + evt.canUndo);
        let tab = this.openTabs.filter(x => x.modelId == evt.modelId);
        if(tab.length) tab[0].contentChanged = evt.canUndo;
    }

    onKeyDown(evt : KeyboardEvent){
        // if(!this.pressedKeys.has(evt.key)) {
        //     this.pressedKeys.add(evt.key);
        // }
        this.handleKeyboardShortcuts(evt);
    }

    onKeyUp(evt : KeyboardEvent) {
        // console.log('#$#$ Keyboard Key Up = ' + evt.key);
        // console.log('#$#$ Keyboard Pressed Keys = ' , this.pressedKeys);
        // this.pressedKeys.delete(evt.key);
    }

    onFocusOut(evt : any) {
        // console.log(Date.now() + ' #$#$ FOCUS DEBUG focusout ' , document.activeElement);
        // if(!this.ignoreUnfocus && !this.editorContainer.nativeElement.matches(':focus-within')) {
        //     this.pressedKeys = new Set<string>();
        // }
    }

    handleKeyboardShortcuts(evt : KeyboardEvent) {
        //ctrl shift tab
        let str = '';
        if(evt.ctrlKey) str += 'CTRL ';
        if(evt.shiftKey) str += 'SHIFT ';
        str += evt.key;
        if(evt.repeat) {
            str += ' [REPEAT]';
        }
        console.log('#$#$ Keyboard Shortcut = ' , str);
        if(evt.repeat)  return;

        if((evt.ctrlKey && evt.shiftKey && evt.key == 'Tab') || (evt.ctrlKey && !evt.shiftKey && evt.key == 'PageUp')) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            tabIndex = (tabIndex - 1 + this.openTabs.length) % this.openTabs.length;
            this.selectTab(this.openTabs[tabIndex]);
        }
        else if((evt.ctrlKey && evt.key == 'Tab') || (evt.ctrlKey && !evt.shiftKey && evt.key == 'PageDown')) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            tabIndex = (tabIndex + 1) % this.openTabs.length;
            this.selectTab(this.openTabs[tabIndex]);
        }
        else if(evt.ctrlKey && evt.shiftKey && evt.key == 'PageDown') {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            if(tabIndex < this.openTabs.length-1) {
                let tab1 = this.openTabs[tabIndex];
                let tab2 = this.openTabs[tabIndex+1];
                this.openTabs[tabIndex] = tab2;
                this.openTabs[tabIndex+1] = tab1;
            }
            this.scrollToTab(this.activeTab!);
        }
        else if(evt.ctrlKey && evt.shiftKey && evt.key == 'PageUp') {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            if(tabIndex > 0) {
                let tab1 = this.openTabs[tabIndex];
                let tab2 = this.openTabs[tabIndex-1];
                this.openTabs[tabIndex] = tab2;
                this.openTabs[tabIndex-1] = tab1;
            }
            this.scrollToTab(this.activeTab!);
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 'o') {
            evt.preventDefault();
            this.orgSelect.nativeElement.click();
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 'p') {
            evt.preventDefault();
            this.typeahead.focus();
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 'w') {
            evt.preventDefault();
            if(this.activeTab != null)
                this.onTabClose(this.activeTab);
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 's') {
            evt.preventDefault();
            this.handleSave();
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 'b') {
            evt.stopPropagation();
            evt.preventDefault();
            this.toggleSidePanel(null);
        }
    }

    matchShortcut(set1 : Set<any>, lst : Array<any>) {
        return this.setEquals(set1, new Set(lst));
    }    

    setEquals(set1 : Set<any>, set2 : Set<any>) {
        return set1.size == set2.size && [...set1].every(x => set2.has(x));
    }


    //#region Drag Drop
    tabDragStart(evt : any) {
            this.draggedTab = evt.target;
    }
    tabDragEnd(evt: any){
        this.draggedTab = undefined;
    }
    tabDragEnter(evt : any) { 
        if(evt.target != this.draggedTab)
            evt.target.setAttribute('data-drop-active', true);
        evt.preventDefault();
    }
    tabDragLeave(evt : any) {
        if(evt.target != this.draggedTab)
            evt.target.setAttribute('data-drop-active', false);
        evt.preventDefault();
    }
    tabDrop(evt : any) {
        if(evt.target != this.draggedTab) {
            let sourceTabModelId = <string>(this.draggedTab!.dataset['tabModelId'] ?? -1);
            let destTabModelId = evt.target.dataset['tabModelId'];
            let sourceTabIdx = this.openTabs.findIndex(x => x.modelId == sourceTabModelId);
            let destTabIdx = this.openTabs.findIndex(x => x.modelId == destTabModelId);

            let temp = this.openTabs[destTabIdx];
            this.openTabs[destTabIdx] = this.openTabs[sourceTabIdx];
            this.openTabs[sourceTabIdx] = temp;

        }
    }
    //#endregion

    //tab right click context menus
    onTabContextMenu(tab : CodeTab, event: any) {

        event.preventDefault(); 
        if(tab.temporary) return;
        if(tab.editorType == AppConstants.DIFF_EDITOR) return;

        this.tabForContextMenu = tab;
        this.showTabRightClickMenu = true;
        setTimeout(() => {
            let contextMenu: HTMLElement = document.querySelector('.tabRightClickMenu')!;
            let x = event.clientX , y = event.clientY;
            console.log('#$#$ contextMenu.offsetWidth = ' + contextMenu.offsetWidth);
            console.log('#$#$ contextMenu.offsetHeight = ' + contextMenu.offsetHeight);
            if(x + contextMenu.scrollWidth > window.innerWidth) x-= contextMenu.scrollWidth;
            if(y + contextMenu.scrollHeight > window.innerHeight) y-= contextMenu.scrollHeight;
            contextMenu.setAttribute('style',`
                left : ${x}px;
                top : ${y}px;
            `);
        }, 100);
    }

    selectForCompare() {
        this.compareTab = this.tabForContextMenu;
    }

    compareWithSelected() {
        let tab1 = this.compareTab!;
        let tab2 = this.tabForContextMenu!;

        //check for existing tab
        let diffTabName = this.getDiffTabValueString(tab1,tab2);
        let diffTabOrg = this.getDiffOrgNameString(tab1,tab2);
        let diffEntityType = this.getDiffEntityType(tab1, tab2);
        let existingDiffTab = this.openTabs.filter(x => x.editorType == AppConstants.DIFF_EDITOR && x.tabValue == diffTabName && x.orgName == diffTabOrg)[0];
        if(existingDiffTab) {
            this.activeTabModelId = existingDiffTab.modelId;
            this.editorCmp.switchModel(existingDiffTab.modelId);
            return;
        }

        //create diff model
        let diffModelId = this.editorCmp.createDiffEditorModel(tab1.modelId!, tab2.modelId!);

        //create diff tab
        this.openTabs.push(new CodeTab(diffTabName, diffModelId, diffTabName, 'assets/log icon.png', diffTabOrg, AppConstants.DIFF_EDITOR, diffEntityType));

        //set diff model
        this.editorCmp.switchModel(diffModelId);

        //set diff tab
        this.activeTabModelId = diffModelId;
    }

    getDiffTabValueString(tab1 : CodeTab, tab2 : CodeTab) {
        return `Diff : ${tab1?.tabName} <> ${tab2?.tabName}`;
    }

    getDiffOrgNameString(tab1 : CodeTab, tab2 : CodeTab) {
        return `${tab1.orgName} <> ${tab2.orgName}`;
    }

    getDiffEntityType(tab1 : CodeTab, tab2 : CodeTab) {
        return `${tab1.entityType} <> ${tab2.entityType}`;
    }

    reloadEntity() {
        let tab = this.tabForContextMenu!;
        this.loadEntity(tab.tabValue, tab, tab.entityType, tab.orgName, tab.codeEntity);
    }

    prevDiff() {
        this.editorCmp?.prevDiff();
        this.editorCmp?.focus();
    }

    nextDiff() {
        this.editorCmp?.nextDiff();
        this.editorCmp?.focus();
    }

    swapDiff() {
        if(this.activeTab) {
            this.editorCmp?.swapDiff();
            this.activeTab.orgName = this.activeTab?.orgName.split(' <> ').reverse().join(' <> ');
        }
    }

    typeaheadUnfocus() {
        this.editorCmp.focus();
    }

    tabContainerScroll(e : any) {
        if (e.deltaY > 0) {
            this.tabContainer.nativeElement.scrollLeft += 100;
            e.preventDefault();

        }
        else {
            this.tabContainer.nativeElement.scrollLeft -= 100;
            e.preventDefault();
        }
    }

    onLanguageSelect(language : SelectOption) {
        this.editorCmp.setModelLanguage(language.value);
        this.selectedLanguage = language.value;
    }

    handleSave() {
        if(this.activeTab?.editorType == AppConstants.CODE_EDITOR && !this.activeTab.temporary && !this.activeTab.deploymentInProgess) {
            let authorized = !!this.orgCredsMap.get(this.activeTab.orgName)?.allowCodeModification;

            if(authorized) {
                let dialogRef = this.dialog.open(ConfirmDialogComponent, {
                    // height: '400px',
                    // width: '600px',
                    data : {
                        text : `Are you sure to save "${AppConstants.entityTypeVsName_singular[this.activeTab.entityType]}" : "${this.activeTab.tabName}" to the org "${this.activeTab.orgName}" ?`
                    }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if(result) {
                        this.saveCode(this.activeTab!);
                    }
                });
            } else {
                let dialogRef = this.dialog.open(AlertDialogComponent, {
                    data : {
                        content : "Code Modification not allowed. Enable it from org manager."
                    }
                });
            }
        }
    }

    async saveCode(tab : CodeTab) {
        try {
            this.showSpinner = true;
            tab.deploymentInProgess = true;
            let deployResponse : any = await this._ipc.callMethod('DeployCode', {
                id : tab.recordId,
                Body : this.editorCmp.getContent(tab.modelId),
                type : tab.entityType,
                orgName : tab.orgName
            });

            let dialogRef = this.dialog.open(AlertDialogComponent, {
                // height: '400px',
                // width: '600px',
                data : {
                    // content : JSON.stringify(deployResponse, null, 4)
                    content : deployResponse.isSuccess ? 'Deployment Success.' : 'Deployment Failed. Please check the errors pane.'
                }
            });

            let deployErrors : any[] = [];

            if(deployResponse.isSuccess) {
                tab.contentChanged = false;
                this.errorsPaneVisibility = false;
            } else {
                this.errorsPaneVisibility = true;
                if([''+CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(tab.entityType)) {
                    for(let deployDet of deployResponse.data.DeployDetails.allComponentMessages) {
                        if(!deployDet.success) {
                            deployErrors.push({
                                orgName : tab.orgName,
                                tabName : tab.tabName,
                                lineNumber : deployDet.lineNumber + ':' + (deployDet.columnNumber || ''),
                                problem : deployDet.problem
                            })
                        }
                    }
                } else if(tab.entityType == CodeEntity.AuraComponent || tab.entityType == CodeEntity.LWC) {
                    if(deployResponse.data.errors.length) {
                        let error = deployResponse.data.errors[0];
                        let lineNo = (error.message.match(/[0-9]+,\s*[0-9]+/g) ?? [])[0] || -1;
                        deployErrors.push({
                            orgName : tab.orgName,
                            tabName : tab.tabName,
                            lineNumber : lineNo,
                            problem : error.message
                        })
                    }
                }
            }
            this.deploymentErrors[tab.modelId] = deployErrors;
        } catch(err){
            console.error(err);
        }
        finally {
            this.showSpinner = false;
            tab.deploymentInProgess = false;
        }
    }

    showErrorsPane() {
        this.errorsPaneVisibility = !this.errorsPaneVisibility;
    }

    closeErrorsPane() {
        this.errorsPaneVisibility = false;
    }

    toggleWordWrap() {
        this.wordWrap = !this.wordWrap;
        this.editorCmp.wordWrap(this.wordWrap);
    }

    reportAnIssue() {
        window.open('https://github.com/chaitanya1999/enforce/issues');
    }

    cursorPositionChange(evt : any) {
        console.log('#$#$ cusror position' , evt);
        this.cursorPosition.lineNumber = evt.lineNumber;
        this.cursorPosition.column = evt.column;
    }

    async openOrg() {
        if(this.selectedOrg == '--Org--' || !this.selectedOrg) 
            return;

        try {
            // let url = await this._ipc.callMethod('getOrgLoginUrl', this.selectedOrg);
            let url = this.selectedOrgInstanceUrl || (await this._ipc.callMethod('getOrgLoginUrl', this.selectedOrg));
            window.open(url);
        } catch(err) {
            console.log(err);
        }
    }

    async createNewCode(entity : SelectOption) {
        if(!this.isOrgSelected) return;

        let authorized = !!this.orgCredsMap.get(this.selectedOrg)?.allowCodeModification;
        if(!authorized) {
            let dialogRef = this.dialog.open(AlertDialogComponent, {
                data : {
                    content : "Code Modification not allowed. Enable it from org manager."
                }
            });
        }


        let regExpression : any = {
            'ApexClass' : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            'AuraComponent' : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            'LWC' : '^[a-z][a-zA-Z0-9\\-\\_]{0,39}$',
            'VFPage' : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            'VFComponent' : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$'
        }


        if(![CodeEntity.LWC, CodeEntity.AuraComponent, CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(<any>entity.value)) {
            alert('Not implemented yet');
            return;
        }

        let dialogRef = this.dialog.open(PromptDialogComponent, {
            data : {
                text : `Enter new ${entity.label} name for org "${this.selectedOrg}"`,
                placeholder : 'Name',
                label : 'Name',
                validationText : 'Please enter a valid name ' + (entity.value == 'LWC' ? '(LWC must start with lowercase)' : ''),
                regex : regExpression[entity.value]
            }
        });

        dialogRef.afterClosed().subscribe(async name => {
            if(name) {
                try {
                    this.showSpinner = true;

                    let payload : any = {};
                    if([''+CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(entity.value)) {
                        payload = {
                            Body : AppConstants.defaultCode[entity.value].replace(/\{componentName\}/g, name),
                            type : entity.value,
                            orgName : this.selectedOrg,
                            name : name
                        };
                    } else {
                        payload = {
                            type : entity.value,
                            orgName : this.selectedOrg,
                            name : name,
                            bundle : AppConstants.defaultCode[entity.value].map((x : any) => {
                                let y : any = {};
                                for(let key in x) {
                                    y[key] = x[key].replace(/\{componentName\}/g, name).replace(/\{apiVersion\}/g, sfApiVersion);
                                }
                                return y;
                            })
                        };
                    }
                    let deployResponse : any = await this._ipc.callMethod('DeployCode', payload);
        
                    let dialogRef = this.dialog.open(AlertDialogComponent, {
                        // height: '400px',
                        // width: '600px',
                        data : {
                            // content : JSON.stringify(deployResponse, null, 4)
                            content : deployResponse.isSuccess ? 'Success.' : 'Error : ' + JSON.stringify(deployResponse.errors , null , 4)
                        }
                    });
        
                    let deployErrors : any[] = [];
        
                    if(deployResponse.isSuccess) {
                        this.errorsPaneVisibility = false;
                        let entityToLoad = '';
                        
                        if([''+CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(entity.value)) {
                            this.entityTypeVsList[entity.value].push(new NormalizedCodeEntity('', name, null, null, sfApiVersion, null));
                            entityToLoad = entity.value;

                        } else if(entity.value == CodeEntity.AuraComponent) {
                            let bundleName = name;
                            let fileNames = [
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['COMPONENT'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['CONTROLLER'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['HELPER'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['STYLE'],
                            ]
                            this.entityTypeVsList[entity.value].push(...(fileNames.map((x: any) => new NormalizedCodeEntity('', x, null, bundleName, sfApiVersion, null))));
                            entityToLoad = fileNames[0];
                        } else if(entity.value == CodeEntity.LWC) {
                            let bundleName = name;
                            let fileNames = payload.bundle.map((x : any) => x.filePath);
                            console.log('^^^^ ' + fileNames);
                            this.entityTypeVsList[entity.value].push(...(fileNames.map((x: any) => new NormalizedCodeEntity('', x, null, bundleName, sfApiVersion, null))));
                            entityToLoad = fileNames[0];
                        }

                        this.loadEntity(name, null, entityToLoad, this.selectedOrg);

                        if(entity.value == this.selectedEntityType) {
                            this.setEntityList();
                        }

                    } else {
                        this.errorsPaneVisibility = true;
                        if([''+CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(entity.value)) {
                            for(let deployDet of deployResponse.data?.DeployDetails?.allComponentMessages || []) {
                                if(!deployDet.success) {
                                    deployErrors.push({
                                        orgName : this.selectedOrg,
                                        tabName : '',
                                        lineNumber : deployDet.lineNumber + ':' + (deployDet.columnNumber || ''),
                                        problem : deployDet.problem
                                    })
                                }
                            }
                        } else if(entity.value == CodeEntity.AuraComponent || entity.value == CodeEntity.LWC) {
                            if(deployResponse.data?.errors?.length) {
                                let error = deployResponse.data.errors[0];
                                let lineNo = (error.message.match(/[0-9]+,\s*[0-9]+/g) ?? [])[0] || -1;
                                deployErrors.push({
                                    orgName : this.selectedOrg,
                                    tabName : '',
                                    lineNumber : lineNo,
                                    problem : error.message
                                })
                            }
                        }
                    }
                    this.deploymentErrors["new"] = deployErrors;
                } catch(err){
                    console.error(err);
                }
                finally {
                    this.showSpinner = false;
                }
            }
        });
    }
    
    toggleSpaceDiff() {
        this.editorCmp.showWhitespaceDifference(this.whitespaceDifferences = !this.whitespaceDifferences);
    }

    sidePanelDisplay = true;
    @ViewChild('sidePanelElement') sidePanelElement : ElementRef | undefined;
    @ViewChild('rootElement') rootElement : ElementRef | undefined;
    toggleSidePanel(evt : any) {
        this.sidePanelDisplay = !this.sidePanelDisplay;
        this.panelSizing();
    }
    
    panelSizing() {
        if(this.sidePanelDisplay) {
            this.sidePanelElement!.nativeElement.style.width = 'max(15%, 200px)';
            this.rootElement!.nativeElement.style.width = 'calc(100% - max(15%, 200px) - 12px)';
        } else {
            this.rootElement!.nativeElement.style.width = 'calc(100% - 0px - 12px)';
            this.sidePanelElement!.nativeElement.style.width = '0px';
        }
    }

    @HostListener('window:resize', ['$event'])
    onResize(event : any) {
        this.panelSizing();
    }

    dummyButton() {
        let id = this.entityList[0].value;
        let codeEntity = this.entityIdVsObjectMap[id];
        this.loadEntity(codeEntity.Name, null, this.selectedEntityType, this.selectedOrg, codeEntity);
        
        id = this.entityList[1].value;
        codeEntity = this.entityIdVsObjectMap[id];
        this.loadEntity(codeEntity.Name, null, this.selectedEntityType, this.selectedOrg, codeEntity);

        this.openTabs = [
            new CodeTab("Welcome" , 'codeEditor_-1' , 'welcome' , 'assets/sfLogo.png' , 'Welcome', AppConstants.CODE_EDITOR, 'Welcome', '', true),
            new CodeTab("Apple Apple" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Apple Apple" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Apple Apple Apple Apple" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
            new CodeTab("Temp" , '' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        ]
    }

    clickBundleItem(bundleItem : NormalizedBundleItem, bundleDetails : NormalizedBundleDetails | undefined | null) {
        if(bundleDetails) { 
            this.loadEntity(bundleItem.value, null, bundleDetails.entityType, this.activeTab!.orgName,
                new NormalizedCodeEntity(bundleItem.id, bundleItem.value, bundleDetails.bundleId, bundleDetails.bundleName, bundleDetails.apiVersion, bundleDetails.namespacePrefix));
        }
    }

    scrollToTab(tab : CodeTab) {
        document.querySelector(`div.tab[data-tab-modelid=${tab.modelId}]`)?.scrollIntoView({block:"nearest", behavior:'smooth', inline:"nearest"});
    }

    clickEmptySpace(event : Event) {
        if((<HTMLElement>event.target).dataset?.['emptyspace']) {
            this.editorCmp.focus();
        }
    }

    async previewAuraApplication() {
        let instanceUrl = await this._ipc.callMethod('getInstanceURL', {orgName : this.activeTab!.orgName});
        let domainPrefix = new URL(instanceUrl).hostname.split('.')[0]; // => 'myorg-dev-ed'
        let appName = this.activeTab?.bundleDetails?.bundleName + '.app';
        if(instanceUrl.includes('.sandbox.')) domainPrefix += '.sandbox';
        window.open('https://' + domainPrefix + '.lightning.force.com/c/' + appName);
    }

    loadEntityFromOtherOrg() {
        let tab = this.tabForContextMenu!;
        this.loadEntity(tab.tabValue, null, tab.entityType, this.selectedOrg, tab.codeEntity);
    }

    copyFilename(fullName : boolean) {
        if (navigator.clipboard && window.isSecureContext) {
            let name : string = this.tabForContextMenu?.tabName || '';
            let text = (fullName ? name : name.substring(0, name.lastIndexOf('.'))) || '';
            navigator.clipboard.writeText(text);
            this.snackBar.open('Copied !', 'Close', {
                duration: 500,
                verticalPosition : 'top'
            });
        } 
    }

    handleAccordion(evt : MouseEvent) {
        let target = evt.target;
        if(!(target instanceof HTMLElement)) return;
        let t_id = target!.dataset['toggleContent'];
        let collapsed = target!.dataset['toggleCollapsed']=='true' || false;
        let toggleContent : HTMLElement | null = document.querySelector(`[data-toggle-id=${t_id}]`);
        if(!toggleContent) return;
        if(collapsed) {
            toggleContent.style.display = 'block';
        } else {
            toggleContent.style.display = 'none';
        }
        collapsed = !collapsed;
        target.dataset['toggleCollapsed'] = '' + collapsed;
        // toggleContent.dataset['toggleCollapsed'] = '' + collapsed;
    }

    async loadBundleDetails(codeTab : CodeTab, ignoreCache : boolean) {
        this._ipc.callMethod('getBundleDetails', {
            orgName : this.selectedOrg,
            bundleName : codeTab.bundleName,
            entityType : codeTab.entityType,
            ignoreCache : ignoreCache
        }).then( (x:EnForceResponse) => {
            if(x.isSuccess) {
                this.log('loadEntity | getBundleDetails | Success = ' , x);
                codeTab.bundleDetails = x.data;
            } else {
                this.log('loadEntity | getBundleDetails | ERROR = ' , x);
                this.snackBar.open('ERROR occuring while fetching bundle details ', 'Close', {
                    duration: 2000,
                    verticalPosition : 'top'
                });
            }

        }).catch( (x:any) => {
            this.log('loadEntity | getBundleDetails | ERROR = ' , x);
            this.snackBar.open('ERROR occuring while fetching bundle details ', 'Close', {
                duration: 2000,
                verticalPosition : 'top'
            });
        });
    }

    changeFontSize(increment : boolean) {
        this.editorCmp.changeFontSize(increment);
    }
    
    log(...str: any) {
        if(!str) str = [];
        str.unshift('code-browser.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }

    setCode(){
        return `\nWelcome, To\nChaitanya V's\nEnForce IDE for SF Development\n\nThis IDE has been designed to connect to multiple Orgs at once\nand allows the developer to work on Apex, Aura, LWC, VF`;
    }

}