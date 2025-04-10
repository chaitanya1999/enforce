export class AppConstants {
    static CODE_EDITOR : string = 'code-editor';
    static DIFF_EDITOR : string = 'diff-editor';
    static aura_suffixVsDefTypes : any = {
        '.cmp' : 'COMPONENT',
        'Controller.js' : 'CONTROLLER',
        'Helper.js' : 'HELPER',
        '.css' : 'STYLE',
        'Renderer.js' : 'RENDERER',
        '.evt' : 'EVENT',
        '.auradoc' : 'DOCUMENTATION',
        '.design' : 'DESIGN',
        '.svg' : 'SVG'
    };
    static defTypeVsLanguage : any = {
        'COMPONENT' : 'xml',
        'CONTROLLER' : 'javascript',
        'HELPER' : 'javascript',
        'STYLE' : 'css',
        'RENDERER' : 'javascript',
        'EVENT' : 'xml',
        'DOCUMENTATION' :  'xml',
        'DESIGN' : 'xml',
        'SVG' : 'svg'
    };

    static entityTypeVsName : any = {
        'ApexClass' : 'Apex Class',
        'AuraComponent' : 'Aura Components',
        'LWC' : 'Lightning Web Components',
        'VFPage' : 'Visualforce Pages',
        'VFComponent' : 'Visualforce Components',
    }
    static entityTypeVsName_singular  : any = {
        'ApexClass' : 'Apex Class',
        'AuraComponent' : 'Aura Component',
        'LWC' : 'Lightning Web Component',
        'VFPage' : 'Visualforce Page',
        'VFComponent' : 'Visualforce Component',
    }

    static sleep(ms : number) : Promise<void> {
        return new Promise((res) => setTimeout(res, ms));
    }
}

export enum CodeEntity { 
    ApexClass = 'ApexClass',
    AuraComponent = 'AuraComponent',
    LWC = 'LWC',
    VFPage = 'VFPage',
    VFComponent = 'VFComponent',
    CustomLabels = 'CustomLabels',
    Objects = 'Objects',
    ObjectRecords = 'ObjectRecords',
    FieldSets = 'FieldSets',
    StaticResource = 'StaticResource',
    EmailTemplate = 'EmailTemplate'
}