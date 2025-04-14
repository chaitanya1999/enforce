import { ApplicationConfig, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef, Component, Injector, Input, NgZone, SchemaMetadata, ViewChild, afterNextRender, importProvidersFrom } from '@angular/core';
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
import { EnForceResponse } from '../enforce-utils';

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
    imports: [CodeEditorComponent, FormsModule, MatInputModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatTabsModule, MatCardModule, MatButtonModule, MatSnackBarModule, CustomTypeaheadComponent, MatProgressSpinnerModule, MatDialogModule],
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

    selectedOrg: string = '--Org--';
    selectedEntityType: string = '--Type--';
    showSpinner : boolean = false;

    @Input() orgCredsList: OrgCredential[] = [
        <OrgCredential>{
            orgName: 'dummy',
            username: 'username asdf'
        }
    ];

    @Input() orgCredsMap: Map<string, OrgCredential> = new Map<string, OrgCredential>();

    entityTypeList: Array<SelectOption> = Object.keys(AppConstants.entityTypeVsName).map(x => ({ label : AppConstants.entityTypeVsName[x], value : x}));

    entityTypeVsList: any = {
        ApexClass: [],
        AuraComponent: [],
        LWC: []
    }

    entityList: any[] = [
    ]

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
        // new CodeTab("Apple Apple" , 'codeEditor_-10' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple" , 'codeEditor_-11' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
        // new CodeTab("Apple Apple Apple Apple" , 'codeEditor_-12' , 'Temp' , 'assets/sfLogo.png' , '', AppConstants.CODE_EDITOR, '', '', true),
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
        document.querySelector(`div.tab[data-tab-modelid=${x}]`)?.scrollIntoView({block:"nearest"});
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
    cursorPosition : any = {lineNumber : 0 , column : 0};

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
            this.log('globalClickEvent');
        } );

        document.querySelector('.tabRightClickMenu')?.addEventListener('click', (e)=>{
            // this.showTabRightClickMenu = false;
            // e.stopPropagation();
            // e.preventDefault();
        })
        this.activeTab = this.openTabs[0];
    }

    async authenticate() {
        console.log('code-browser.component | authorize')
        this.showSpinner = true;
        await this._ipc.authenticate('OneClick');
        this.showSpinner = false;
    }

    async onOrgSelect(value: any) {
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

        await this.fetchAllEntities(false);
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
        this.entityList = (this.entityTypeVsList[this.selectedEntityType] || []).map( (x:any) => {
            if(this.selectedEntityType == CodeEntity.LWC)
                return { label : x.substring(4), value : x }
            else 
                return { label : x, value : x }
        });
        if(clearSearch)
            this.typeahead.clearSearchQuery();
        this.log('onOrgSelect | this.entityList = ', this.entityList);
    }

    onFocused(evt: any) {

    }
    onEntitySelect(selectOption: SelectOption) {
        this.log('onEntitySelect');
        this.loadEntity(selectOption.value, null, this.selectedEntityType, this.selectedOrg);
    }

    async loadEntity(identifier: string, tabToReload: CodeTab | null, entityType: string, org: string) {
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
                    let tabName = name;
                    if(entityType == CodeEntity.LWC || entityType == CodeEntity.AuraComponent) {
                        tabName = tabName.substring(tabName.lastIndexOf('/') + 1);
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
                    this.openTabs.push(codeTab);
                    this.changeDetectorRef.detectChanges();
                    this.activeTabModelId = modelId;
                    this.editorCmp.switchModel(modelId);
                    this.editorCmp.focus();

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
        this.editorCmp.clearModel(tab.modelId);
        let switchTabModelId = null;
        this.openTabs = this.openTabs.filter(x => x.modelId != tab.modelId);
        
        if(tab.modelId == this.activeTab?.modelId) {
            switchTabModelId = this.openTabs[0]?.modelId ?? null;
            this.log('onTabClose | switchTabModelId = ' + switchTabModelId)
            this.editorCmp.switchModel(switchTabModelId);
            this.activeTabModelId = switchTabModelId;
        }

        if(this.tabForContextMenu?.modelId == tab.modelId) this.tabForContextMenu = undefined;
        if(this.compareTab?.modelId == tab.modelId) this.compareTab = undefined;

        this.deploymentErrors[tab.modelId] = [];
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
        if(!this.pressedKeys.has(evt.key)) {
            this.pressedKeys.add(evt.key);
            this.handleKeyboardShortcuts(evt);
        }
    }

    onKeyUp(evt : KeyboardEvent) {
        this.pressedKeys.delete(evt.key);
    }

    onFocusOut(evt : any) {
        console.log(Date.now() + ' #$#$ FOCUS DEBUG focusout ' , document.activeElement);
        if(!this.ignoreUnfocus && !this.editorContainer.nativeElement.matches(':focus-within')) {
            this.pressedKeys = new Set<string>();
        }
    }

    handleKeyboardShortcuts(evt : KeyboardEvent) {
        //ctrl shift tab
        console.log('#$#$ Keyboard Shortcut = ' , this.pressedKeys);
        if(this.matchShortcut(this.pressedKeys, ['Control', 'Shift', 'Tab']) || this.matchShortcut(this.pressedKeys, ['Control', 'PageUp'])) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            tabIndex = (tabIndex - 1 + this.openTabs.length) % this.openTabs.length;
            this.selectTab(this.openTabs[tabIndex]);
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'Tab']) || this.matchShortcut(this.pressedKeys, ['Control', 'PageDown'])) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            tabIndex = (tabIndex + 1) % this.openTabs.length;
            this.selectTab(this.openTabs[tabIndex]);
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'Shift', 'PageDown'])) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            if(tabIndex < this.openTabs.length-1) {
                let tab1 = this.openTabs[tabIndex];
                let tab2 = this.openTabs[tabIndex+1];
                this.openTabs[tabIndex] = tab2;
                this.openTabs[tabIndex+1] = tab1;
            }
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'Shift', 'PageUp'])) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            if(tabIndex > 0) {
                let tab1 = this.openTabs[tabIndex];
                let tab2 = this.openTabs[tabIndex-1];
                this.openTabs[tabIndex] = tab2;
                this.openTabs[tabIndex-1] = tab1;
            }
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'o'])) {
            evt.preventDefault();
            this.orgSelect.nativeElement.click();
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'p'])) {
            evt.preventDefault();
            this.typeahead.focus();
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 'w'])) {
            evt.preventDefault();
            if(this.activeTab != null)
                this.onTabClose(this.activeTab);
        }
        else if(this.matchShortcut(this.pressedKeys, ['Control', 's'])) {
            evt.preventDefault();
            this.handleSave();
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

        if(tab.editorType == AppConstants.DIFF_EDITOR) return;

        this.tabForContextMenu = tab;
        this.showTabRightClickMenu = true;
        let contextMenu: HTMLElement = document.querySelector('.tabRightClickMenu')!;
        contextMenu.setAttribute('style',`
            left : ${event.clientX}px;
            top : ${event.clientY}px;
        `);
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
        this.loadEntity(tab.tabValue, tab, tab.entityType, tab.orgName);
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
                Id : tab.recordId,
                Code : this.editorCmp.getContent(tab.modelId),
                Type : tab.entityType,
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