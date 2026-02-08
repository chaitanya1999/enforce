export enum CodeEntity { 
    ApexClass = 'ApexClass',
    ApexTrigger = 'ApexTrigger',
    AuraComponent = 'AuraComponent',
    LWC = 'LWC',
    VFPage = 'VFPage',
    VFComponent = 'VFComponent',
    // CustomLabels = 'CustomLabels',
    // Objects = 'Objects',
    // ObjectRecords = 'ObjectRecords',
    // FieldSets = 'FieldSets',
    StaticResource = 'StaticResource',
    // EmailTemplate = 'EmailTemplate'
}

export class AppConstants {
    static CODE_EDITOR : string = 'code-editor';
    static DIFF_EDITOR : string = 'diff-editor';
    static aura_suffixVsDefTypes : any = {
        '.cmp' : 'COMPONENT',
        '.app' : 'APPLICATION',
        'Controller.js' : 'CONTROLLER',
        'Helper.js' : 'HELPER',
        '.css' : 'STYLE',
        'Renderer.js' : 'RENDERER',
        '.evt' : 'EVENT',
        '.auradoc' : 'DOCUMENTATION',
        '.design' : 'DESIGN',
        '.svg' : 'SVG'
    };
    static aura_defTypeVsSuffix : any = {
        'COMPONENT' : '.cmp',
        'APPLICATION' : '.app',
        'CONTROLLER' : 'Controller.js',
        'HELPER' : 'Helper.js',
        'STYLE' : '.css',
        'RENDERER' : 'Renderer.js',
        'EVENT' : '.evt',
        'DOCUMENTATION' : '.auradoc',
        'DESIGN' : '.design',
        'SVG' : '.svg'
    };
    static aura_defTypeVsSortOrder : any = {
        'COMPONENT' : 1,
        'APPLICATION' : 1,
        'CONTROLLER' : 2,
        'HELPER' : 3,
        'STYLE' : 4,
        'RENDERER' : 5,
        'EVENT' : 6,
        'DOCUMENTATION' : 7,
        'DESIGN' : 8,
        'SVG' : 9
    };
    static lwc_typeVsSortOrder : any = {
        'html' : 1,
        'js' : 2,
        'css' : 3,
        'js-meta.xml' : 4
    };
    static defTypeVsLanguage : any = {
        'COMPONENT' : 'html',
        'APPLICATION' : 'html',
        'CONTROLLER' : 'javascript',
        'HELPER' : 'javascript',
        'STYLE' : 'css',
        'RENDERER' : 'javascript',
        'EVENT' : 'html',
        'DOCUMENTATION' :  'html',
        'DESIGN' : 'html',
        'SVG' : 'svg'
    };
    static aura_suffixVsLanguage : any = {
        '.cmp' : 'html',
        '.app' : 'html',
        'Controller.js' : 'javascript',
        'Helper.js' : 'javascript',
        '.css' : 'css',
        'Renderer.js' : 'javascript',
        '.evt' : 'html',
        '.auradoc' : 'html',
        '.design' : 'html',
        '.svg' : 'xml'
    }

    static lwcSuffixVsLanguage : any = {
        'js' : 'javascript',
        'html' : 'html',
        'css' : 'css',
        'xml' : 'xml'
    }

    static entityTypeVsSuffix : any = {
        [CodeEntity.ApexClass] : '.cls',
        [CodeEntity.ApexTrigger] : '.trigger',
        [CodeEntity.VFPage] : '.page',
        [CodeEntity.VFComponent] : '.component',
    }

    static entityTypeVsName : any = {
        'ApexClass' : 'Apex Class',
        'ApexTrigger' : 'Apex Trigger',
        'AuraComponent' : 'Aura Components',
        'LWC' : 'Lightning Web Components',
        'VFPage' : 'Visualforce Pages',
        'VFComponent' : 'Visualforce Components',
        'StaticResource' : 'Static Resources',
    }
    static entityTypeVsName_singular  : any = {
        'ApexClass' : 'Apex Class',
        'ApexTrigger' : 'Apex Trigger',
        'AuraComponent' : 'Aura Component',
        'LWC' : 'Lightning Web Component',
        'VFPage' : 'Visualforce Page',
        'VFComponent' : 'Visualforce Component',
        'StaticResource' : 'Static Resource',
    }

    static packageXmlEntityTypeToEnforceType : any = {
        'ApexClass' : CodeEntity.ApexClass,
        'ApexTrigger' : CodeEntity.ApexTrigger,
        'AuraDefinitionBundle' : CodeEntity.AuraComponent,
        'LightningComponentBundle' : CodeEntity.LWC,
        'StaticResource' : CodeEntity.StaticResource,
        'ApexPage' : CodeEntity.VFPage,
        'ApexComponent' : CodeEntity.VFComponent,
    }
    static enforceEntityTypeToPackageXmlType : any = {
        [CodeEntity.ApexClass] : 'ApexClass',
        [CodeEntity.ApexTrigger] : 'ApexTrigger',
        [CodeEntity.AuraComponent] : 'AuraDefinitionBundle',
        [CodeEntity.LWC] : 'LightningComponentBundle',
        [CodeEntity.StaticResource] : 'StaticResource',
        [CodeEntity.VFPage] : 'ApexPage',
        [CodeEntity.VFComponent] : 'ApexComponent'
    }

    static defaultCode : any = {
        'ApexClass' : `
public class {componentName} {
    public {componentName}() {
        // Constructor
    }
    
    // Add methods and logic here
}`,

        'ApexTrigger' : `trigger {componentName} on {sobjectName} (before insert, after insert, before update, after update) {
	System.debug('Hello Trigger !');
}`,


        'AuraComponent' : [
            {
                "Source" : `<aura:component>\n<!-- Add your markup here -->\n\tHello, World!\n</aura:component>`,
                "defType" : 'COMPONENT',
                "format": "XML"
            }, {
                "Source" : `({\n\tcontrollerFn : function(component, event, helper) {\n\t\t\n\t}\n})`,
                "defType" : 'CONTROLLER',
                "format": "JS"
                
            }, {
                "Source" : `({\n\thelperFn : function(component, event, helper) {\n\t\t\n\t}\n})`,
                "defType" : 'HELPER',
                "format": "JS"
                
            }, {
                "Source" : `.THIS {\n}`,
                "defType" : 'STYLE',
                "format": "CSS"
            }
        ],


        'LWC' : [
            {
                "Source" : `import { LightningElement } from 'lwc';\nexport default class {componentName} extends LightningElement {\n\t// JS logic here\n}`,
                "format": "js",
                "filePath": "lwc/{componentName}/{componentName}.js"
            },
            {
                "Source" : `<template>\n\tHello, World!\n</template>`,
                "format": "html",
                "filePath": "lwc/{componentName}/{componentName}.html",
            },
            {
                "Source" : `<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n\t<apiVersion>{apiVersion}</apiVersion>\n\t<isExposed>false</isExposed>\n</LightningComponentBundle>`,
                "format": "js",
                "filePath": "lwc/{componentName}/{componentName}.js-meta.xml"    
            },
            {
                "Source" : `div{}`,
                "format": "css",
                "filePath": "lwc/{componentName}/{componentName}.css"
            }
        ],

        'VFPage':`\n<apex:page>\n\t<h1>Hello, World!</h1>\n</apex:page>`,


        'VFComponent':`<apex:component>\n\t<h1>Hello, World!</h1>\n</apex:component>`,

        'StaticResource': {
            'application/javascript' : `function helloWorld(){\n\tconsole.log\n}`,
            'text/javascript' : `function helloWorld(){\n\tconsole.log\n}`,
            'application/xml' : ``,
            'text/xml' : ``,
            'text/css' : `div {\n\tborder: 1px solid black;\n}`,
            'text/plain' : `Hello World !`,
        }
    }

    static staticResMimeTypes = ['application/javascript', 'text/javascript', 'application/xml', 'text/xml', 'text/css', 'text/plain'];
    static staticResExtension : any = {
        'application/javascript' : 'js',
        'text/javascript' : 'js',
        'application/xml' : 'xml',
        'text/xml' : 'xml',
        'text/css' : 'css',
        'text/plain' : 'txt'
    }
    static staticResMimeVsLanguage : any = {
        'application/javascript' : 'javascript',
        'text/javascript' : 'javascript',
        'application/xml' : 'xml',
        'text/xml' : 'xml',
        'text/css' : 'css',
        'text/plain' : 'text'
    }
    
    static languageVsIcon : any = {
        'javascript' : 'assets/js.png',
        'apex' : 'assets/cloudIcon.png',
        'html' : 'assets/html_icon.png',
        'visualforce' : 'assets/html_icon.png',
        'xml' : 'assets/html_icon.png',
        'css' : 'assets/cssIcon_2.png',
        'text' : 'assets/log icon.png'
    }

    static sleep(ms : number) : Promise<void> {
        return new Promise((res) => setTimeout(res, ms));
    }
}