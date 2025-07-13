import { AppConstants, CodeEntity } from "./AppConstants";
import { NormalizedCodeEntity, NormalizedBundleDetails } from "./enforce-utils";

export class CodeTab {
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