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
    static defTypeVsLanguage : any = {
        'COMPONENT' : 'xml',
        'APPLICATION' : 'xml',
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

    static defaultCode : any = {
        'ApexClass' : `
public class {componentName} {
    public {componentName}() {
        // Constructor
    }
    
    // Add methods and logic here
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


        'VFComponent':`<apex:component>\n\t<h1>Hello, World!</h1>\n</apex:component>`
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