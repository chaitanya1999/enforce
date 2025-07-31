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
import { PromptDialogComponent, PromptDialogOptions } from '../prompt-dialog/prompt-dialog.component';
import { sfApiVersion } from '../salesforce.service';
import { ResizableModule } from 'angular-resizable-element';
import {MatTooltipModule} from '@angular/material/tooltip';
import { CodeGlobalSearchComponent } from '../code-global-search/code-global-search.component';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { AppTreeViewComponent } from '../app-tree-view/app-tree-view.component';
import { text } from 'express';
import { firstValueFrom } from 'rxjs';
import { CommandPaletteDialogData } from '../command-palette/command-palette-dialog-data';
import { CodeTab } from '../CodeTab';
import { EditorSession } from '../EditorSession';

// Type for the data inside EnForceResponse for bulk fetch
type BulkFetchCodeData = {
    count: number;
    contents: Array<{ Id: string; [key:string] : string; }>;
};

class Command {
    name: string;
    uniqueId: string;
    action?: () => void;
    badge?: string;
    shadowText?: string;

    constructor(name: string, uniqueId: string, action: () => void, badge?: string, shadowText?: string) {
        this.name = name;
        this.uniqueId = uniqueId;
        this.action = action;
        this.badge = badge;
        this.shadowText = shadowText;
    }
}

@Component({
    selector: 'app-code-browser',
    standalone: true,
    imports: [AppTreeViewComponent, CommandPaletteComponent, CodeEditorComponent, FormsModule, MatInputModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatTabsModule, MatCardModule, MatButtonModule, MatSnackBarModule, CustomTypeaheadComponent, MatProgressSpinnerModule, MatDialogModule, ResizableModule, MatTooltipModule],
    templateUrl: './code-browser.component.html',
    styleUrl: './code-browser.component.css',
    // schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CodeBrowserComponent {

    @Input() isComponentActive : boolean = false;

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
    allEntitiesList: Array<SelectOption> = [];

    get entityCount1() {
        return Object.values(this.entityTypeVsList).flat().length || 0;
    }

    get entityCount2() {
        return Object.values(this.entityTypeVsList2).flat().length || 0;
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
    draggedTab: HTMLElement | undefined;

    // Drag start: store the dragged tab element
    // tabDragStart(event: DragEvent) {
    //     this.draggedTab = event.target as HTMLElement;
    //     event.dataTransfer?.setData('text/plain', this.draggedTab.dataset['tabModelid'] || '');
    //     event.dataTransfer!.effectAllowed = 'move';
    // }

    // // Drag end: clear the dragged tab
    // tabDragEnd(event: DragEvent) {
    //     this.draggedTab = undefined;
    // }

    // // Drag enter: add visual feedback
    // tabDragEnter(event: DragEvent) {
    //     event.preventDefault();
    //     if (event.target instanceof HTMLElement && event.target.classList.contains('tab')) {
    //         event.target.classList.add('tab-drag-over');
    //     }
    // }

    // // Drag leave: remove visual feedback
    // tabDragLeave(event: DragEvent) {
    //     if (event.target instanceof HTMLElement && event.target.classList.contains('tab')) {
    //         event.target.classList.remove('tab-drag-over');
    //     }
    // }

    // // Drop: reorder the tabs in openTabs array
    // tabDrop(event: DragEvent) {
    //     event.preventDefault();
    //     if (!this.draggedTab) return;
    //     const sourceModelId = this.draggedTab.dataset['tabModelid'];
    //     const target = event.target instanceof HTMLElement && event.target.classList.contains('tab')
    //         ? event.target
    //         : (event.target as HTMLElement).closest('.tab');
    //     if (!target) return;
    //     const destModelId = (target as HTMLElement).dataset['tabModelid'];
    //     if (!sourceModelId || !destModelId || sourceModelId === destModelId) return;
    //     const sourceIdx = this.openTabs.findIndex(x => x.modelId === sourceModelId);
    //     const destIdx = this.openTabs.findIndex(x => x.modelId === destModelId);
    //     if (sourceIdx === -1 || destIdx === -1) return;
    //     // Remove and re-insert tab
    //     const [movedTab] = this.openTabs.splice(sourceIdx, 1);
    //     this.openTabs.splice(destIdx, 0, movedTab);
    //     this.changeDetectorRef.detectChanges();
    //     // Remove drag-over class
    //     target.classList.remove('tab-drag-over');
    // }

    //tab right click
    showTabRightClickMenu : boolean = false;
    tabForContextMenu: CodeTab | undefined;

    //select for compare
    compareTab: CodeTab | undefined;

    //focus issue on model switch
    ignoreUnfocus: boolean = false;

    //LANGUAGE SELECTOR
    // @ViewChild('languageSelector') languageSelector! : CustomTypeaheadComponent;
    languageList : SelectOption[] = [
        this.createOption('java'),
        this.createOption('apex'),
        this.createOption('javascript'),
        this.createOption('html'),
        this.createOption('xml'),
        this.createOption('css'),
        this.createOption('typescript'),
        this.createOption('sql'),
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
    isCodeBrowserActive : boolean = false; // Used to track if tab is active or not. If not active, it will not load the code editor model.

    get activeEntityTypeLabel() {
        return AppConstants.entityTypeVsName_singular[this.activeTab!.entityType];
    }

    showQuickActions : boolean = true; // Used to show/hide quick actions in code editor

    constructor(private readonly _ipc: IpcService, private ref: ChangeDetectorRef, private snackBar: MatSnackBar
        , private globalEventsSvc: GlobalEventsService , private zone: NgZone, private injector : Injector , private changeDetectorRef : ChangeDetectorRef
        , private dialog : MatDialog
    ) {
        
    }

    createOption(value: string) {
        return <SelectOption>{label : value, value : value};
    }

    codeBrowserFirstOpenFlag : boolean = false;
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
            if(x.reselected == true && x.tab.tabName == 'Code Browser') {
                this.toggleSidePanel(null);
            }
            this.isCodeBrowserActive = (x.tab.tabName == 'Code Browser');
            if(this.isCodeBrowserActive && !this.codeBrowserFirstOpenFlag) {
                this.codeBrowserFirstOpenFlag = true;
                this.codeBrowserFirstOpen();
            }
        });

        this.globalEventsSvc.logoClickEvent.subscribe((x:any) => {
            if(this.isCodeBrowserActive) {
                this.openMainCommandPalette();
            }
        });
        this.globalEventsSvc.beforeUnloadEvent.subscribe((x:any) => {
            alert('saving');
            this.saveEditorSession(true);
        });
    }

    codeBrowserFirstOpen() {
        this.log('codeBrowserFirstOpen');
        setTimeout( () => this.loadEditorSession(), 500);
    }
    addTab(codeTab: CodeTab) {
        // Find the index of the active tab
        let idx = this.openTabs.findIndex(tab => tab.modelId === this.activeTabModelId);

        // Determine if the active tab is pinned
        let activeTab = this.openTabs[idx];
        if (activeTab && activeTab.pinned) {
            // Find the last pinned tab
            let lastPinnedIdx = -1;
            for (let i = 0; i < this.openTabs.length; i++) {
                if (this.openTabs[i].pinned) lastPinnedIdx = i;
            }
            // Insert after the last pinned tab
            this.openTabs.splice(lastPinnedIdx + 1, 0, codeTab);
        } else if (idx !== -1) {
            // Insert after the active tab
            this.openTabs.splice(idx + 1, 0, codeTab);
        } else {
            // No active tab, just push
            this.openTabs.push(codeTab);
        }
        this.openTabs = [...this.openTabs]; // trigger change detection
        this.changeDetectorRef.detectChanges();
    }

    async authenticate() {
        console.log('code-browser.component | authorize')
        this.showSpinner = true;
        await this._ipc.authenticate('OneClick');
        this.showSpinner = false;
    }

    closeDefaultTemporaryTab() {
        if(this.defaultTabOpen) {
            this.defaultTabOpen = false;
            this.openTabs = [];
            this.editorCmp.clearAllModels();
        }
    }

    async onOrgSelect(value: any, orgProperty : string) {
        try {
            this.log('onOrgSelect | value = ' , value);
            (<any>this)[orgProperty] = value;
            this.log(`onOrgSelect | ${orgProperty} = ` + value);
            if(value == '--Org--' || !value || value == '--Org 2--') 
                return;

            this.closeDefaultTemporaryTab();
            
            if(this.quickDiffModeFlag) {
                if(this.selectedOrg == this.selectedOrg2 && this.isOrgSelected && this.isOrg2Selected) {
                    this.showSnackBar('Both orgs cannot be same in Quick Diff Mode');
                    if(orgProperty=='selectedOrg') setTimeout(() => this.selectedOrg = '--Org--', 0);
                    if(orgProperty=='selectedOrg2') setTimeout(() => this.selectedOrg2 = '--Org 2--', 0);
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

    /* This function will only be called for one org at a time. For quick diff mode , it is called twice, once for each org */
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
                if(!reloadBothOrgs) { //should get called only once when reloading both orgs which happens in DIFF mode ONLY when both orgs are selected
                    this.setEntityIdVsObjectMap(orgProperty);
                    this.setAllEntitiesList();
                    this.onEntityTypeSelect(this.selectedEntityType);
                }
                this.showSnackBar('List loaded succesfully');
            }

            if(!reloadBothOrgs || ignoreSpinner)
                this.showSpinner = false;
        } catch(err) {
            this.log('fetchAllEntities | ERROR CAUGHT -> ' , err);
            this.showSnackBar('Some error occurred');
        }
    }

    setEntityIdVsObjectMap(orgProperty? : string) {
        this.entityIdVsObjectMap = {}; //clear the map when invoked for one org only
        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            //if quick diff mode is enabled, we need to set the map for both orgs
            this.setEntityIdVsObjectMapForOrg('selectedOrg');
            this.setEntityIdVsObjectMapForOrg('selectedOrg2');
        } else {
            if(!orgProperty) orgProperty = 'selectedOrg';
            this.setEntityIdVsObjectMapForOrg(orgProperty);
        }
        this.log('setEntityIdVsObjectMap | this.entityIdVsObjectMap = ', Object.keys(this.entityIdVsObjectMap).length);
    }

    setEntityIdVsObjectMapForOrg(orgProperty: string) {
        let org = (<any>this)[orgProperty];
        let entityTypeVsList = orgProperty == 'selectedOrg' ? this.entityTypeVsList : this.entityTypeVsList2;

        Object.keys(entityTypeVsList).forEach((entityType) => {
            entityTypeVsList[entityType].forEach((codeEntity: NormalizedCodeEntity) => {
                this.entityIdVsObjectMap[org + ':' + codeEntity.Id] = codeEntity;
            });
        });
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

        // this.entityIdVsObjectMap = {};
        let entityLabelMap : any = {}; //for unique items in quick diff mode

        //selected org 1 handling
        if(this.isOrgSelected) {
            this.entityTypeVsList[selEntityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
                // this.entityIdVsObjectMap[org1 + ':' + codeEntity.Id] = codeEntity;
                let x = codeEntity.Name;
                if(selEntityType == CodeEntity.LWC)
                    x = x.substring(4);
                entityLabelMap[x] = { label : x, value : codeEntity.Id, value2 : null, org1 : org1, org2 : org2, value1: selEntityType };
            });
        }
        if(org2) {
            this.entityTypeVsList2[selEntityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
                // this.entityIdVsObjectMap[org2 + ':' + codeEntity.Id] = codeEntity;
                let x = codeEntity.Name;
                if(selEntityType == CodeEntity.LWC)
                    x = x.substring(4);

                let entityOption = entityLabelMap[x] || {};
                entityOption = {
                    ...entityOption,
                    label : x, value2 : codeEntity.Id, org1 : org1, org2 : org2,
                    value1: selEntityType
                }
                entityLabelMap[x] = entityOption;
            });
        }

        this.entityList = Object.values(entityLabelMap);

    }

    setAllEntitiesList() {
        let allEntitiesList : any = [];
        for (const entityType of Object.keys(AppConstants.entityTypeVsName)) {
            let org1 = this.selectedOrg, org2 = null;
            if (this.quickDiffModeFlag && this.isOrg2Selected) org2 = this.selectedOrg2;

            let entityLabelMap: any = {};

            // Org 1 entities
            if (this.isOrgSelected) {
                this.entityTypeVsList[entityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
                    let x = codeEntity.Name;
                    if (entityType == CodeEntity.LWC)
                        x = x.substring(4);
                    entityLabelMap[entityType + ':' + x] = {
                        label: x,
                        value: codeEntity.Id,
                        value2: null,
                        org1: org1,
                        org2: org2,
                        value1: entityType
                    };
                });
            }
            // Org 2 entities (for quick diff)
            if (org2) {
                this.entityTypeVsList2[entityType]?.forEach((codeEntity: NormalizedCodeEntity) => {
                    let x = codeEntity.Name;
                    if (entityType == CodeEntity.LWC)
                        x = x.substring(4);
                    let key = entityType + ':' + x;
                    let entityOption = entityLabelMap[key] || {};
                    entityOption = {
                        ...entityOption,
                        label: x,
                        value2: codeEntity.Id,
                        org1: org1,
                        org2: org2,
                        value1: entityType
                    };
                    entityLabelMap[key] = entityOption;
                });
            }
            allEntitiesList.push(...Object.values(entityLabelMap));
        }
        this.allEntitiesList = allEntitiesList;
        this.log('setAllEntitiesList | allEntitiesList length = ', this.allEntitiesList);
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
        
        let entityType = selectOption.value1 || this.selectedEntityType;

        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            if(codeEntity && codeEntity2) {
                this.showSpinner = true;
                Promise.all(
                    [this.loadEntity(codeEntity.Name, null, entityType, org, codeEntity, true, false, true, true, true),
                    this.loadEntity(codeEntity2.Name, null, entityType, org2, codeEntity2, true, false, true, true, true)]
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
                let codeEntityToLoad, orgToLoad;
                ([codeEntityToLoad, orgToLoad] = (codeEntity ? [codeEntity , org] : [codeEntity2 , org2]));
                if(!codeEntity) {
                    this.showSnackBar(`Not Found on Org : ${org} ` + selectOption.label);
                }
                if(!codeEntity2) {
                    this.showSnackBar(`Not Found on Org : ${org2} ` + selectOption.label);
                }
                this.loadEntity(codeEntityToLoad.Name, null, entityType, orgToLoad, codeEntityToLoad);
            }
        } else {
            this.loadEntity(codeEntity.Name, null, entityType, org, codeEntity);
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
            let response : any = await this.fetchCode([codeEntity], [org]);
            lang = this.getEntityLanguage(name, entityType, codeEntity.mimeType);

            response = <EnForceResponse>(response[org][entityType]);
    
            //validate response
            if(!response.isSuccess) {
                this.showSnackBar('ERROR : ' + response.errors[0].message);
                return;
            } else if(!response.data['count']) {
                this.showSnackBar('Not Found : ' + name);
                return;
            } 

            //success response. proceed to create tabs
            code = response.data.contents[0][name];
            let recordId = response.data.contents[0].Id;

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
            icon = AppConstants.languageVsIcon[lang] || 'assets/log icon.png';

            //create tab
            let codeTab = new CodeTab(tabName , modelId , name , icon , org, AppConstants.CODE_EDITOR, entityType, recordId);
            codeTab.bundleName = bundleName;
            codeTab.codeEntity = codeEntity;
            codeTab.hidden = !!openHidden;
            this.addTab(codeTab);
            // this.changeDetectorRef.detectChanges();
            if(!openInBackground)
                this.selectTab(codeTab);

            this.log('loadEntity | loadBundleDetails ');
            if(this.isBundle(entityType))
                this.loadBundleDetails([codeTab], entityType, false, org);
            
            this.selectedLanguage = this.editorCmp.getModelLanguage();
            // this.languageSelector.setSearchQuery(this.selectedLanguage);

            return codeTab;
                        
        } catch(err) {
            this.log(' loadEntity ERROR => ', err);
            return null;
        } finally {
            if(!ignoreSpinner) this.showSpinner = false;
        }

    }

    async loadEntityBulk(
        codeEntities: NormalizedCodeEntity[],
        org: string[], //org is not needed as NormalizedCodeEntity already has orgName , so org can be derived from it
        openInBackground?: boolean,
        openHidden?: boolean,
        ignoreSpinner?: boolean
    ) : Promise<{[orgName : string]: CodeTab[]} | null> {
        if (!ignoreSpinner) this.showSpinner = true;
        try {
            // Find already loaded entities
            const alreadyLoadedTabs: CodeTab[] = [];
            const toFetchEntities: NormalizedCodeEntity[] = [];
            for (const codeEntity of codeEntities) {
                const existingTab = this.openTabs.find(
                    x => x.tabValue === codeEntity.Name && x.orgName === codeEntity.OrgName && x.entityType === codeEntity.entityType
                );
                if (existingTab) {
                    alreadyLoadedTabs.push(existingTab);
                } else {
                    toFetchEntities.push(codeEntity);
                }
            }

            // We'll want to select the tab corresponding to the last entity in codeEntities
            const lastEntity = codeEntities[codeEntities.length - 1];
            let lastTab: CodeTab | undefined;

            // Collect messages for bulk snackbar
            const alreadyLoadedNames: string[] = [];
            const loadedNames: string[] = [];
            const notFoundNames: string[] = [];
            const errorMessages: string[] = [];

            if (alreadyLoadedTabs.length) {
                alreadyLoadedNames.push(...alreadyLoadedTabs.map(tab => tab.tabName));
            }

            // Group toFetchEntities by entityType for batch fetch
            const entityTypeGroups: { [entityType: string]: NormalizedCodeEntity[] } = {};
            for (const codeEntity of toFetchEntities) {
                if (!entityTypeGroups[codeEntity.entityType]) {
                    entityTypeGroups[codeEntity.entityType] = [];
                }
                entityTypeGroups[codeEntity.entityType].push(codeEntity);
            }

            let createdTabs: CodeTab[] = [];
            // Bulk fetch code for all entityType groups at once
            if (Object.keys(entityTypeGroups).length > 0) {
                // Fetch code for all entities in one call using the original codeEntities array
                const response: EnForceResponse = await this.fetchCode(codeEntities, org);
                // The response is an object: { [org]: { [entityType]: EnForceResponse } }
                // for (const orgName of org) {
                    for (const entityType of Object.keys(entityTypeGroups)) {
                        const entities = entityTypeGroups[entityType];

                        // Each entity in entities should correspond to a content in contents by order
                        for (let i = 0; i < entities.length; i++) {
                            const codeEntity = entities[i];
                            let orgName = codeEntity.OrgName;

                            const entityTypeResponse = (response as any)[orgName]?.[entityType];
                            const data = entityTypeResponse?.data as BulkFetchCodeData | undefined;

                            if (!entityTypeResponse || !entityTypeResponse.isSuccess || !data || !Array.isArray(data.contents)) {
                                errorMessages.push(`ERROR: No valid response for ${entityType} in org ${orgName}`);
                                continue;
                            }

                            const name = codeEntity.Name;
                            const lang = this.getEntityLanguage(name, codeEntity.entityType, codeEntity.mimeType);

                            // Try to find the content for this entity by name
                            const contentObj = data.contents.find(x => x.Id === codeEntity.Id || (codeEntity.Name in x));
                            if (!contentObj || !contentObj[name]) {
                                notFoundNames.push(name);
                                continue;
                            }

                            const code = contentObj[name];
                            const recordId = contentObj.Id || '';

                            //update codeEntity with latest details
                            if (contentObj['Id']) codeEntity.Id = contentObj['Id'];
                            if (contentObj['BundleId']) codeEntity.BundleId = contentObj['BundleId'];
                            if (contentObj['BundleName']) codeEntity.BundleName = contentObj['BundleName'];
                            if (contentObj['ApiVersion']) codeEntity.ApiVersion = contentObj['ApiVersion'];
                            if (contentObj['NamespacePrefix']) codeEntity.NamespacePrefix = contentObj['NamespacePrefix'];
                            if (contentObj['mimeType']) codeEntity.mimeType = contentObj['mimeType'];


                            const modelId = this.editorCmp.createCodeEditorModel(code, lang);
                            const tabName = this.getTabName(name, codeEntity.entityType, codeEntity);
                            const icon = AppConstants.languageVsIcon[lang];
                            const codeTab = new CodeTab(tabName, modelId, name, icon, orgName, AppConstants.CODE_EDITOR, codeEntity.entityType, recordId);
                            codeTab.bundleName = codeEntity.BundleName!;
                            codeTab.codeEntity = codeEntity;
                            codeTab.hidden = !!openHidden;
                            this.addTab(codeTab);
                            createdTabs.push(codeTab);
                            loadedNames.push(tabName);

                            // if (this.isBundle(codeEntity.entityType)) this.loadBundleDetails(codeTab, false, orgName);
                        }
                    }
                // }
            }


            // Bundle Details loading logic START

            let entityTypeVsCreatedTabs: { [key: string]: CodeTab[] } = {};
            for (const tab of createdTabs) {
                if (!entityTypeVsCreatedTabs[tab.entityType]) {
                    entityTypeVsCreatedTabs[tab.entityType] = [];
                }
                entityTypeVsCreatedTabs[tab.entityType].push(tab);
            }
            // Load bundle details for all created tabs
            for (const entityType of Object.keys(entityTypeVsCreatedTabs)) {
                const tabs = entityTypeVsCreatedTabs[entityType];
                if (this.isBundle(entityType)) {
                    let orgVsTabs: { [key: string]: CodeTab[] } = {};
                    // Group tabs by orgName
                    for (const tab of tabs) {
                        if (!orgVsTabs[tab.orgName]) orgVsTabs[tab.orgName] = [];
                        orgVsTabs[tab.orgName].push(tab);
                    }
                    // Load bundle details for each org
                    for (const orgName of Object.keys(orgVsTabs)) {
                        // Load bundle details for all tabs of this entity type
                        this.loadBundleDetails(orgVsTabs[orgName], entityType, false, orgName);
                    }
                }
            }
            // Bundle Details loading logic END

            // Collate all messages and show a single snackbar
            let messages: string[] = [];
            if (alreadyLoadedNames.length) {
                messages.push(`Already open: ${alreadyLoadedNames.length}`);
            }
            if (loadedNames.length) {
                messages.push(`Loaded: ${loadedNames.length}`);
            }
            if (notFoundNames.length) {
                messages.push(`Not Found: ${notFoundNames.length}`);
            }
            if (errorMessages.length) {
                messages.push(errorMessages.join('\n'));
            }
            if (messages.length) {
                let finalMsg = messages.join('\n');
                this.showSnackBar(finalMsg , null, 2000);
                this.log('loadEntityBulk | Messages => ', finalMsg);
            }

            // Find the tab (either already loaded or just created) for the last entity
            lastTab = [...alreadyLoadedTabs, ...createdTabs].at(-1);
            // .find(
            //     tab => tab.tabValue === lastEntity.Name && tab.orgName === org && tab.entityType === lastEntity.entityType
            // );

            if (lastTab && !openInBackground) {
                this.selectTab(lastTab);
            }

            // Group tabs by orgName into an object: { [orgName]: CodeTab[] }
            return [...alreadyLoadedTabs, ...createdTabs].reduce((acc, tab) => {
                if (!acc[tab.orgName]) acc[tab.orgName] = [];
                acc[tab.orgName].push(tab);
                return acc;
            }, {} as { [key: string]: CodeTab[] });

        } catch (err) {
            this.log('loadEntityBulk ERROR =>', err);
            this.showSnackBar('Some error occurred');
            return null;
        } finally {
            if (!ignoreSpinner) this.showSpinner = false;
        }
    }

    /**
     * Loads all entities from a Salesforce package.xml string.
     * @param packageXml The package.xml content as a string.
     */
    async loadEntitiesFromPackageXml(packageXml: string, skipFewAuraFiles : boolean) {
        this.log('loadEntitiesFromPackageXml | skipFewAuraFiles = ', skipFewAuraFiles);
        // Parse the XML string
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(packageXml, "application/xml");
        let types = Array.from(xmlDoc.getElementsByTagName("types"));
        let entitiesToLoad: NormalizedCodeEntity[] = [];

        // Helper to get text content of a tag
        const getText = (el: Element, tag: string) =>
            Array.from(el.getElementsByTagName(tag)).map(e => e.textContent?.trim() || '');

        let orgs = [this.selectedOrg];
        let diffFlag = false;
        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            orgs.push(this.selectedOrg2);
            diffFlag = true;
        }

        for (let typeEl of types) {
            let members = getText(typeEl, "members");
            let nameArr = getText(typeEl, "name");
            if (!nameArr.length) continue;
            let entityType = nameArr[0];
            if(!Object.keys(AppConstants.packageXmlEntityTypeToEnforceType).includes(entityType))
                continue; // Skip unsupported types

            // Map package.xml type to AppConstants entityType if needed
            // (e.g., ApexClass, AuraComponent, LWC, etc.)
            let normalizedEntityType = AppConstants.packageXmlEntityTypeToEnforceType[entityType];

            // Get all code entities for this type from the selected org
            let codeEntities = Array.from(this.entityTypeVsList[normalizedEntityType] || []); //copy array
            if(diffFlag) codeEntities.push(...(this.entityTypeVsList2[normalizedEntityType] || []));

            if (normalizedEntityType === this.$entityTypeAura || normalizedEntityType === this.$entityTypeLWC) {
                // For Aura/LWC, match by bundleName
                for (let bundleName of members) {
                    let matched : NormalizedCodeEntity[] = codeEntities.filter(e => e.BundleName === bundleName) || [];
                    this.log(`loadEntitiesFromPackageXml | Matching ${normalizedEntityType} by BundleName: ${bundleName} = ` , matched.length);
                    if(normalizedEntityType === this.$entityTypeAura && skipFewAuraFiles) {
                        matched = matched.filter((x : NormalizedCodeEntity) => {
                            const found = Object.entries(AppConstants.aura_suffixVsDefTypes).find(([suffix, _]) => x.Name.endsWith(suffix));
                            const defType = found ? found[1] as string : 'COMPONENT';
                            return !['RENDERER', 'DESIGN', 'SVG', 'DOCUMENTATION'].includes(defType)
                        })
                    }
                    if(matched.length) entitiesToLoad.push(...matched);
                }
            } else {
                // For others, match by Name
                for (let name of members) {
                    let matched : NormalizedCodeEntity[] = codeEntities.filter(e => e.Name === name) || [];
                    this.log(`loadEntitiesFromPackageXml | Matching ${normalizedEntityType} by Name: ${name} = ` , matched.length);
                    if(matched.length) entitiesToLoad.push(...matched);
                }
            }
        }

        // Remove duplicates
        const seen = new Set();
        entitiesToLoad = entitiesToLoad.filter(e => {
            const key = `${e.entityType}:${e.Name}:${e.OrgName}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        this.log('loadEntitiesFromPackageXml | entitiesToLoad = ', entitiesToLoad);

        if (entitiesToLoad.length === 0) {
            this.showSnackBar('No matching entities found in org for package.xml');
            return;
        }


        let orgVsTab = await this.loadEntityBulk(entitiesToLoad, orgs, diffFlag == true);
        let tabsList : CodeTab[] = Object.values(orgVsTab || {}).flat();

        if(diffFlag) {
            this.log('loadEntitiesFromPackageXml | Creating diff tabs for orgs');
            this.log('loadEntitiesFromPackageXml | Tabs Count before = ' + tabsList.length);

            // In quick diff mode, we create diff tabs for entities present in both orgs
            this.showSpinner = true;
            // orgVsTab: { [orgName]: CodeTab[] }
            // There will always be only two orgs in orgVsTab
            if (orgVsTab && orgs.length === 2) {
                const [org1, org2] = orgs;
                const tabs1 = orgVsTab[org1] || [];
                const tabs2 = orgVsTab[org2] || [];

                // Map by tabValue + entityType for unique match
                const tabMap1 = new Map<string, CodeTab>();
                const tabMap2 = new Map<string, CodeTab>();
                tabs1.forEach(tab => tabMap1.set(`${tab.tabValue}::${tab.entityType}`, tab));
                tabs2.forEach(tab => tabMap2.set(`${tab.tabValue}::${tab.entityType}`, tab));

                // For each entity present in both orgs, create a diff tab
                for (const [key, tab1] of tabMap1.entries()) {
                    const tab2 = tabMap2.get(key);
                    if (tab2) {
                        // Hide originals, show only diff
                        if (!tab1.hidden) this.hideShowTab(tab1);
                        if (!tab2.hidden) this.hideShowTab(tab2);
                        tabsList.push(this.createDiffTab(tab1, tab2, undefined, true));
                    } else {
                        // Only present in org1, do not create diff tab, show original
                        if (tab1.hidden) this.hideShowTab(tab1);
                    }
                }
                // Also check for entities only in org2 (not in org1)
                for (const [key, tab2] of tabMap2.entries()) {
                    if (!tabMap1.has(key)) {
                        // Only present in org2, do not create diff tab, show original
                        if (tab2.hidden) this.hideShowTab(tab2);
                    }
                }
            }
            this.showSpinner = false;
            this.log('loadEntitiesFromPackageXml | Tabs Count after = ' + tabsList.length);
        }
        if(tabsList.length)
            this.selectTab(tabsList.at(-1)!)
    }

    async openFromPackageXml() {
        this.log('openFromPackageXml | Opening package.xml dialog');

        if(!this.isOrgSelected) {
            this.showSnackBar('Please select an org first');
            this.log('openFromPackageXml | No org selected');
            return;
        }

        // Call IPC method to fetch last package.xml contents (async/await version)
        const res: EnForceResponse = await this._ipc.callMethod('getLastPackageXml');
        let lastPackageXml : string = res.data || '';

        // Open a prompt dialog to get package.xml string from user
        const dialogRef = this.dialog.open(PromptDialogComponent, {
            data: <PromptDialogOptions>{
                text: 'Paste your Salesforce package.xml here',
                placeholder: 'package.xml',
                label: 'package.xml',
                isTextAreaRequired: true,
                isTextFieldRequired : false,
                validationText: 'Please enter a valid Salesforce package.xml',
                textAreaValue: lastPackageXml,
                checkboxRequired: true,
                checkboxLabel: 'Skip Aura non-essential files',
                checkboxValue: true
            }
        });

        dialogRef.afterClosed().subscribe(async (data: any) => {
            if(!data) return; // User cancelled
            const xml = data.textArea?.trim();
            if (!xml) {
                this.showSnackBar('Invalid Salesforce package.xml');
                this.log('openFromPackageXml | No input provided');
                return;
            }

            // Basic validation: check for <Package> and <types> tags and no parsererror
            let isValid = false;
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xml, "application/xml");
                const hasParserError = xmlDoc.getElementsByTagName("parsererror").length > 0;
                const hasPackage = xmlDoc.getElementsByTagName("Package").length > 0;
                const hasTypes = xmlDoc.getElementsByTagName("types").length > 0;
                isValid = !hasParserError && hasPackage && hasTypes;
            } catch {
                isValid = false;
            }

            if (!isValid) {
                this.showSnackBar('Invalid Salesforce package.xml');
                return;
            }

            this._ipc.callMethod('storePackageXml', xml);
            await this.loadEntitiesFromPackageXml(xml , data.checkbox);
        });
    }

    async fetchCode(codeEntities : NormalizedCodeEntity[], orgs : string[]) : Promise<EnForceResponse> {
        
        let params : any = {
            'OrgNames' : orgs,
            'CREDENTIALS' : {}
        };

        orgs.forEach(org => {
            params['CREDENTIALS'][org] = this.orgCredsMap.get(org);//! should be added by salesforce service , creds should not exist anywhere in this component, only in the service
        });

        // Group entities by type for bulkification
        const auraNames: string[] = [];
        const auraDefTypes: string[] = [];
        const lwcFileNames: string[] = [];
        const entityTypeVsNames: { [key: string]: string[] } = {};

        for (let codeEntity of codeEntities) {
            const name = codeEntity.Name;
            const entityType = codeEntity.entityType;
            const bundleName = codeEntity.BundleName!;

            if (entityType == CodeEntity.AuraComponent) {
                // Find the defType for the aura file
                const found = Object.entries(AppConstants.aura_suffixVsDefTypes).find(([suffix, _]) => name.endsWith(suffix));
                const defType = found ? found[1] as string : 'COMPONENT';
                auraNames.push(bundleName);
                auraDefTypes.push(defType);
            } else if (entityType == CodeEntity.LWC) {
                lwcFileNames.push(name);
            } else {
                if (!entityTypeVsNames[entityType]) entityTypeVsNames[entityType] = [];
                entityTypeVsNames[entityType].push(name);
            }
        }

        if (auraNames.length) {
            params[CodeEntity.AuraComponent] = { names: auraNames, defTypes: auraDefTypes };
        }
        if (lwcFileNames.length) {
            params[CodeEntity.LWC] = { fileNames: lwcFileNames };
        }
        for (const [entityType, names] of Object.entries(entityTypeVsNames)) {
            params[entityType] = { names };
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
            event.preventDefault();
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
        // this.languageSelector.setSearchQuery(this.selectedLanguage);
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

    async onTabClose(tab: CodeTab): Promise<void> {
        this.log('onTabClose | tab modelId CLOSE = ' + tab.modelId);

        if (tab.editorType == AppConstants.CODE_EDITOR && tab.diffTabModelIds.size) {
            this.showSnackBar('Cannot close parent tab when DIFF is open', null, 1500);
            return;
        }
        if (tab.editorType == AppConstants.CODE_EDITOR && tab.contentChanged) {
            const dialogRef = this.dialog.open(ConfirmDialogComponent, {
                data: {
                    text: `${tab.tabName} [${tab.orgName}]<br/>You may have some unsaved changes.<br/>Are you sure to close the tab without saving ?`
                }
            });
            const result = await firstValueFrom(dialogRef.afterClosed());
            if (result) {
                this.proceedForClosingTab(tab);
            }
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
        else this.editorCmp.clearModel();
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

    /**
     * Switches to another visible tab after closing or hiding the given tab.
     * If no visible tab is found, clears the active tab and unloads the editor model.
     * @param closedHiddenTab The tab that was closed or hidden.
     */
    switchTabAfterClosingHiding(closedHiddenTab : CodeTab) {
        // Find the index of the closed/hidden tab in the openTabs array
        let index = this.openTabs.findIndex( (x:CodeTab) => closedHiddenTab.modelId == x.modelId);
        //! ASSERT index != -1

        // Initialize variable to hold the index of the next visible tab
        let newTabIndex = null;

        // Search for the nearest visible tab before the closed/hidden tab
        newTabIndex = this.findPreviousTab(index);

        // If not found before, search for the next visible tab after the closed/hidden tab
        if(!newTabIndex && newTabIndex!==0) {
            newTabIndex = this.findNextTab(index);
        }

        // If a visible tab is found, select it
        if(newTabIndex || newTabIndex===0) {
            this.selectTab(this.openTabs[newTabIndex]);
        } else {
            // If no visible tab is found, clear the active tab and unload the editor model
            this.activeTabModelId = null;
            this.editorCmp.unloadModel();
        }
    }

    findNextTab(index : number) : number | null {
        let newTabIndex = null;

        for(let i=index+1; i<this.openTabs.length; i++) {
            let iTab = this.openTabs[i];
            if(!iTab.hidden) {newTabIndex = i;break;}
        }

        return newTabIndex;
    }

    findPreviousTab(index : number) : number | null {
        let newTabIndex = null;

        for(let i=0; i<index; i++) {
            let iTab = this.openTabs[i];
            if(!iTab.hidden) newTabIndex = i;
        }

        return newTabIndex;
    }

    open() {

    }

    async reloadOrgMetadata() {
        if(this.quickDiffModeFlag && this.isOrgSelected && this.isOrg2Selected) {
            this.showSpinner = true;
            Promise.all([this.fetchAllEntities(true, 'selectedOrg', true), this.fetchAllEntities(true, 'selectedOrg2', true)])
            .then((values : any) => {
                this.setEntityIdVsObjectMap();
                this.setAllEntitiesList();
                this.onEntityTypeSelect(this.selectedEntityType);
                this.showSpinner = false;
            })
        } else {
            if(this.isOrgSelected)
                await this.fetchAllEntities(true, 'selectedOrg');
            else if(this.isOrg2Selected)
                await this.fetchAllEntities(true, 'selectedOrg2');
            else 
                this.showSnackBar('No org selected');
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

    //#region Command Palette

    // Command Palette integration
    private commandPaletteCommands : Command[] = [
        new Command('Org: Select Primary Org', 'select-org', () => this.selectOrg('selectedOrg') , '', '/spo'),
        new Command('Org: Select Secondary Org (for Quick Diff)', 'select-org-2', () => this.selectOrg('selectedOrg2'), '', '/sso'),
        new Command('Org: Refresh Org Metadata', 'refresh-org-metadata', () => this.reloadOrgMetadata(), '', '/rog'),
        new Command('Org: Login Primary Org in Browser', 'login-primary-org', () => {if(this.isOrgSelected) this.openOrg(this.selectedOrg)}, '', '/lpo'),
        new Command('Org: Login Secondary Org in Browser', 'login-secondary-org', () => {if(this.isOrg2Selected) this.openOrg(this.selectedOrg2)}, '', '/lso'),
        new Command('Org: Login Active Tab Org in Browser', 'login-tab-org', () => this.openOrg(), '', '/lto'),
        new Command('Component: Select Component Type', 'select-entity-type', () => this.selectEntityType(), '', '/sct'),
        new Command('Component: Create New Component', 'create-new-component', () => this.createNewComponent(), '', '/new'),
        new Command('Code: Search in Codebase (Global Search)', 'global-search', () => this.globalSearch(), 'Ctrl+Shift+H', '/gsc'),
        new Command('Diff: Toggle Quick Diff Mode', 'toggle-quick-diff', () => this.quickDiffMode(), '' , '/qd'),
        new Command('Diff: Compare Current File with Org copy', 'compare-current-file-with-org', () => this.diffWithOrg(true), '', '/ccfo'),
        new Command('File: Quick Open File Universally', 'universal-quick-open-file', () => this.quickOpenFile(true), 'Ctrl+Shift+U', '/qo'),
        new Command('File: Open File from Bundle', 'open-file-from-bundle', () => this.openFileFromBundle(true), 'Ctrl+Shift+B', '/bo'),
        new Command('File: Deploy Current File', 'deploy-current-file', () => this.handleSave(), 'Ctrl+S', '/deploy'),
        new Command('File: Reload Current File from Org', 'reload-current-file', () => this.reloadEntity(true), '', '/rcf'),
        new Command('File: Open Files from Package.xml', 'open-bulk-package-xml', () => this.openFromPackageXml(), '', '/oxml'),
        new Command('Editor: Toggle Word Wrap', 'toggle-word-wrap', () => this.toggleWordWrap(), 'Alt+Z', '/ww'),
        new Command('Editor: Increase Font Size', 'increase-font-size', () => this.changeFontSize(true), '', '/ifs'),
        new Command('Editor: Decrease Font Size', 'decrease-font-size', () => this.changeFontSize(false), '', '/dfs'),
        new Command('Editor: Select Language Mode', 'select-language-mode', () => { this.selectLanguageMode(); }, '', '/lang'),
        new Command('Editor: Toggle Errors Panel', 'toggle-errors-pane', () => this.showErrorsPane(), '', '/err'),
        new Command('Editor: Zen Mode - Show/Hide Quick Actions', 'toggle-quick-actions', () => this.showQuickActions = !this.showQuickActions, '', '/zen'),
        new Command('Editor: Reload Theme Engine', 'reload-theme-engine', () => this.editorCmp.reloadThemeEngine()),
        new Command('Editor: Change Theme', 'change-editor-theme', () => this.changeEditorTheme()),
        new Command('Window: Launch EnForce in a Dedicated Window (Popup)', 'open-in-popup', () => this.openAsPopup()),
        new Command('Session: Save Editor Session', 'save-editor-session', () => this.saveEditorSession(false)),
    ];

    createNewComponent() {
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

        this.openCommandPalette('createNewComponent', {
            commands : this.entityTypeList_singular.map( (value : SelectOption) => <Command>{uniqueId : value.value, name : value.value, selectOption : value} ),
            placeholder: 'Select a type',
            emptyMessage: 'No types available',
            wildcardEnabled: true,
            commonAction: (cmd: any) => {
                this.createNewCode(cmd.selectOption);
            }
        }, true);
    }

    openFileFromBundle(nested?: boolean) {
        if(!this.activeTabModelId) return;
        if(this.activeTab?.entityType != CodeEntity.AuraComponent && this.activeTab?.entityType != CodeEntity.LWC) {
            // this.showSnackBar('This command is only available for Aura and LWC components');
            return;
        }
        if(this.activeTab?.bundleDetails?.contents?.length) {
            this.openCommandPalette('openFileFromBundle', {
                commands: this.activeTab.bundleDetails.contents.map((bundleItem: NormalizedBundleItem) => (<Command>{
                    name: bundleItem.label,
                    uniqueId: bundleItem.value,
                    bundleItem: bundleItem,
                    bundleDetails: this.activeTab?.bundleDetails
                })),
                placeholder: 'Select a file to open...',
                emptyMessage: 'No files in bundle',
                wildcardEnabled: true,
                commonAction: (cmd: any) => {
                    this.log('openFileFromBundle | commonAction | cmd = ', cmd);
                    this.clickBundleItem(cmd.bundleItem, cmd.bundleDetails);
                }
            }, nested);
        }
    }

    quickOpenFile(nested?: boolean) {
        if(!this.isOrgSelected) {
            this.showSnackBar('Please select an org first');
            return;
        }
        this.openCommandPalette('quickOpenFiles', {
            commands: this.allEntitiesList.map(selectOption => (<Command>{
                uniqueId: selectOption.value,
                name: selectOption.label,
                selectOption: selectOption,
                badge: selectOption.value1, //entity type
            })),
            placeholder: 'Select a file to load...',
            emptyMessage: 'No files open',
            wildcardEnabled: true,
            limitResults : true,
            maxResults: 100,
            searchInBadge: true,
            // debounce: true,
            commonAction: (cmd: any) => {
                this.log('quickOpenFile | commonAction | cmd = ', cmd);
                this.onEntitySelect(cmd.selectOption);
            }
        }, nested);
    }

    changeEditorTheme() {
        this.openCommandPalette('changeEditorTheme', {
            commands: this.editorCmp.getThemesList().map((theme: string) => (<Command>{
                uniqueId: theme,
                name: theme
            })),
            placeholder: 'Select a theme...',
            emptyMessage: 'No themes available',
            wildcardEnabled: true,
            commonAction: (cmd: Command) => {
                this.log('changeEditorTheme | commonAction | cmd = ', cmd);
                this.editorCmp.setTheme(cmd.name);
            }
        }, true);
    }

    selectEntityType() {
        this.openCommandPalette('selectEntityType', {
            commands: this.entityTypeList.map(entityType => (<Command>{
                uniqueId: entityType.label,
                name: entityType.label,
                action: () => this.onEntityTypeSelect(entityType.value)
            })),
            placeholder: 'Select an entity type...',
            emptyMessage: 'No entity types available',
            wildcardEnabled: true
        }, true);
    }

    selectOrg(orgProperty : string) {
        if(orgProperty == 'selectedOrg2' && !this.quickDiffModeFlag) {
            this.showSnackBar('Quick Diff Mode is not enabled. Please enable it to select second org.', null, 2000);
            return;
        }
        this.openCommandPalette('selectOrg', {
            commands: this.orgCredsList.map((org : OrgCredential) => new Command(org.orgName +'/'+org.username, org.orgName+'/'+org.username, () => this.onOrgSelect(org.orgName, orgProperty), org.authMode)),
            placeholder: 'Select an org...',
            emptyMessage: 'No orgs available',
            wildcardEnabled: true
        }, true);
    }

    selectLanguageMode() {
        this.openCommandPalette('selectLanguageMode',{
            commands: this.languageList.map(lang => ({
                name: lang.label,
                action: () => this.onLanguageSelect(lang)
            })),
            placeholder: 'Select a language mode...',
            emptyMessage: 'No languages available',
            wildcardEnabled: true,
        }, true);
    }

    openMainCommandPalette() {
        this.openCommandPalette('editorCommands',<CommandPaletteDialogData>{
            commands: this.commandPaletteCommands,
            commandFlag : true,
            wildcardEnabled: true,
            searchInShadowText: true,
            commonAction : (cmd : Command) => {
                if (cmd && cmd.uniqueId) {
                    const idx = this.commandPaletteCommands.findIndex(c => c.uniqueId === cmd.uniqueId);
                    if (idx > 0) {
                        const [found] = this.commandPaletteCommands.splice(idx, 1);
                        this.commandPaletteCommands.unshift(found);
                    }
                }
            }
        });
    }

    commandPaletteOpen : number = 0; 
    openCommandPalette(paletteName: string, options: CommandPaletteDialogData, nested?: boolean) {
        
        if(this.commandPaletteOpen > 0 && !nested)
            return; //prevent multiple open

        this.commandPaletteOpen++;
        
        if(!options) options = {};
        options.commands = options.commands || this.commandPaletteCommands;
        options.commandFlag = !!options.commandFlag; //force command flag to be boolean

        const dialogRef = this.dialog.open(CommandPaletteComponent, {
            data: options,
            panelClass: 'command-palette-container',
            autoFocus: false
        });
        dialogRef.afterClosed().subscribe((data) => {
            let cmd = data?.command;

            if (cmd) {
                if(cmd.action) cmd.action();
                if(data.commonAction) data.commonAction(cmd);
            }
            this.commandPaletteOpen--;
        });
    }

    //#endregion

    //#region Keyboard Shortcuts
    @HostListener('window:keydown', ['$event'])
    onGlobalKeyDown(event: KeyboardEvent) {
        if(!this.isComponentActive) return; //ignore if component is not active
        
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            if(!this.showSpinner) this.openMainCommandPalette();
        }
        else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'u') {
            event.preventDefault();
            this.quickOpenFile();
        }
        else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            this.openFileFromBundle(false);
        }
        else if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            if(!this.showSpinner) this.openCommandPalette('editorFiles',{
                commands: this.openTabs.map(tab => (<Command>{
                    uniqueId: tab.orgName + '::' + tab.tabValue,
                    name: tab.tabName,
                    tab : tab,
                    badge: tab.orgName,
                    shadowText: tab.entityType,
                    action: () => {
                        this.selectTab(tab);
                        this.editorCmp.focus();
                    }
                })),
                placeholder: 'Select a file...',
                emptyMessage: 'No files open',
                wildcardEnabled: true,
                searchInBadge: true,
                searchInShadowText: true
            });
        } else if(event.ctrlKey && !event.shiftKey &&  !event.altKey && event.key.toLowerCase() == 'b') {
            event.stopPropagation();
            event.preventDefault();
            this.toggleSidePanel(null);
        } else if(event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() == 'o') {
            this.typeahead.focus();
            event.preventDefault();
        } else if(event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() == 'q') {
            if(this.activeTab) this.onTabClose(this.activeTab);
            event.preventDefault();
        } else if(event.ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() == 'q') {
            if(this.activeTab) this.closeAllTabs(false);
            event.preventDefault();
        }
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

        //switch to previous tab
        if((evt.ctrlKey && evt.shiftKey && evt.key == 'Tab') || (evt.ctrlKey && !evt.shiftKey && evt.key == 'PageUp')
            || (evt.ctrlKey && !evt.shiftKey && evt.key == ',')) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            let newTabIndex = this.findPreviousTab(tabIndex);
            if(newTabIndex != null && newTabIndex != undefined && newTabIndex >= 0)
                this.selectTab(this.openTabs[newTabIndex]);
        }
        //switch to next tab
        else if((evt.ctrlKey && evt.key == 'Tab') || (evt.ctrlKey && !evt.shiftKey && evt.key == 'PageDown')
            || (evt.ctrlKey && !evt.shiftKey && evt.key == '.')
        ) {
            evt.stopPropagation();
            evt.preventDefault();
            let tabIndex = this.openTabs.findIndex(x => x.modelId == this.activeTabModelId);
            let newTabIndex = this.findNextTab(tabIndex);
            if(newTabIndex && newTabIndex < this.openTabs.length)
                this.selectTab(this.openTabs[newTabIndex]);
        }
        //move tab right
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
        //move tab left
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
        // else if(evt.ctrlKey && !evt.shiftKey &&  !evt.altKey && evt.key.toLowerCase() == 'p') {
        //     evt.preventDefault();
        //     this.typeahead.focus();
        // }
        else if(evt.ctrlKey && !evt.shiftKey &&  !evt.altKey && evt.key.toLowerCase() == 'w') {
            evt.preventDefault();
            if(this.activeTab != null)
                this.onTabClose(this.activeTab);
        }
        else if(evt.ctrlKey && !evt.shiftKey &&  !evt.altKey && evt.key.toLowerCase() == 's') {
            evt.preventDefault();
            this.handleSave();
        }
        else if(evt.altKey && !evt.shiftKey && !evt.ctrlKey && evt.key.toLowerCase() == 'z') {
            evt.stopPropagation();
            evt.preventDefault();
            this.toggleWordWrap();
        } else if(evt.ctrlKey && evt.shiftKey &&  !evt.altKey && evt.key.toLowerCase() == 'h') {
            evt.stopPropagation();
            evt.preventDefault();
            this.globalSearch();
        }
    }

    matchShortcut(set1 : Set<any>, lst : Array<any>) {
        return this.setEquals(set1, new Set(lst));
    }    

    setEquals(set1 : Set<any>, set2 : Set<any>) {
        return set1.size == set2.size && [...set1].every(x => set2.has(x));
    }
    // #endregion


    //#region Drag Drop
    tabDragStart(evt : any) {
        this.draggedTab = evt.target;
    }
    tabDragEnd(evt: any){
        this.draggedTab = undefined;
    }
    tabDragEnter(evt : any) {
        if(!this.draggedTab) return;
        evt.preventDefault();
        let tabElem = evt.target.closest('.tab');
        if(tabElem && tabElem != this.draggedTab)
            evt.target.setAttribute('data-drop-active', true);
    }
    tabDragLeave(evt : any) {
        evt.preventDefault();
        let tabElem = evt.target.closest('.tab');
        if(tabElem && tabElem != this.draggedTab)
            evt.target.setAttribute('data-drop-active', false);
        evt.preventDefault();
    }
    tabDrop(evt: any) {
        if(evt.target != this.draggedTab) {
            let sourceTabModelId = <string>(this.draggedTab!.dataset['tabModelid'] ?? -1);
            let destTabModelId = evt.target.dataset['tabModelid'];
            let sourceTabIdx = this.openTabs.findIndex(x => x.modelId == sourceTabModelId);
            let destTabIdx = this.openTabs.findIndex(x => x.modelId == destTabModelId);

            let temp = this.openTabs[destTabIdx];
            this.openTabs[destTabIdx] = this.openTabs[sourceTabIdx];
            this.openTabs[sourceTabIdx] = temp;
            evt.target.setAttribute('data-drop-active', false);
        }
    }
    tabDragOver(evt: any) {
        evt.preventDefault(); // This is required for drop to fire!
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

    //#region DIFF feature

    selectForCompare() {
        this.compareTab = this.tabForContextMenu;
    }

    createDiffTab(
        tab1: CodeTab | null,
        tab2: CodeTab,
        modelId1?: string,
        createInBackground: boolean = false
    ): CodeTab {
        //check for existing tab
        let diffTabName = this.getDiffTabValueString(tab1 || tab2, tab2);
        let diffTabOrg = this.getDiffOrgNameString(tab1, tab2);
        let diffEntityType = this.getDiffEntityType(tab1 || tab2, tab2);
        let diffMimeType = this.getDiffMimeType(tab1 || tab2, tab2);

        let existingDiffTab = this.openTabs.filter(
            x =>
                x.editorType == AppConstants.DIFF_EDITOR &&
                (x.tabValue == diffTabName || x.tabValue == this.diffReversal(diffTabName)) &&
                (x.orgName == diffTabOrg || x.orgName == this.diffReversal(diffTabOrg)) &&
                x.entityType == diffEntityType
        )[0];
        if (existingDiffTab) {
            existingDiffTab.hidden = false;
            if (!createInBackground) {
                this.activeTabModelId = existingDiffTab.modelId;
                this.editorCmp.switchModel(existingDiffTab.modelId);
            }
            return existingDiffTab;
        }

        //create diff model
        let diffModelId = this.editorCmp.createDiffEditorModel(
            tab1?.modelId || modelId1!,
            tab2.modelId!
        );

        //create diff tab
        let lang = this.getEntityLanguage(diffTabName, diffEntityType, diffMimeType);
        let icon = AppConstants.languageVsIcon[lang] || 'assets/log icon.png';

        let tab = new CodeTab(
            diffTabName,
            diffModelId,
            diffTabName,
            icon,
            diffTabOrg,
            AppConstants.DIFF_EDITOR,
            diffEntityType
        );
        tab.model1ForDiff = tab1?.modelId || modelId1!;
        tab.model2ForDiff = tab2.modelId;
        tab.unloadModel1 = !tab1 && !!modelId1;

        if(tab1?.entityType == CodeEntity.LWC || tab2.entityType == CodeEntity.LWC || tab1?.entityType == CodeEntity.AuraComponent || tab2.entityType == CodeEntity.AuraComponent) {
            // If either tab is a bundle, set the bundle name
            tab.bundleName = this.getDiffBundleName(tab1 || tab2, tab2);
        }

        if (tab1) tab1.diffTabModelIds.add(diffModelId);
        tab2.diffTabModelIds.add(diffModelId);
        this.addTab(tab);

        if (!createInBackground) {
            this.selectTab(tab);
        }

        return tab;
    }
    compareWithSelected() {
        let tab1 = this.compareTab!;
        let tab2 = this.tabForContextMenu!;

        this.createDiffTab(tab1, tab2);
    }

    diffReversal(value : string) {
        // Reverse the diff tab value string
        
        let parts = ( (value.startsWith('Diff : ')) ? value.substring(7) : value ).split(' <> ');
        if(parts.length == 2) {
            return `Diff : ${parts[1]} <> ${parts[0]}`;
        }
        
        return value;
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
    getDiffBundleName(tab1 : CodeTab, tab2 : CodeTab) {
        if(tab1.codeEntity?.BundleName == tab2.codeEntity?.BundleName) return `${tab1.codeEntity?.BundleName}`;
        return `${tab1.codeEntity?.BundleName} <> ${tab2.codeEntity?.BundleName}`;
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
    //#endregion

    reloadEntity(useActiveTab? : boolean){
        let tab : CodeTab | null | undefined = this.tabForContextMenu;
        if(useActiveTab) tab = this.activeTab;
        if(!tab || tab.temporary) {
            if(useActiveTab)
                this.showSnackBar('No valid tab active to reload');
            return;
        }
        this.loadEntity(tab.tabValue, tab, tab.entityType, tab.orgName, tab.codeEntity!);
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

    //#region Save/Deploy code
    handleSave() {
        let tab : CodeTab | null | undefined = this.activeTab;
        if(!tab || tab.temporary) {
            this.showSnackBar('No valid tab selected');
            return;
        }
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

    // #endregion

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

    async openOrg(orgName? : string) {
        if(!orgName && !this.activeTab?.orgName) return;
        try {
            let url = (await this._ipc.callMethod('getOrgLoginUrl', orgName || this.activeTab?.orgName));
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
                            newCodeEntities.push(new NormalizedCodeEntity(deployResponse.data?.id, name, entity.value, null, null, sfApiVersion, null, orgToDeploy, dropdownSelection?.value));
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
                            newCodeEntities = fileNames.map((x: any) => new NormalizedCodeEntity('', x, entity.value, null, bundleName, sfApiVersion, null, orgToDeploy));
                            this.entityTypeVsList[entity.value].push(...(newCodeEntities));
                            entityToLoad = fileNames[0];
                        } else if(entity.value == CodeEntity.LWC) {
                            let bundleName = name;
                            let fileNames = payload.bundle.map((x : any) => x.filePath);
                            console.log('^^^^ ' + fileNames);
                            newCodeEntities = fileNames.map((x: any) => new NormalizedCodeEntity('', x, entity.value, null, bundleName, sfApiVersion, null, orgToDeploy));
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

    // #region Side Panel

    sidePanelDisplay = true;
    @ViewChild('sidePanelElement') sidePanelElement : ElementRef | undefined;
    @ViewChild('rootElement') rootElement : ElementRef | undefined;
    toggleSidePanel(evt : any) {
        this.sidePanelDisplay = !this.sidePanelDisplay;
        this.changeDetectorRef.detectChanges();
        this.panelSizeRecompute();
    }

    @ViewChild('sidePanelToggleElement') sidePanelToggleElement! : ElementRef;
    panelSizeRecompute() {
        if(this.sidePanelDisplay) {
            this.panelToggleWidth = `4px`;
            this.sidePanelElement!.nativeElement.style.width = this.panelWidth;
            this.rootElement!.nativeElement.style.width = this.widthExcludingPanel;
        } else {
            this.panelToggleWidth = `1px`;
            this.rootElement!.nativeElement.style.width = `calc(100% - 0px - ${this.panelToggleWidth})`;
            this.sidePanelElement!.nativeElement.style.width = '0px';
        }
        this.sidePanelToggleElement!.nativeElement.style.width = this.panelToggleWidth;
    }

    panelToggleWidth = `4px`;
    panelResizingFlag = false;
    panelWidth = 'max(15%, 200px)';
    widthExcludingPanel = `calc(100% - ${this.panelWidth} - ${this.panelToggleWidth})`;

    panelResizingStart(evt : MouseEvent) {
        document.body.style.cursor = 'ew-resize';
        this.panelResizingFlag = true;
        evt.preventDefault();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if(this.panelResizingFlag) {
            this.panelSizing(event);
        }  
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        if(this.panelResizingFlag) {
            this.panelResizingFlag = false;
            document.body.style.cursor = '';
        }
    }
    
    panelSizing(event: MouseEvent) {
        // if(this.sidePanelDisplay) {
        //     this.sidePanelElement!.nativeElement.style.width = 'max(15%, 200px)';
        //     this.rootElement!.nativeElement.style.width = 'calc(100% - max(15%, 200px) - 12px)';
        // } else {
        //     this.rootElement!.nativeElement.style.width = 'calc(100% - 0px - 12px)';
        //     this.sidePanelElement!.nativeElement.style.width = '0px';
        // }
        if(!this.sidePanelDisplay) this.sidePanelDisplay = true;
        this.changeDetectorRef.detectChanges();
        
        let posX = event.clientX - this.sidePanelElement!.nativeElement.getBoundingClientRect().left;
        posX -= 4; //6px for the resize handle width
        this.panelWidth = `max(15%, min(${posX}px , 50%))`;
        this.widthExcludingPanel = `calc(100% - ${this.panelWidth} - ${this.panelToggleWidth})`

        this.sidePanelElement!.nativeElement.style.width = this.panelWidth;
        this.rootElement!.nativeElement.style.width = this.widthExcludingPanel;
        console.log('## RESIZED ' + this.panelWidth);
    }

    @HostListener('window:resize', ['$event'])
    onResize(event : any) {
        // this.panelSizeRecompute();
    }

    //#endregion

    async dummyButton() {
        this.showSnackBar('adsf');
        this.showSnackBar('zxcv');
        if(this.selectedOrg != this.orgCredsList.at(-1)?.orgName) {
            await this.onOrgSelect(this.orgCredsList.at(-1)?.orgName, 'selectedOrg');
            await this.onEntityTypeSelect(this.entityTypeList[1].value);
        }
        // // Pick first 10 entities from the current entityList
        // const entitiesToLoad = this.entityList.slice(0, 10)
        //     .map((entity: any) => this.entityIdVsObjectMap[this.selectedOrg + ':' + entity.value])
        //     .filter((e: any) => !!e);
        // if (entitiesToLoad.length > 0) {
        //     await this.loadEntityBulk(entitiesToLoad, this.selectedOrg);
        // } else {
        //     this.showSnackBar('No entities found to load.');
        // }

        // let res = await this._ipc.callMethod('codeGlobalSearch', {
        //     orgName : this.selectedOrg, searchText : 'asdf'
        // });
        // console.log('dummyButton | codeGlobalSearch | res = ' , res);

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
                new NormalizedCodeEntity(bundleItem.id!, bundleItem.value!, bundleDetails.entityType, bundleDetails.bundleId, bundleDetails.bundleName, bundleDetails.apiVersion, bundleDetails.namespacePrefix, this.activeTab!.orgName));
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
        this.log('handleAccordion | evt = ' , evt);

        let target = evt.target;
        if(!(target instanceof HTMLElement)) return;

        let element : HTMLElement | null = target.closest('div.customAccordion-header');
        if(!element) return;

        if(target.id == 'openEditorsDropdown') return;
        if(target.className.includes('dropdown-item')) return;


        let t_id = element!.dataset['toggleContent'];
        let collapsed = element!.dataset['toggleCollapsed']=='true' || false;
        let toggleContent : HTMLElement | null = document.querySelector(`[data-toggle-id=${t_id}]`);
        if(!toggleContent) return;

        if(collapsed) {
            toggleContent.style.display = 'block';
        } else {
            toggleContent.style.display = 'none';
        }
        collapsed = !collapsed;

        element.dataset['toggleCollapsed'] = '' + collapsed;
        // toggleContent.dataset['toggleCollapsed'] = '' + collapsed;
    }

    reloadingBundleDetails : boolean = false
    async loadBundleDetails(codeTabs : CodeTab[], entityType : string, reload : boolean, orgName : string) {
        // let orgName = this.selectedOrg;
        if(this.reloadingBundleDetails) return;

        this.reloadingBundleDetails = reload;
        this._ipc.callMethod('getBundleDetails', {
            orgName : orgName,
            bundleName : Array.from(new Set(codeTabs.map((x:CodeTab) => x.bundleName))),
            entityType : entityType,
            ignoreCache : reload
        }).then( (x:EnForceResponse) => {
            this.reloadingBundleDetails = false;
            if(x.isSuccess) {
                this.log('loadEntity | getBundleDetails | Success = ' , x);
                for(let codeTab of codeTabs) {
                    if(codeTab.bundleName && x.data[codeTab.bundleName]) {
                        codeTab.bundleDetails = x.data[codeTab.bundleName];
                    }
                }
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
        this.saveEditorSession(true);
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

    async diffWithOrg(useActiveTab? : boolean) {
        try {
            this.showSpinner = true;
            // if(!this.tabForContextMenu) return;
            let tab : CodeTab | null | undefined = this.tabForContextMenu;
            if(useActiveTab) tab = this.activeTab;
            if(!tab || tab.temporary) {
                if(useActiveTab) {
                    this.showSnackBar('No valid tab selected');
                }
                return;
            }
            
            //fetch code from org
            let name = tab.codeEntity!.Name;
            let response : any = await this.fetchCode([tab.codeEntity!], [tab.orgName]);
            let lang = this.getEntityLanguage(name, tab.entityType, tab.codeEntity!.mimeType);
    
            response = <EnForceResponse>(response[tab.orgName][tab.entityType]);

            //validate response
            if(!response.isSuccess) {
                this.showSnackBar('ERROR : ' + response.errors[0].message);
                return;
            } else if(!response.data['count']) {
                this.showSnackBar('Not Found : ' + name);
                return;
            }


            //success response. proceed to create tabs
            let code = response.data.contents[0][name];
            let recordId = response.data.contents[0].Id;

            //create model
            let modelId = this.editorCmp.createCodeEditorModel(code, lang);

            this.createDiffTab(null, tab, modelId);

        } catch(err) {
            console.error(err);
        } finally {
            this.showSpinner = false;
        }

    }

    globalSearchModalState : any = {};
    globalSearch() {
        if(!this.isOrgSelected) {
            this.showSnackBar('Please select an org first');
            return;
        }
        let dialogRef = this.dialog.open(CodeGlobalSearchComponent, {
            data : {
                orgName : this.selectedOrg,
                state : this.globalSearchModalState
            }
        });

        // Listen for double-click row event
        // const sub = dialogRef.componentInstance.rowDoubleClicked.subscribe(async (row: any) => {
        //     if(row && row.NormalizedCodeEntity) {
        //         dialogRef.close();
        //         let tab : CodeTab | null | undefined = await this.loadEntity(row.Name, null, row.Type, this.selectedOrg, row.NormalizedCodeEntity);
        //         if(tab) {
        //             setTimeout(() => this.editorCmp.moveToLineCol(parseInt(row.LineNo), 1), 100);
        //         }
        //     }
        // });

        dialogRef.afterClosed().subscribe(async (result: any) => {
            this.globalSearchModalState = result;
            let row = result.row;
            if(row && row.NormalizedCodeEntity) {
                let tab : CodeTab | null | undefined = await this.loadEntity(row.Name, null, row.Type, this.selectedOrg, row.NormalizedCodeEntity);
                if(tab) {
                    setTimeout(() => this.editorCmp.moveToLineCol(parseInt(row.LineNo), 1), 100);
                }
            }
            // sub.unsubscribe();
            // Optionally handle after close
        });
    }

    treeViewMode = true;
    toggleTreeViewMode(event : any) {
        this.treeViewMode = !this.treeViewMode;
    }

    async closeAllTabs(keepCurrentTab : boolean) {
        const tabsToClose = keepCurrentTab
            ? this.openTabs.filter(tab => tab !== this.activeTab && !tab.temporary)
            : this.openTabs.filter(tab => !tab.temporary);

        if (tabsToClose.length === 0) {
            // this.showSnackBar('No tabs to close');
            return;
        }

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: {
                text: `Are you sure you want to close ${tabsToClose.length} tab(s)?${keepCurrentTab ? ' (Current tab will be kept open)' : ''}`
            }
        });

        let result = await firstValueFrom(dialogRef.afterClosed());
        if (result) {
            // Copy array to avoid mutation issues during iteration
            for(let tab of [...tabsToClose].sort((x: CodeTab, y: CodeTab) => {
                if (x.editorType === AppConstants.CODE_EDITOR && y.editorType !== AppConstants.CODE_EDITOR) return 1;   //diff tab close first
                if (x.editorType !== AppConstants.CODE_EDITOR && y.editorType === AppConstants.CODE_EDITOR) return -1;  //editor tab close later
                // If both are same type, keep original order
                return 0;
            })) {
                await this.onTabClose(tab);
            }
        }
    }

    expanded : boolean = true;
    @ViewChild('treeView') treeView! : AppTreeViewComponent;
    expandCollapseAll() {
        this.expanded = !this.expanded;
        if(this.expanded) this.treeView.collapseAllNodes();
        else this.treeView.expandAllNodes();
    }

    showHiddenTabsSidePanel : boolean = true;
    toggleHiddenTabsTreeView() {
        this.showHiddenTabsSidePanel = !this.showHiddenTabsSidePanel;
    }

    //#region Editor Session Save

    private saveEditorSessionDebounceTimer: any = null;
    /**
     * Saves the editor session, with optional debounce.
     * @param debounce If true, debounce the save by 500ms. If false, save immediately.
     */
    saveEditorSession(silent: boolean, debounce: boolean = true) {
        if (debounce) {
            if (this.saveEditorSessionDebounceTimer) {
                clearTimeout(this.saveEditorSessionDebounceTimer);
            }
            this.saveEditorSessionDebounceTimer = setTimeout(() => {
                this.log('saveEditorSession | Saving editor session (debounced)');
                this.saveEditorSessionImmediate(silent);
            }, 500);
        } else {
            this.saveEditorSessionImmediate(silent);
        }
    }
    
    /**
     * Saves the editor session immediately.
     */
    async saveEditorSessionImmediate(silent: boolean) {
        this.log('saveEditorSession | Saving editor session (immediate)');
        // Only proceed if openTabs is not empty and at least one tab is not temporary
        if (!this.openTabs.length || !this.openTabs.some(tab => !tab.temporary)) {
            if(!silent) this.showSnackBar('No open tabs to save in session', null, 2000, 'top');
            return;
        }
        let response = await this._ipc.callMethod('saveEditorSession', <EditorSession>{
            openTabs: JSON.parse(JSON.stringify(this.openTabs.filter(x => !x.temporary && !x.unloadModel1))),
            activeTabModelId: this.activeTabModelId,
            selectedOrg: this.selectedOrg,
            selectedEntityType: this.selectedEntityType,
            // selectedOrg2: this.selectedOrg2
        });
        if (response.isSuccess) {
            if(!silent) this.showSnackBar('Editor session saved successfully', null, 2000, 'top');
        } else {
            if(!silent) this.showSnackBar('Error saving editor session: ' + response.errors[0].message, null, 5000, 'top');
        }
    }

    /**
     * Clears the saved editor session by sending empty data to the IPC method.
     */
    async clearEditorSession() {
        this.log('clearEditorSession | Clearing saved editor session');
        let response = await this._ipc.callMethod('saveEditorSession', <EditorSession>{
            openTabs: [],
            activeTabModelId: null,
            selectedOrg: '',
            selectedEntityType: ''
        });
        if (response.isSuccess) {
            this.log('Editor session cleared successfully');
        } else {
            this.log('Error clearing editor session: ' + response.errors[0]?.message);
        }
    }

    async loadEditorSession() {
        try{
            let response : EnForceResponse = await this._ipc.callMethod('loadEditorSession');
            if(response.isSuccess && response.data) {
                const session: EditorSession = response.data;
                const dialogRef = this.dialog.open(PromptDialogComponent, {
                    data: {
                        text: 'Restore previous session?',
                        label: 'Restore Session',
                        isTableRequired: true,
                        tableData: {
                            columns: [
                                { key: '#', label: '#' },
                                { key: 'Name', label: 'Name' },
                                { key: 'Org', label: 'Org' },
                                { key: 'Type', label: 'Type' },
                                { key: 'Hidden/Pinned', label: 'Hidden/Pinned' }
                            ],
                            rows: (session.openTabs || []).filter(t => !t.unloadModel1).map((tab: CodeTab, idx: number) => ({
                                '#': idx + 1,
                                Name: tab.tabName,
                                Org: tab.orgName,
                                Type: tab.entityType,
                                "Hidden/Pinned": [
                                    tab.hidden ? 'Hidden' : '',
                                    tab.pinned ? 'Pinned' : ''
                                ].filter(Boolean).join(' , ')
                            }))
                        },
                        isTextFieldRequired: false,
                        isTextAreaRequired: false,
                        okButtonText: 'Restore',
                        cancelButtonText: 'Skip'
                    },
                    disableClose: true // Make modal non-dismissable except via buttons
                });
                const result = await firstValueFrom(dialogRef.afterClosed());

                
                if (result) {
                    // Restore session

                    this.showSpinner = true;

                    this.closeDefaultTemporaryTab();

                    const oldModelIdMap: { [key: string]: string } = {};
                    const groupedTabs: { [org: string]: CodeTab[] } = {};

                    for (const tab of session.openTabs || []) {
                        // Group tabs by org only
                        if (!groupedTabs[tab.orgName]) groupedTabs[tab.orgName] = [];
                        groupedTabs[tab.orgName].push(tab);

                        // Build the map: orgName + entityType + entityName => modelId
                        const key = `${tab.orgName}::${tab.entityType}::${tab.tabValue}`;
                        oldModelIdMap[key] = tab.modelId;
                    }

                    
                    
                    /* load tab for each org using loadEntityBulk method */
                    this.log('Grouped tabs: ', groupedTabs);
                    this.log('oldModelIdMap: ', oldModelIdMap);
                    for(let org of Object.keys(groupedTabs)) {
                        const tabs = groupedTabs[org].filter(x => x.editorType == AppConstants.CODE_EDITOR);
                        if(tabs.length > 0) {
                            const codeEntities: NormalizedCodeEntity[] = tabs.map(tab => tab.codeEntity).filter(ce => !!ce) as NormalizedCodeEntity[];
                            if (codeEntities.length > 0) {
                                let loadedTabs = await this.loadEntityBulk(codeEntities, [org], true, false, true);
                            }                            
                        }
                    }

                    /* CREATE DIFF TABS from previous session */
                    for (const diffTab of (session.openTabs || []).filter(tab => tab.editorType === AppConstants.DIFF_EDITOR && !tab.unloadModel1)) {
                        // Find the corresponding tabs for model1ForDiff and model2ForDiff
                        const oldTab1 = session.openTabs.find(t => t.modelId === diffTab.model1ForDiff);
                        const oldTab2 = session.openTabs.find(t => t.modelId === diffTab.model2ForDiff);
                        
                        if(oldTab1 && oldTab2) {
                            let tab1 = this.openTabs.find(
                                t => t.orgName === oldTab1.orgName && t.entityType === oldTab1.entityType && t.tabValue === oldTab1.tabValue && t.editorType === AppConstants.CODE_EDITOR
                            );
                            let tab2 = this.openTabs.find(
                                t => t.orgName === oldTab2.orgName && t.entityType === oldTab2.entityType && t.tabValue === oldTab2.tabValue && t.editorType === AppConstants.CODE_EDITOR
                            );
                            if(tab1 && tab2)
                                this.createDiffTab(tab1, tab2, undefined, true);
                        }
                    }


                    /* select tab from previous session */
                    if (session.activeTabModelId) {
                        // Find the key in oldModelIdMap whose value matches session.activeTabModelId
                        const key = Object.keys(oldModelIdMap).find(k => oldModelIdMap[k] === session.activeTabModelId);
                        if (key) {
                            // Find the tab in openTabs whose orgName, entityType, and tabValue match the key
                            const [orgName, entityType, tabValue] = key.split('::');
                            let tab : any = this.openTabs.find(
                                t => t.orgName === orgName && t.entityType === entityType && t.tabValue === tabValue
                            );
                            tab = tab || this.openTabs[0];
                            if(tab) this.selectTab(tab); // Select the found tab or the first tab if not found
                        }
                    } else if(this.openTabs.length){
                        this.selectTab(this.openTabs[0]);
                    }

                    /* Reorder this.openTabs to match the order in session.openTabs */
                    const reorderedTabs: CodeTab[] = [];
                    for (const oldTab of session.openTabs || []) {
                        // Find the corresponding tab in this.openTabs by orgName, entityType, and tabValue
                        const tab = this.openTabs.find(
                            t =>
                                t.orgName === oldTab.orgName &&
                                t.entityType === oldTab.entityType &&
                                t.tabValue === oldTab.tabValue &&
                                t.editorType === oldTab.editorType
                        );
                        if (tab) {
                            tab.pinned = oldTab.pinned; // Restore pinned state
                            tab.hidden = oldTab.hidden; // Restore hidden state
                            reorderedTabs.push(tab);
                        }
                    }
                    // Add any tabs that were not in the session (shouldn't happen, but just in case)
                    for (const tab of this.openTabs) {
                        if (!reorderedTabs.includes(tab)) {
                            reorderedTabs.push(tab);
                        }
                    }

                    //set tabs list and run change detection
                    this.openTabs = reorderedTabs;
                    this.changeDetectorRef.detectChanges();
                    
                    //! Pending...TODO multiple orgs
                    // Sol #1 = validate orgs using username from local storage (SOAP Login) and don't load if org auth config is modified.
                    // What about rest of the auth modes - AccessToken and ConnectedApp and OAuth ?
                    // Sol #2 - refresh NormalizedCodeEntity with every fetchCode call - even if Org auth config modified
                    // it will still load the code and the NCE will be updated with latest org details. no need for org auth config modification check
                    // FetchClassCmpList also not required for this - FASTER
                    // Sol #3 - load class cmp list for each org and choose right NCE objects and then perform loadEntityBulk
                    // Problem - thrashing due to limited class cmp list in cache , too much time to load class cmp list for each org
                    // Sol #4 - fetch specific NCE , NBD from org at once - QUICK - and then can use the latest NCE NBD object


                    /**
                     * group tabs by org and entity type
                     * validate Org - if orgs specified in session are not present in orgCredsMap, then show error and load only for valid orgs
                     * make a map of Orgname+entityType+entityName to old model Id
                     * open tabs one by one for each org using loadEntityBulk method - DO NOT CONSIDER DIFF TABS MVP1 
                     * rearrange tabs as per old positioning using the prepared map
                     * pin/hide tabs as per session.openTabs
                     * set activeTabModelId based on session.activeTabModelId
                     */

                    //Start with org selection
                    this.log('loadEditorSession | session.selectedOrg = ' + session.selectedOrg);
                    if(session.selectedOrg && this.orgCredsMap.has(session.selectedOrg)) {
                        await this.onOrgSelect(session.selectedOrg, 'selectedOrg');
                        // dontTouchSpinner = true;
                        // setTimeout( () => {
                        // }, 10);
                    }

                }
            }

            //clear saved session if everything was success
            // await this.clearEditorSession();
        } catch(err) {
            console.error('Error loading editor sessions: ', err);
            this.showSnackBar('Error loading editor sessions: ' + (err as any).message, null, 5000, 'top');
        } finally {
            // if(dontTouchSpinner) 
            this.showSpinner = false;
        }
    }

    //#endregion
    
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