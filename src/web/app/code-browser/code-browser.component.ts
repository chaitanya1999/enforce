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
import { MatSnackBarConfig, MatSnackBarModule, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { CustomTypeaheadComponent } from '../custom-typeahead/custom-typeahead.component';
import { AppConstants , CodeEntity } from '../AppConstants';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
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
import {MatTooltipModule} from '@angular/material/tooltip';


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
    hidden : boolean = false;
    pinned : boolean = false;

    diffTabModelIds : Set<String> = new Set<String>(); // Used by code editor tab. stores which all DIFF tabs are using model of this tab.
    model1ForDiff : string | null = null; // Used by DIFF tab.
    model2ForDiff : string | null = null; // Used by DIFF tab.
    unloadModel1 : boolean = false; // Used by DIFF tab. When comparing local code with org, this will be used to unload the model for which tab is not created
    
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
    imports: [CodeEditorComponent, FormsModule, MatInputModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatTabsModule, MatCardModule, MatButtonModule, MatSnackBarModule, CustomTypeaheadComponent, MatProgressSpinnerModule, MatDialogModule, ResizableModule, MatTooltipModule],
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
    selectedOrg2: string = '--Org 2--';
    selectedOrgInstanceUrl : string = '';
    selectedEntityType: string = '--Type--';
    showSpinner : boolean = false;

    get isOrgSelected() {
        return this.selectedOrg && this.selectedOrg != '--Org--';
    }

    get isOrg2Selected() {
        return this.selectedOrg2 && this.selectedOrg2 != '--Org 2--';
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
    entityTypeVsList2: {[key: string] : Array<NormalizedCodeEntity>} = {}

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
        new CodeTab("Welcome" , 'codeEditor_-1' , 'welcome' , 'assets/cloudIcon.png' , 'Welcome', AppConstants.CODE_EDITOR, 'Welcome', '', true),
        // new CodeTab("Apple Apple" , 'codeEditor_-10' , 'Temp' , 'assets/cloudIcon.png' , 'dummyOrg', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple" , 'codeEditor_-11' , 'Temp' , 'assets/cloudIcon.png' , 'dummyOrg1', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple Apple Apple" , 'codeEditor_-12' , 'Temp' , 'assets/cloudIcon.png' , 'dummyOrg22', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("SomeFunnyLongComponentNameToTest" , 'codeEditor_-19' , 'Temp' , 'assets/cloudIcon.png' , 'dummyOrg23', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-13' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-14' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-15' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-16' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-17' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Temp" , 'codeEditor_-18' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
    ];
    defaultTabOpen : boolean = true;
    _activeTabModelId : string | null = 'codeEditor_-1';
    set activeTabModelId(x) {
        this._activeTabModelId = x;
        this.activeTab = this.openTabs.filter(y => y.modelId == x)[0] ?? null;
        // document.querySelector(`div.tab[data-tab-modelid=${x}]`)?.scrollIntoView({block:"nearest"});
        if(this.activeTab) this.scrollToTab(this.activeTab);
    }
    get activeTabModelId() {
        return this._activeTabModelId;
    }
    isTabActive(tab : CodeTab) {
        return this.activeTabModelId == tab.modelId;
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
    whitespaceDifferences : boolean = false;
    cursorPosition : any = {lineNumber : 0 , column : 0};
    organizationName : string = '';
    organizationType : string = '';

    quickDiffModeFlag : boolean = false;

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
        // this.openTabs[0].entityType = 'AuraComponent';
        // this.openTabs[0].tabValue = 'asdf';
        // this.openTabs[0].bundleDetails = new NormalizedBundleDetails(
        //     '', 'Dummy Bundle', [
        //         new NormalizedBundleItem('APPLICATION', '', ''),
        //         new NormalizedBundleItem('CONTROLLER', 'asdf', ''),
        //         new NormalizedBundleItem('HELPER', '', ''),
        //         new NormalizedBundleItem('STYLE', '', '')
        //     ], '59.0', 'AuraComponent', ''
        // );
        // this.openTabs[0].bundleDetails.contents[3].toBeCreated = true;

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

    async onOrgSelect(value: any, orgProperty : string) {
        try {
            this.log('onOrgSelect | value = ' , value);
            (<any>this)[orgProperty] = value;
            this.log(`onOrgSelect | ${orgProperty} = ` + value);
            if(value == '--Org--' || !value || value == '--Org 2--') 
                return;

            if(this.defaultTabOpen) {
                this.defaultTabOpen = false;
                this.openTabs = [];
                this.editorCmp.clearAllModels();
            }
            
            if(this.quickDiffModeFlag) {
                if(this.selectedOrg == this.selectedOrg2 && this.isOrgSelected && this.isOrg2Selected) {
                    this.showSnackBar('Both orgs cannot be same in Quick Diff Mode');
                    if(orgProperty=='selectedOrg') this.selectedOrg = '--Org--';
                    if(orgProperty=='selectedOrg2') this.selectedOrg = '--Org 2--';
                    return ;
                }
            }

            //? Loads only for Org 1 , never for Org 2
            if(orgProperty == 'selectedOrg') this._ipc.callMethod('loadSObjectsList',{orgName : this.selectedOrg});

            await this.fetchAllEntities(false, orgProperty, false, true);

        } catch(err) {
            this.log('onOrgSelect ERROR => ' , (err));
        }
    }

    async fetchAllEntities(ignoreCache : boolean, orgProperty? : string, reloadBothOrgs?: boolean, ignoreSpinner?: boolean){
        try {
            //? orgProperty = selectedOrg1 / selectedOrg2 based on user selectoin
            //? orgProperty = undefined === selectedOrg1

            if(!orgProperty) orgProperty = 'selectedOrg';
            let orgToFetchFrom = (<any>this)[orgProperty];

            this.log('fetchAllEntities');
            if(!reloadBothOrgs || ignoreSpinner)
                this.showSpinner = true;
            
            this.entityList = [];
            let entityTypeVsList : any = {};

            this.showSnackBar('Loading all classes and components list');

            let response: EnForceResponse[] = <EnForceResponse[]>(await this._ipc.callMethod('FetchClassCmpList', {
                orgName: orgToFetchFrom,
                toFetchList: this.entityTypeList.map((x) => x.value),
                ignoreCache: ignoreCache
            }));
            this.log('fetchAllEntities | response = ', response);

            let success = true;
            for (let resp of response) {
                if(!resp.isSuccess) {
                    success = false;
                    this.showSnackBar('ERROR : ' + resp.errors[0].message);
                } else {
                    entityTypeVsList[resp.data.type] = resp.data.list || [];
                }
            }

            if(orgProperty == 'selectedOrg') {
                this.entityTypeVsList = entityTypeVsList;
                this.log('fetchAllEntities | this.entityTypeVsList = ', this.entityTypeVsList);
            } else {
                this.entityTypeVsList2 = entityTypeVsList;
                this.log('fetchAllEntities | this.entityTypeVsList2 = ', this.entityTypeVsList2);
            }

            if(success) {
                if(!reloadBothOrgs) this.onEntityTypeSelect(this.selectedEntityType);
                this.showSnackBar('List loaded succesfully');
            }

            if(!reloadBothOrgs || ignoreSpinner)
                this.showSpinner = false;
        } catch(err) {
            this.log('fetchAllEntities | ERROR CAUGHT -> ' , err);
            this.showSnackBar('Some error occurred');
        }
    }

    async onEntityTypeSelect(value: any) {
        let clearSearch = value != this.selectedEntityType; //clear if entity type selection is changed
        this.selectedEntityType = value;

        if(value == '--Type--') return;
        
        this.log('onEntityTypeSelect | ' + value);
        this.setEntityList();
        if(clearSearch)
            this.typeahead.clearSearchQuery();
        this.log('onEntityTypeSelect | this.entityList = ', this.entityList);
    }

    setEntityList() {
        let org1 = this.selectedOrg , org2 = null;
        let selEntityType = this.selectedEntityType;
        if(this.quickDiffModeFlag && this.isOrg2Selected) org2 = this.selectedOrg2;

        this.entityIdVsObjectMap = {};
        let entityLabelMap : any = {}; //for unique items in quick diff mode

        //selected org 1 handling
        this.entityTypeVsList[selEntityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
            this.entityIdVsObjectMap[org1 + ':' + codeEntity.Id] = codeEntity;
            let x = codeEntity.Name;
            if(selEntityType == CodeEntity.LWC)
                x = x.substring(4);
            entityLabelMap[x] = { label : x, value : codeEntity.Id, value2 : null, org1 : org1, org2 : org2 };
        });

        if(org2) {
            this.entityTypeVsList2[selEntityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
                this.entityIdVsObjectMap[org2 + ':' + codeEntity.Id] = codeEntity;
                let x = codeEntity.Name;
                if(selEntityType == CodeEntity.LWC)
                    x = x.substring(4);

                let entityOption = entityLabelMap[x] || {};
                entityOption = {
                    ...entityOption,
                    label : x, value2 : codeEntity.Id, org1 : org1, org2 : org2   
                }
                entityLabelMap[x] = entityOption;
            });
        }

        this.entityList = Object.values(entityLabelMap);

    }

    onFocused(evt: any) {

    }
    onEntitySelect(selectOption: SelectOption) {
        this.log('onEntitySelect');
        let id = selectOption.value;
        let id2 = selectOption.value2;
        let org = this.selectedOrg;
        let org2 = this.selectedOrg2;
        let codeEntity = this.entityIdVsObjectMap[org + ':' + id];
        let codeEntity2 = this.entityIdVsObjectMap[org2 + ':' + id2];

        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            if(codeEntity && codeEntity2) {
                this.showSpinner = true;
                Promise.all(
                    [this.loadEntity(codeEntity.Name, null, this.selectedEntityType, org, codeEntity, true, false, true, true, true),
                    this.loadEntity(codeEntity2.Name, null, this.selectedEntityType, org2, codeEntity2, true, false, true, true, true)]
                ).then((result) => {
                    let tab1 = result[0] , tab2 = result[1];
                    if(tab1 && tab2) {
                        if(!tab1.hidden) this.hideShowTab(tab1);
                        if(!tab2.hidden) this.hideShowTab(tab2);
                        this.createDiffTab(tab1, tab2);
                    } else {
                        if(tab1 && tab1.hidden) this.hideShowTab(tab1); 
                        if(tab2 && tab2.hidden) this.hideShowTab(tab2);
                    }
                    this.showSpinner = false;
                }).catch((err) => {
                    this.showSpinner = false;
                });
            } else {
                if(!codeEntity) {
                    this.showSnackBar(`Not Found on Org : ${org} ` + selectOption.label);
                }
                if(!codeEntity2) {
                    this.showSnackBar(`Not Found on Org : ${org2} ` + selectOption.label);
                }
                this.loadEntity(codeEntity.Name, null, this.selectedEntityType, org, codeEntity);
            }
        } else {
            this.loadEntity(codeEntity.Name, null, this.selectedEntityType, org, codeEntity);
        }
    }

    async loadEntity(identifier: string, tabToReload: CodeTab | null, entityType: string, org: string, codeEntity: NormalizedCodeEntity, openInBackground? : boolean, openHidden? : boolean, forceReloadIfExists? : boolean, ignoreSpinner?: boolean, showSuccessToast? : boolean) {
        if(!ignoreSpinner) this.showSpinner = true;

        this.log('loadEntity | ' , identifier);

        try {
             // this.code = '';
            let name = codeEntity.Name;
            let lang = 'java';
            let icon = 'assets/log icon.png';
            let code = '';
            
            //check if tab already open , then switch to the tab
            let existingTab = this.openTabs.filter(x => x.tabValue == name && x.orgName == org && x.entityType == entityType);
            if(existingTab.length && forceReloadIfExists) tabToReload = existingTab[0];

            if(!tabToReload && existingTab.length) {
                existingTab[0].hidden = false;
                this.activeTabModelId = existingTab[0].modelId;
                this.editorCmp.switchModel(this.activeTabModelId);
                return existingTab[0];
            } 
            
            //Proceed to fetching
            let bundleName = codeEntity.BundleName!;
            let response = await this.fetchCode(codeEntity, name, entityType, org);
            lang = this.getEntityLanguage(name, entityType, codeEntity.mimeType);
    
            //validate response
            if(!response.isSuccess) {
                this.showSnackBar('ERROR : ' + response.errors[0].message);
                return;
            } else if(!response.data['count']) {
                this.showSnackBar('Not Found : ' + name);
                return;
            } 

            //success response. proceed to create tabs
            code = response.data[name];
            let recordId = response.data.Id;

            //check if tab was reloaded
            if(tabToReload) {
                this.editorCmp.setContent(code, tabToReload.modelId);
                this.showSnackBar('Reloaded ' + tabToReload.tabName);
                return tabToReload;
            }

            //?proceed to creating new tab

            //create model
            let modelId = this.editorCmp.createCodeEditorModel(code, lang);

            //decide tab name
            let tabName = this.getTabName(name, entityType, codeEntity);            

            //decide icon
            icon = AppConstants.languageVsIcon[lang];

            //create tab
            let codeTab = new CodeTab(tabName , modelId , name , icon , org, AppConstants.CODE_EDITOR, entityType, recordId);
            codeTab.bundleName = bundleName;
            codeTab.codeEntity = codeEntity;
            codeTab.hidden = !!openHidden;
            this.openTabs.push(codeTab);
            this.changeDetectorRef.detectChanges();
            if(!openInBackground)
                this.selectTab(codeTab);

            this.log('loadEntity | loadBundleDetails ');
            if(this.isBundle(entityType))
                this.loadBundleDetails(codeTab, false);
            
            this.selectedLanguage = this.editorCmp.getModelLanguage();
            this.languageSelector.setSearchQuery(this.selectedLanguage);

            return codeTab;
                        
        } catch(err) {
            this.log(' loadEntity ERROR => ', err);
            return null;
        } finally {
            if(!ignoreSpinner) this.showSpinner = false;
        }

    }

    async fetchCode(codeEntity : NormalizedCodeEntity, name : string, entityType : string, org : string) : Promise<EnForceResponse> {
        let bundleName = codeEntity.BundleName!;
        let params : any = {
            [entityType] : { names : [name] },
            'OrgNames' : [org],
            'CREDENTIALS' : { [org] : this.orgCredsMap.get(org) } 
        }

        //set up params and language
        if(entityType == CodeEntity.AuraComponent) {
            let defType = <string>Object.entries(AppConstants.aura_suffixVsDefTypes).find( ([suffix, defType]) => name.endsWith(suffix) )![1] || 'COMPONENT';
            params[CodeEntity.AuraComponent] = { names : [bundleName], defTypes : [defType] }
        } else if(entityType == CodeEntity.LWC) {
            params[CodeEntity.LWC] = { fileNames : [name] }
        }
        
        //fetch code from org
        let response : EnForceResponse = <EnForceResponse>(await this._ipc.callMethod('FetchCode', params));
        return response;
    }

    getEntityLanguage(name : string, entityType : string, mimeType? : string) : string {
        let lang = 'java';
        if(entityType == CodeEntity.ApexClass || entityType == CodeEntity.ApexTrigger) {
            lang = 'apex';
        } else if(entityType == CodeEntity.AuraComponent) {
            lang = <string>Object.entries(AppConstants.aura_suffixVsLanguage).find( ([suffix, language]) => name.endsWith(suffix) )![1] || 'javascript';
        } else if(entityType == CodeEntity.LWC) {
            lang = <string>Object.entries(AppConstants.lwcSuffixVsLanguage).find(([suffix, lang]) => name.endsWith(suffix))![1] || 'javascript';
        } else if(entityType == CodeEntity.VFPage || entityType == CodeEntity.VFComponent) {
            lang = 'xml';
        } else if(entityType == CodeEntity.StaticResource) {
            lang = AppConstants.staticResMimeVsLanguage[mimeType || 'text/plain'] || 'text';
        }
        return lang;
    }

    getTabName(name: string, entityType : string, codeEntity : NormalizedCodeEntity) {
        let tabName = name;
        if(this.isBundle(entityType)) {
            tabName = tabName.substring(tabName.lastIndexOf('/') + 1);
        } else if(entityType == CodeEntity.StaticResource) {
            tabName += '.' + AppConstants.staticResExtension[codeEntity.mimeType!]
        } else {
            tabName += AppConstants.entityTypeVsSuffix[entityType];
        }
        return tabName;
    }

    isBundle(entityType : string) {
        return entityType == CodeEntity.LWC || entityType == CodeEntity.AuraComponent;
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
        tab.hidden = false;
        this.ignoreUnfocus = true;
        this.activeTabModelId = tab.modelId;
        this.editorCmp.switchModel(tab.modelId);
        // console.log(Date.now() + ' #$#$ FOCUS DEBUG 0 ' , document.activeElement);
        this.editorCmp.focus();
        this.selectedLanguage = this.editorCmp.getModelLanguage();
        this.languageSelector.setSearchQuery(this.selectedLanguage);
        // console.log(Date.now() + ' #$#$ FOCUS DEBUG ' , document.activeElement);
        this.ignoreUnfocus = false;
        
        if(tab.isCodeEditor)
            this.fetchOrgDetails(tab);
        else
            this.clearOrgDetails();
    }

    async fetchOrgDetails(tab : CodeTab) {
        this.log('fetchOrgDetails');
        //fetch org details
        let data : any = await this._ipc.callMethod('getOrganizationDetails', tab.orgName);
        this.organizationName = data.organizationName;
        this.organizationType = data.organizationType;
    }
    clearOrgDetails() {
        this.log('clearOrgDetails');
        this.organizationName = '';
        this.organizationType = '';
    }

    onTabClose(tab : CodeTab) {
        this.log('onTabClose | tab modelId CLOSE = ' + tab.modelId);

        if(tab.editorType == AppConstants.CODE_EDITOR && tab.diffTabModelIds.size) {
            this.showSnackBar('Cannot close parent tab when DIFF is open',null, 1500);
            return;
        }
        if(tab.editorType == AppConstants.CODE_EDITOR && tab.contentChanged) {
            let dialogRef = this.dialog.open(ConfirmDialogComponent, { data : { text : `You may have some unsaved changes.<br/>Are you sure to close the tab without saving ?` } });
            dialogRef.afterClosed().subscribe(result => {
                if(result) {
                    this.proceedForClosingTab(tab);
                }
            });
        } else {
            this.proceedForClosingTab(tab);
        }

    }

    proceedForClosingTab(tab : CodeTab) {
        if(tab.editorType == AppConstants.DIFF_EDITOR && tab.model1ForDiff && tab.model2ForDiff) {
            let tab1Diff = this.openTabs.find(x => x.modelId == tab.model1ForDiff);
            let tab2Diff = this.openTabs.find(x => x.modelId == tab.model2ForDiff);
            if(tab1Diff) tab1Diff.diffTabModelIds.delete(tab.modelId);
            if(tab2Diff) tab2Diff.diffTabModelIds.delete(tab.modelId);
        }

        if(!tab.temporary) this.editorCmp.clearModel(tab.modelId);
        if(tab.unloadModel1) this.editorCmp.clearModel(tab.model1ForDiff!);
        
        if(!tab.temporary && tab.modelId == this.activeTab?.modelId) {
            this.switchTabAfterClosingHiding(tab);
        }
        this.openTabs = this.openTabs.filter(x => x.modelId != tab.modelId);

        if(this.tabForContextMenu?.modelId == tab.modelId) this.tabForContextMenu = undefined;
        if(this.compareTab?.modelId == tab.modelId) this.compareTab = undefined;

        this.deploymentErrors[tab.modelId] = [];
        this.editorCmp.focus();
    }

    switchTabAfterClosingHiding(closedHiddenTab : CodeTab) {
        let index = this.openTabs.findIndex( (x:CodeTab) => closedHiddenTab.modelId == x.modelId);
        //! ASSERT index != -1
        let newTabIndex = null;
        for(let i=0; i<index; i++) {
            let iTab = this.openTabs[i];
            if(!iTab.hidden) newTabIndex = i;
        }
        if(!newTabIndex && newTabIndex!==0) for(let i=index+1; i<this.openTabs.length; i++) {
            let iTab = this.openTabs[i];
            if(!iTab.hidden) {newTabIndex = i;break;}
        }
        if(newTabIndex || newTabIndex===0) this.selectTab(this.openTabs[newTabIndex]);
        else {
            this.activeTabModelId = null;
            this.editorCmp.unloadModel();
        }
    }

    open() {

    }

    async reloadOrgMetadata() {
        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            this.showSpinner = true;
            Promise.all([this.fetchAllEntities(true, 'selectedOrg', true), this.fetchAllEntities(true, 'selectedOrg2', true)])
            .then((values : any) => {
                this.showSpinner = false;
            })
        } else {
            if(this.isOrgSelected)
                await this.fetchAllEntities(true, 'selectedOrg');
            else if(this.isOrg2Selected)
                await this.fetchAllEntities(true, 'selectedOrg2');
        }
    }

    clearCachedOrgMetadata() {
        //! TODO ...PENDING - to use service to clear this
        sessionStorage.setItem('fetchedClassCmpList', '{}');
        this.showSnackBar('Cached org metadata cleared', null, 1500);
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
            let tab = this.openTabs[tabIndex];
            let tabIdVsIndex = this.openTabs.reduce((p:any,c:CodeTab,ci:number) => (p[c.modelId] = ci, p), {});
            let eligibleTabs : Array<CodeTab> = this.openTabs.filter(x => !x.hidden);
            if(tab.pinned) {
                eligibleTabs = eligibleTabs.filter(x => x.pinned);
                // end = this.openTabs.length - 1 - [...this.openTabs].reverse().findIndex(x => x.pinned); //last pinned tab
            } else {
                eligibleTabs = eligibleTabs.filter(x => !x.pinned);
                // start = this.openTabs.findIndex(x => !x.pinned); //first tab which is not pinned
            }
            let tabEligibleIndex = eligibleTabs.findIndex((x:CodeTab) => x.modelId == tab.modelId);
            if(tabEligibleIndex < eligibleTabs.length - 1) {
                let tab1 = tab;
                let tab2 = eligibleTabs[tabEligibleIndex+1];
                this.openTabs[tabIdVsIndex[tab1.modelId]] = tab2;
                this.openTabs[tabIdVsIndex[tab2.modelId]] = tab1;
            }
            this.scrollToTab(this.activeTab!);
        }
        else if(evt.ctrlKey && evt.shiftKey && evt.key == 'PageUp') {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            let tab = this.openTabs[tabIndex];
            let tabIdVsIndex = this.openTabs.reduce((p:any,c:CodeTab,ci:number) => (p[c.modelId] = ci, p), {});
            let eligibleTabs : Array<CodeTab> = this.openTabs.filter(x => !x.hidden);
            if(tab.pinned) {
                eligibleTabs = eligibleTabs.filter(x => x.pinned);
            } else {
                eligibleTabs = eligibleTabs.filter(x => !x.pinned);
            }
            let tabEligibleIndex = eligibleTabs.findIndex((x:CodeTab) => x.modelId == tab.modelId);
            if(tabEligibleIndex > 0) {
                let tab1 = tab;
                let tab2 = eligibleTabs[tabEligibleIndex-1];
                this.openTabs[tabIdVsIndex[tab1.modelId]] = tab2;
                this.openTabs[tabIdVsIndex[tab2.modelId]] = tab1;
            }
            this.scrollToTab(this.activeTab!);
        }
        else if(evt.ctrlKey && evt.key.toLowerCase() == 'o') {
            this.orgSelect.nativeElement.click();
            evt.preventDefault();
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
        else if(evt.altKey && evt.key.toLowerCase() == 'z') {
            evt.stopPropagation();
            evt.preventDefault();
            this.toggleWordWrap();
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
        // if(tab.editorType == AppConstants.DIFF_EDITOR) return;

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

    createDiffTab(tab1 : CodeTab | null , tab2 : CodeTab, modelId1? : string) {
        //check for existing tab
        let diffTabName = this.getDiffTabValueString(tab1 || tab2 , tab2);
        let diffTabOrg = this.getDiffOrgNameString(tab1 , tab2);
        let diffEntityType = this.getDiffEntityType(tab1 || tab2 , tab2);
        let diffMimeType = this.getDiffMimeType(tab1 || tab2 , tab2);

        let existingDiffTab = this.openTabs.filter(x => x.editorType == AppConstants.DIFF_EDITOR && x.tabValue == diffTabName && x.orgName == diffTabOrg && x.entityType == diffEntityType)[0];
        if(existingDiffTab) {
            existingDiffTab.hidden = false;
            this.activeTabModelId = existingDiffTab.modelId;
            this.editorCmp.switchModel(existingDiffTab.modelId);
            return;
        }

        //create diff model
        let diffModelId = this.editorCmp.createDiffEditorModel((tab1?.modelId || modelId1!), tab2.modelId!);
        // tab1.diffModelId = diffModelId;
        // tab2.diffModelId = diffModelId;

        //create diff tab
        let lang = this.getEntityLanguage(diffTabName, diffEntityType, diffMimeType);
        let icon = AppConstants.languageVsIcon[lang];
        
        let tab = new CodeTab(diffTabName, diffModelId, diffTabName, icon, diffTabOrg, AppConstants.DIFF_EDITOR, diffEntityType);
        tab.model1ForDiff = tab1?.modelId || modelId1!;
        tab.model2ForDiff = tab2.modelId;
        tab.unloadModel1 = !tab1 && !!modelId1;

        if(tab1) tab1.diffTabModelIds.add(diffModelId);
        tab2.diffTabModelIds.add(diffModelId);
        this.openTabs.push(tab);

        this.selectTab(tab);
    }
    compareWithSelected() {
        let tab1 = this.compareTab!;
        let tab2 = this.tabForContextMenu!;

        this.createDiffTab(tab1, tab2);
    }

    getDiffTabValueString(tab1 : CodeTab, tab2 : CodeTab) {
        if(tab1.tabName == tab2.tabName) return `Diff : ${tab1.tabName}`;
        return `Diff : ${tab1?.tabName} <> ${tab2?.tabName}`;
    }

    getDiffOrgNameString(tab1 : CodeTab | null, tab2 : CodeTab) {
        if(tab1 == null) return `local <> ${tab2.orgName}`;
        if(tab1.orgName == tab2.orgName) return `${tab1.orgName}`;
        return `${tab1.orgName} <> ${tab2.orgName}`;
    }
    
    getDiffEntityType(tab1 : CodeTab, tab2 : CodeTab) {
        if(tab1.entityType == tab2.entityType) return `${tab1.entityType}`;
        return `${tab1.entityType} <> ${tab2.entityType}`;
    }

    getDiffMimeType(tab1 : CodeTab, tab2 : CodeTab) {
        if(tab1.codeEntity?.mimeType == tab2.codeEntity?.mimeType) return `${tab1.codeEntity?.mimeType}`;
        return `${tab1.codeEntity?.mimeType} <> ${tab2.codeEntity?.mimeType}`;
    }

    reloadEntity() {
        let tab = this.tabForContextMenu!;
        this.loadEntity(tab.tabValue, tab, tab.entityType, tab.orgName, tab.codeEntity!);
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
        // console.log(e.deltaY);
        let delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        this.tabContainer.nativeElement.scrollLeft += delta*0.5;
        e.preventDefault();
        // if (delta > 0) {
        //     this.tabContainer.nativeElement.scrollLeft += delta*0.1;
        //     e.preventDefault();
        // }
        // else {
        //     this.tabContainer.nativeElement.scrollLeft -= delta*0.1;
        //     e.preventDefault();
        // }
    }

    onLanguageSelect(language : SelectOption) {
        this.editorCmp.setModelLanguage(language.value);
        this.selectedLanguage = language.value;
    }

    handleSave() {
        let tab : CodeTab | null = this.activeTab;
        if(!tab) return;
        if(tab?.editorType == AppConstants.CODE_EDITOR && !tab.temporary && !tab.deploymentInProgess && !this.quickDiffModeFlag) {
            let authorized = !!this.orgCredsMap.get(tab.orgName)?.allowCodeModification;

            if(authorized) {
                let dialogRef = this.dialog.open(ConfirmDialogComponent, {
                    // height: '400px',
                    // width: '600px',
                    data : {
                        text : `Are you sure to save "${AppConstants.entityTypeVsName_singular[tab.entityType]}" : "${tab.tabName}" to the org "${tab.orgName}" ?`
                    }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if(result) {
                        this.saveCode(tab!);
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
            let body = this.editorCmp.getContent(tab.modelId);

            if(tab.entityType == CodeEntity.StaticResource) {
                body = btoa(body);
            }

            let deployResponse : any = await this._ipc.callMethod('DeployCode', {
                id : tab.recordId,
                Body : body,
                type : tab.entityType,
                orgName : tab.orgName,
                mimeType : tab.codeEntity?.mimeType
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
                if([''+CodeEntity.ApexClass, ''+CodeEntity.ApexTrigger, ''+CodeEntity.VFComponent, ''+CodeEntity.VFPage].includes(tab.entityType)) {
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
        if(!this.isOrgSelected || this.quickDiffModeFlag) return;

        let authorized = !!this.orgCredsMap.get(this.selectedOrg)?.allowCodeModification;
        if(!authorized) {
            let dialogRef = this.dialog.open(AlertDialogComponent, {
                data : {
                    content : "Code Modification not allowed. Enable it from org manager."
                }
            });
            return;
        }
        let orgToDeploy = this.selectedOrg;


        let regExpression : any = {
            [CodeEntity.ApexClass] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            [CodeEntity.ApexTrigger] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            [CodeEntity.AuraComponent] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            [CodeEntity.LWC] : '^[a-z][a-zA-Z0-9\\-\\_]{0,39}$',
            [CodeEntity.VFPage] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            [CodeEntity.VFComponent] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
            [CodeEntity.StaticResource] : '^[a-zA-Z][a-zA-Z0-9\\_]{0,39}$',
        }


        if(![CodeEntity.LWC, CodeEntity.AuraComponent, CodeEntity.ApexClass, CodeEntity.ApexTrigger, CodeEntity.VFComponent, CodeEntity.VFPage, CodeEntity.StaticResource].includes(<any>entity.value)) {
            alert('Not implemented yet');
            return;
        }

        let dropdownList = [];
        let dropdownRequired = (entity.value == CodeEntity.ApexTrigger || entity.value == CodeEntity.StaticResource);
        let dropdownPlaceholder = '';
        this.log('createNewCode | dropdownRequired=' + dropdownRequired);
        if(dropdownRequired) {
            if(entity.value == CodeEntity.ApexTrigger) {
                let data = await this._ipc.callMethod('loadSObjectsList' , {orgName : this.selectedOrg});
                dropdownList = data.data || [];
                dropdownList = dropdownList
                                .filter((x:any) => x['IsApexTriggerable'])
                                .map((x:any) => (<SelectOption>{label : x['QualifiedApiName'], value : x['DurableId'] }));
                dropdownPlaceholder = 'Select SObject';
            } else {
                dropdownList = AppConstants.staticResMimeTypes.map((x:string) => (<SelectOption>{label : x, value: x}));
                dropdownPlaceholder = 'Select MIME type';
            }
        }

        let dialogRef = this.dialog.open(PromptDialogComponent, {
            data : {
                text : `Enter new ${entity.label} name for org "${orgToDeploy}"`,
                placeholder : 'Name',
                label : 'Name',
                validationText : 'Please enter a valid name ' + (entity.value == 'LWC' ? '(LWC must start with lowercase)' : ''),
                regex : regExpression[entity.value],
                dropdownRequired,
                dropdownList,
                dropdownPlaceholder
            }
        });

        dialogRef.afterClosed().subscribe(async data => {
            let name = data.input;
            let dropdownSelection = data.dropdownSelection;
            if(name) {
                try {
                    this.showSpinner = true;

                    let payload : any = {};
                    if([''+CodeEntity.ApexClass, CodeEntity.ApexTrigger, CodeEntity.VFComponent, CodeEntity.VFPage].includes(entity.value)) {
                        payload = {
                            Body : AppConstants.defaultCode[entity.value].replace(/\{componentName\}/g, name).replace(/\{sobjectName\}/g, dropdownSelection?.label),
                            type : entity.value,
                            orgName : orgToDeploy,
                            name : name,
                            TableEnumOrId : dropdownSelection?.label
                        };
                    } else if(CodeEntity.StaticResource == entity.value) {
                        payload = {
                            Body : btoa(AppConstants.defaultCode[entity.value][dropdownSelection.value]),
                            type : entity.value,
                            orgName : orgToDeploy,
                            name : name,
                            mimeType : dropdownSelection.value
                        };
                    } else {
                        payload = {
                            type : entity.value,
                            orgName : orgToDeploy,
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
                        let newCodeEntities : NormalizedCodeEntity[] = [];

                        if([''+CodeEntity.ApexClass, CodeEntity.ApexTrigger, CodeEntity.VFComponent, CodeEntity.VFPage, CodeEntity.StaticResource].includes(entity.value)) {
                            newCodeEntities.push(new NormalizedCodeEntity(deployResponse.data?.id, name, null, null, sfApiVersion, null, orgToDeploy, dropdownSelection?.value));
                            this.entityTypeVsList[entity.value].push(newCodeEntities[0]);
                            entityToLoad = entity.value;

                        } else if(entity.value == CodeEntity.AuraComponent) {
                            let bundleName = name;
                            let fileNames = [
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['COMPONENT'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['CONTROLLER'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['HELPER'],
                                bundleName + '/' + bundleName + Utils.aura_suffixMap['STYLE'],
                            ]
                            newCodeEntities = fileNames.map((x: any) => new NormalizedCodeEntity('', x, null, bundleName, sfApiVersion, null, orgToDeploy));
                            this.entityTypeVsList[entity.value].push(...(newCodeEntities));
                            entityToLoad = fileNames[0];
                        } else if(entity.value == CodeEntity.LWC) {
                            let bundleName = name;
                            let fileNames = payload.bundle.map((x : any) => x.filePath);
                            console.log('^^^^ ' + fileNames);
                            newCodeEntities = fileNames.map((x: any) => new NormalizedCodeEntity('', x, null, bundleName, sfApiVersion, null, orgToDeploy));
                            this.entityTypeVsList[entity.value].push(...(newCodeEntities));
                            entityToLoad = fileNames[0];
                        }

                        this.loadEntity(name, null, entityToLoad, orgToDeploy, newCodeEntities[0]);

                        if(entity.value == this.selectedEntityType) {
                            this.setEntityList();
                        }

                    } else {
                        this.errorsPaneVisibility = true;
                        if([''+CodeEntity.ApexClass, CodeEntity.VFComponent, CodeEntity.VFPage].includes(entity.value)) {
                            for(let deployDet of deployResponse.data?.DeployDetails?.allComponentMessages || []) {
                                if(!deployDet.success) {
                                    deployErrors.push({
                                        orgName : orgToDeploy,
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
                                    orgName : orgToDeploy,
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
        let entity1 = this.entityList[Math.floor(Math.random()*this.entityList.length)];
        let entity2 = this.entityList[Math.floor(Math.random()*this.entityList.length)];
        let id = entity1.value;
        let codeEntity = this.entityIdVsObjectMap[id];
        this.loadEntity(codeEntity.Name, null, this.selectedEntityType, this.selectedOrg, codeEntity);
        
        id = entity2.value;
        codeEntity = this.entityIdVsObjectMap[id];
        this.loadEntity(codeEntity.Name, null, this.selectedEntityType, this.selectedOrg, codeEntity);

        // this.openTabs = [
        //     new CodeTab("Welcome" , 'codeEditor_-1' , 'welcome' , 'assets/cloudIcon.png' , 'Welcome', AppConstants.CODE_EDITOR, 'Welcome', '', true),
        //     new CodeTab("Apple Apple" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Apple Apple" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Apple Apple Apple Apple" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        //     new CodeTab("Temp" , '' , 'Temp' , 'assets/cloudIcon.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // ]
    }

    clickBundleItem(bundleItem : NormalizedBundleItem, bundleDetails : NormalizedBundleDetails | undefined | null) {
        if(bundleDetails) { 
            this.loadEntity(bundleItem.value!, null, bundleDetails.entityType, this.activeTab!.orgName,
                new NormalizedCodeEntity(bundleItem.id!, bundleItem.value!, bundleDetails.bundleId, bundleDetails.bundleName, bundleDetails.apiVersion, bundleDetails.namespacePrefix, this.activeTab!.orgName));
        }
    }

    scrollToTab(tab : CodeTab) {
        setTimeout(() => {
            document.querySelector(`div.tab[data-tab-modelid=${tab.modelId}]`)?.scrollIntoView({block:"nearest", behavior:'smooth', inline:"nearest"});
        }, 20);
        
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
        this.loadEntity(tab.tabValue, null, tab.entityType, this.selectedOrg, tab.codeEntity!);
    }

    copyFilename(fullName : boolean) {
        if (navigator.clipboard && window.isSecureContext) {
            let name : string = this.tabForContextMenu?.tabName || '';
            let text = (fullName ? name : name.substring(0, name.lastIndexOf('.'))) || '';
            navigator.clipboard.writeText(text);
            this.showSnackBar('Copied !',null, 500);
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

    reloadingBundleDetails : boolean = false
    async loadBundleDetails(codeTab : CodeTab, ignoreCache : boolean) {
        let orgName = this.selectedOrg;
        if(this.reloadingBundleDetails) return;

        this.reloadingBundleDetails = true;
        this._ipc.callMethod('getBundleDetails', {
            orgName : orgName,
            bundleName : codeTab.bundleName,
            entityType : codeTab.entityType,
            ignoreCache : ignoreCache
        }).then( (x:EnForceResponse) => {
            this.reloadingBundleDetails = false;
            if(x.isSuccess) {
                this.log('loadEntity | getBundleDetails | Success = ' , x);
                codeTab.bundleDetails = x.data;
            } else {
                this.log('loadEntity | getBundleDetails | ERROR = ' , x);
                this.showSnackBar('ERROR occuring while fetching bundle details ');
            }

        }).catch( (x:any) => {
            this.reloadingBundleDetails = false;
            this.log('loadEntity | getBundleDetails | ERROR = ' , x);
            this.showSnackBar('ERROR occuring while fetching bundle details ');
        });
    }

    changeFontSize(increment : boolean) {
        this.editorCmp.changeFontSize(increment);
    }

    hideShowTab(tab?: CodeTab) {
        if(!tab) tab = this.tabForContextMenu;
        if(tab){ 
            tab.hidden = !tab.hidden;
            if(!tab.temporary && tab.hidden && tab.modelId == this.activeTab?.modelId) {
                this.switchTabAfterClosingHiding(tab);
            }
            if(!tab.hidden) {
                this.selectTab(tab);
            }
        }
    }
    pinUnpinTab(event : Event | null, tab? : CodeTab) {
        if(!tab) tab = this.tabForContextMenu;
        if(tab){ 
            if(event && tab.pinned) event.stopPropagation();
            tab.pinned = !tab.pinned;
            //move to the first
            let index = this.openTabs.findIndex((t:CodeTab) => t.modelId == tab.modelId);
            this.openTabs.splice(index,1);
            let indexToInsert = this.openTabs.findIndex((t:CodeTab) => !t.pinned);
            this.openTabs = [
                ...this.openTabs.slice(0, indexToInsert),
                tab,
                ...this.openTabs.slice(indexToInsert)
            ]
            if(tab.pinned && this.isTabActive(tab)) this.scrollToTab(tab);
        }
    }

    openAsPopup() {
        window.open('/', '', 'popup');
    }

    quickDiffMode() {
        this.quickDiffModeFlag = !this.quickDiffModeFlag;
        if(!this.quickDiffModeFlag) {
            this.selectedOrg2 = '--Org 2--';
            this.entityTypeVsList2 = {};
            this.entityList = [];
            if(this.isOrgSelected && this.selectedEntityType) this.setEntityList();
        }
    }

    sideBySideDiff : boolean = true;
    toggleInlineDiff() {
        this.sideBySideDiff = !this.sideBySideDiff
        this.editorCmp.toggleInlineDiff(this.sideBySideDiff);
    }

    async diffWithOrg() {
        try {
            this.showSpinner = true;
            if(!this.tabForContextMenu) return;
            let tab : CodeTab = this.tabForContextMenu;
            
            //fetch code from org
            let name = tab.codeEntity!.Name;
            let response = await this.fetchCode(tab.codeEntity!, name, tab.entityType, tab.orgName);
            let lang = this.getEntityLanguage(name, tab.entityType, tab.codeEntity!.mimeType);
    
            //validate response
            if(!response.isSuccess) {
                this.showSnackBar('ERROR : ' + response.errors[0].message);
                return;
            } else if(!response.data['count']) {
                this.showSnackBar('Not Found : ' + name);
                return;
            } 

            //success response. proceed to create tabs
            let code = response.data[name];
            let recordId = response.data.Id;

            //create model
            let modelId = this.editorCmp.createCodeEditorModel(code, lang);

            this.createDiffTab(null, tab, modelId);

        } catch(err) {
            console.error(err);
        } finally {
            this.showSpinner = false;
        }

    }
    
    log(...str: any) {
        if(!str) str = [];
        str.unshift('code-browser.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }

    showSnackBar(message : string, action? : string | null, duration? : number, verticalPosition? : MatSnackBarVerticalPosition) {
        this.snackBar.open(message, action || 'Close', {
            duration: duration || 2000,
            verticalPosition : verticalPosition || 'top'
        });
    }

    setCode(){
        return `\nWelcome, To\nChaitanya V's\nEnForce IDE for SF Development\n\nThis IDE has been designed to connect to multiple Orgs at once\nand allows the developer to work on Apex, Aura, LWC, VF`;
    }

}