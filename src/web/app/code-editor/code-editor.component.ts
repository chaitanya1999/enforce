import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, Output, ViewChild, model } from '@angular/core';
import { EditorConfigService } from '../editor-config.service';
import { AppConstants } from '../AppConstants';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki'
// import { loadWASM } from 'onigasm' // peer dependency of 'monaco-textmate'
// import { Registry } from 'monaco-textmate' // peer dependency
// import { wireTmGrammars } from 'monaco-editor-textmate'
import { IpcService } from '../../ipc.service';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { GlobalEventsService } from '../global-events.service';



@Component({
    selector: 'app-code-editor',
    standalone: true,
    imports: [],
    templateUrl: './code-editor.component.html',
    styleUrl: './code-editor.component.css'
})


export class CodeEditorComponent implements AfterViewInit, OnChanges {
    // loadedMonaco = false;
    // static loadedMonacoGlobal = false;
    static globalMonaco : any;
    loadPromise: Promise<void> | undefined;

    @ViewChild('editorContainer') _editorContainer?: ElementRef;
    @ViewChild('diffContainer') _diffContainer?: ElementRef;

    @Input() code = '';
    @Output() codeChange = new EventEmitter<any>();
    @Input() defaultLanguage : string = '';
    @Input() delayLoad : boolean = false;

    modelId : string = '';
    modelType : string = '';
    modelIndex : number = 0;

    codeEditorModels : (monaco.editor.ITextModel | undefined)[] = [];
    diffEditorModels : (monaco.editor.IDiffEditorModel | undefined)[] = [];
    codeEditorViewStates : (monaco.editor.ICodeEditorViewState | undefined | null)[] = [];
    diffEditorViewStates : (monaco.editor.IDiffEditorViewState | undefined | null)[] = [];

    // Holds instance of the current code editor
    codeEditorInstance?: monaco.editor.IStandaloneCodeEditor;
    diffEditorInstance?: monaco.editor.IStandaloneDiffEditor;

    editorActive: string = 'code-editor';
    get $codeEditor() : string {
        return AppConstants.CODE_EDITOR;
    }
    get $diffEditor() : string {
        return AppConstants.DIFF_EDITOR;
    }
    
    document: Document | undefined;
    window: (Window & typeof globalThis) | null;
    static {
        
    }

    cursorPosition? : monaco.Position;
    @Output() onCursorPositionChange : EventEmitter<any> = new EventEmitter<any>();

    constructor(private zone: NgZone, private configService: EditorConfigService, private readonly _ipc: IpcService) {
        this.document = inject(DOCUMENT);
        this.window = this.document?.defaultView;
    }

    // supports two-way binding
    ngOnChanges() {
        if (this.codeEditorInstance) {
            // this.codeEditorInstance.setValue(this.code);
            // if(this.codeEditorInstance.getModel()) {
            //     this.setModelLanguage(this.language);
            // }
        }
    }

    @Output() getCode() {
        return this.codeEditorInstance?.getValue();
    }

    @Output() createCodeEditorModel(code: string , language: string) : string {
        this.log('createModel');
        let model = monaco.editor.createModel(code, language);
        model.updateOptions({ tabSize: 4 });
        this.codeEditorModels.push(model);
        this.codeEditorViewStates.push(null);
        this.log('createModel | ' + this.codeEditorModels.length)
        let modelId =  'codeEditor_' + (this.codeEditorModels.length-1);
        model.onDidChangeContent(e => {
            this.codeChange.emit({
                modelId : modelId,
                canUndo : (<any>model).canUndo()
                // value : this.codeEditorInstance!.getValue()
            });
        });
        return modelId;
    }

    @Output() createDiffEditorModel(model1_id : string, model2_id : string) : string {
        this.log('createDiffEditorModel');
        //model1 and model2 id exist, assumption

        let model1Index = this.getModelIndex(model1_id);
        let model2Index = this.getModelIndex(model2_id);

        let model1 = this.codeEditorModels[model1Index];
        let model2 = this.codeEditorModels[model2Index];

        this.diffEditorModels.push(<monaco.editor.IDiffEditorModel>{
            original : model1,
            modified : model2
        });

        return 'diffEditor_' + (this.diffEditorModels.length-1);
    }
    
    //switches to specified code editor model
    // count: any = 2;
    @Output() switchModel(modelId_Str : string) : boolean {
        this.log('switchModel | ' + modelId_Str);
        let modelIndex = this.getModelIndex(modelId_Str);
        let modelType = this.getModelType(modelId_Str);
        let oldModelIndex = this.modelIndex;
        let oldModelType = this.modelType;

        let [old_viewStateList, old_editorInstance, old_modelList, old_editor] = this.getEditorBundle(oldModelType);
        let [viewStateList, editorInstance, modelList, editor] = this.getEditorBundle(modelType);

        if(modelList[modelIndex]) {
            // this.codeEditorViewStates[oldModelIndex] = editorInstance.saveViewState();
            old_viewStateList[oldModelIndex] = editorInstance.saveViewState();
            // this.codeEditorInstance?.setModel(this.codeEditorModels[modelIndex]!);
            // if(this.count > 0){
                editorInstance.setModel(<any>modelList[modelIndex]);
                // this.count--;
            // }
            // if(this.codeEditorViewStates[modelIndex]) {
            //     this.codeEditorInstance?.restoreViewState(this.codeEditorViewStates[modelIndex]!);
            // }
            if(viewStateList[modelIndex]) {
                editorInstance.restoreViewState(<any>viewStateList[modelIndex]);
                if(this.editorActive == this.$codeEditor)
                    this.onCursorPositionChange.emit(this.codeEditorViewStates[modelIndex]?.cursorState?.[0].position || {lineNumber : 1, column : 1});
            } else {
                if(this.editorActive == this.$codeEditor)
                    this.onCursorPositionChange.emit({lineNumber : 1, column : 1});
            }
            this.modelIndex = modelIndex;
            this.modelType = modelType;
            this.modelId = modelId_Str;
            this.editorActive = editor;
            this.log('switchModel | true');
            return true;
        }
        this.log('switchModel | false');
        return false;
    }

    getEditorBundle(type : string) : [
        (monaco.editor.IDiffEditorViewState | monaco.editor.ICodeEditorViewState | undefined | null)[], 
        monaco.editor.IStandaloneCodeEditor | monaco.editor.IStandaloneDiffEditor,
        (monaco.editor.ITextModel | monaco.editor.IDiffEditorModel | monaco.editor.IDiffEditorViewModel | undefined)[],
        string
    ] {
        let viewStateList, editorInstance, modelList, editor;
        if(type == 'diffEditor') {
            viewStateList = this.diffEditorViewStates;
            editorInstance = this.diffEditorInstance;
            modelList = this.diffEditorModels;
            editor = AppConstants.DIFF_EDITOR;
        } else {
            viewStateList = this.codeEditorViewStates;
            editorInstance = this.codeEditorInstance;
            modelList = this.codeEditorModels;
            editor = AppConstants.CODE_EDITOR;
        }
        return [viewStateList, editorInstance!, modelList, editor];
    }

    //switches to specified diff editor model
    // @Output() switchDiffModel(diffModelId_str : string) {
    //     this.log('switchDiffModel | ' + diffModelId_str);
    //     let diffModelId = this.getModelIndex(diffModelId_str);
    //     if(this.diffEditorModels[diffModelId]) {
    //         this.editorActive = AppConstants.DIFF_EDITOR;
    //         this.diffEditorInstance?.setModel(this.diffEditorModels[diffModelId]!);
    //         this.diffModelId = diffModelId;
    //         this.log('switchDiffModel | true');
    //         return true;
    //     }
    //     this.log('switchDiffModel | false');
    //     return false;
    // }

    getModelIndex(modelId : string) {
        return Number(modelId.split('_')[1]);
    }
    getModelType(modelId : string) {
        return (modelId.split('_')[0]);
    }

    @Output() clearModel(modelId? : string) {
        if(!modelId) {
            this.codeEditorInstance?.getModel()?.dispose();            
        } else {

            let modelIndex = this.getModelIndex(modelId);
            let modelType = this.getModelType(modelId);

            let [viewStateList, editorInstance, modelList, editor] = this.getEditorBundle(modelType);
            
            if(modelType != 'diffEditor') (<monaco.editor.ITextModel>modelList[modelIndex]!).dispose();
            modelList[modelIndex] = undefined;
            viewStateList[modelIndex] = undefined;
            // this.editorModels.splice(modelId, 1);
        }
    }

    @Output() clearAllModels() {
        for(let model of this.codeEditorModels) {
            model!.dispose();
        }
        this.codeEditorModels = [];
        this.diffEditorModels = []
        this.codeEditorViewStates = [];
        this.diffEditorViewStates = [];
        this.modelId = '';
        this.modelIndex = 0;
        this.modelType = '';
        this.codeEditorInstance?.getModel()?.dispose();
    }

    @Output() getContent(modelId_str : string) {
        let modelId : number = this.getModelIndex(modelId_str);
        this.log('getContent | modelId = ' + modelId);
        let content = '';
        if(!modelId) {
            content = this.codeEditorInstance?.getModel()?.getValue() || '';
        }
        else if(this.codeEditorModels[modelId]) {
            content = this.codeEditorModels[modelId]!.getValue();
        }
        return content;
    }

    @Output() setContent(content: string, modelId_str : string) : boolean{
        this.log('setContent | modelId_str = ' + modelId_str);
        let flag = false;
        content = content || '';

        let modelId = this.getModelIndex(modelId_str);

        if(!modelId_str) {
            this.codeEditorInstance?.getModel()?.setValue(content);
            flag = true;
        }
        else if(this.codeEditorModels[modelId]) {
            this.codeEditorModels[modelId]!.setValue(content);
            flag = true;
        }
        this.log('setContent | flag = ' + flag);
        return flag;
    }

    @Output() focus() {
        // this._editorContainer?.nativeElement.focus();
        setTimeout(() => {
            if(this.editorActive == AppConstants.CODE_EDITOR) this.codeEditorInstance?.focus();
            else this.diffEditorInstance?.focus();
        }, 100);
    }

    ngAfterViewInit() {
        if(!this.delayLoad) {
            this.loadMonacoLibrary();
        }
    }

    loadMonacoLibrary() {
        if (EditorConfigService.monaco || this.window!.monaco) {
            console.log('#$#$ MONACO FOUND')
            // Wait until monaco editor is available
            return this.loadPromise = new Promise((resolve, reject) => {resolve(true)}).then(() => {
                this.initMonaco();
            });
        } else {
            console.log('#$#$ MONACO NOT FOUND')
            // this.loadedMonaco = true;
            // CodeEditorComponent.loadedMonacoGlobal = true;
            this.loadPromise = new Promise<void>(async (resolve: any) => {;
                if ((typeof ((<any>this.window).monaco) === 'object') || EditorConfigService.monaco) {
                    console.log('MONACO ALREADY LOADED');
                    await this.initMonaco();
                    resolve();
                    return;
                }
                const onMyAmdLoader: any = () => {
                    // Load monaco
                    (<any>this.window).require.config({ paths: { 'vs': 'assets/monaco/vs' } });

                    (<any>this.window).require(['vs/editor/editor.main'], async () => {
                        console.log('REQUIRE MONACO LOADED');
                        EditorConfigService.monaco = monaco;
                        await this.initMonaco();
                        resolve();
                    });
                };

                // Load AMD loader if necessary
                if (!(<any>this.window).require) {
                    const loaderScript: HTMLScriptElement = this.document!.createElement('script');
                    loaderScript.type = 'text/javascript';
                    loaderScript.src = 'assets/monaco/vs/loader.js';
                    loaderScript.addEventListener('load', onMyAmdLoader);
                    this.document!.body.appendChild(loaderScript);
                } else {
                    onMyAmdLoader();
                }
            });
            return this.loadPromise;
        }
    }

    async initMonaco() : Promise<void> {
        // CodeEditorComponent.globalMonaco = monaco;
        let monaco = EditorConfigService.monaco;
        // configure the monaco editor to understand custom language - customLang
        // monaco.languages.register(this.configService.getCustomLangExtensionPoint());
        // monaco.languages.setMonarchTokensProvider('CustomLang', this.configService.getCustomLangTokenProviders());
        // monaco.editor.defineTheme('customTheme', this.configService.getCustomLangTheme());   // add your custom theme here

        //---------------------- SHIKI --------------------------------------
        // Create the highlighter, it can be reused
        const highlighter = await createHighlighter({
            themes: [
                'vitesse-dark',
                'vitesse-light',
                'slack-dark',
                'one-dark-pro','solarized-dark','ayu-dark','slack-ochin','andromeeda','dark-plus', this.configService.getDarkPlusShikiTheme()
            ],
            langs: [
                'javascript',
                'typescript',
                'vue',
                'apex',
                'html',
                'css','java','xml'
                // 'xml',
                // 'svg',
            ],
        });

        
        // Register the languageIds first. Only registered languages will be highlighted.
        monaco.languages.register({ id: 'vue' })
        monaco.languages.register({ id: 'typescript' })
        monaco.languages.register({ id: 'javascript' })
        monaco.languages.register({ id: 'java' })
        monaco.languages.register({ id: 'apex' })
        monaco.languages.register({ id: 'html' })
        monaco.languages.register({ id: 'css' })
        monaco.languages.register({ id: 'xml' })
        monaco.languages.register({ id: 'svg' })
        
        // Register the themes from Shiki, and provide syntax highlighting for Monaco.
        // await AppConstants.sleep(2000);
        // shikiToMonaco(highlighter, monaco)

        // let theme = 'vitesse-dark';
        let theme = 'vs-dark';
        // let theme = 'default';
        // let theme = 'my-dark-plus';

        //----------------------MONACO EDITOR TEXTMATE--------------------------------------
        // let onigasmContent = await this._ipc.callMethod('getOnigASM');
        // let onigasmContent = (await fetch(''));
        // await loadWASM('/assets/onigasm.wasm'); // See https://www.npmjs.com/package/onigasm#light-it-up

        // const registry = new Registry({
        //     getGrammarDefinition: async (scopeName) => {
        //         // let cnt = <string>(await this._ipc.callMethod('getTMgrammer', scopeName));
        //         return {
        //             format: 'json',
        //             // content: cnt
        //             content: await (await fetch('/assets/java.tmLanguage.json')).text()
        //         }
        //     }
        // })

        // // map of monaco "language id's" to TextMate scopeNames
        // const grammars = new Map()
        // grammars.set('css', 'source.css')
        // grammars.set('html', 'text.html.basic')
        // // grammars.set('typescript', 'source.ts')
        // grammars.set('java', 'source.java')
        // grammars.set('apex', 'source.apex')
        // grammars.set('javascript', 'source.js')

        // let theme = 'vs-dark';

        this.codeEditorInstance = monaco.editor.create(this._editorContainer!.nativeElement, {
            value: this.code,
            language: 'java',
            // theme: 'vs-dark',
            automaticLayout: true,
            // wordWrap: 'on'
            // glyphMargin: true
            theme: theme
        });

        this.diffEditorInstance = monaco.editor.createDiffEditor(
            this._diffContainer!.nativeElement,
            {
                theme: theme,
                hideUnchangedRegions: {
                    enabled: false
                },
                glyphMargin: true,
                ignoreTrimWhitespace: false,
                originalEditable: true,
                automaticLayout: true
            }
        );

        // To support two-way binding of the code
        this.codeEditorInstance!.getModel()!.onDidChangeContent(e => {
            this.codeChange.emit({
                modelId : this.modelId,
                canUndo : (<any>this.codeEditorInstance!.getModel()).canUndo()
                // value : this.codeEditorInstance!.getValue()
            });
        });

        this.codeEditorInstance!.onDidChangeCursorPosition(e => {
            this.cursorPosition = e.position;
            this.onCursorPositionChange.emit(e.position);
        })

        this.codeEditorModels.push(this.codeEditorInstance!.getModel()!);

        this.setModelLanguage(this.defaultLanguage);

        // await monaco.languages.typescript.getTypeScriptWorker();
        await AppConstants.sleep(500);
        shikiToMonaco(highlighter, monaco)
        theme = 'dark-plus';
        monaco.editor.setTheme(theme);

        // await AppConstants.sleep(2000);
        // await wireTmGrammars(<any>monaco, registry, grammars, <any>this.codeEditorInstance);
        // await wireTmGrammars(<any>monaco, registry, grammars, <any>this.diffEditorInstance);
    }

    setModelLanguage(language: string) {
        if(this.editorActive == AppConstants.CODE_EDITOR) {
            monaco.editor.setModelLanguage(this.codeEditorInstance?.getModel()!, language);
        }
        // this.codeEditorInstance?.getModel().
    }

    getModelLanguage() {
        if(this.editorActive == AppConstants.CODE_EDITOR) {
            return this.codeEditorInstance?.getModel()?.getLanguageId() || '';
        }
        return '';
    }

    @Output() showCodeEditor() {
        this.editorActive = AppConstants.CODE_EDITOR;
    }

    @Output() showDiffEditor() {
        this.editorActive = AppConstants.DIFF_EDITOR;
    }

    @Output() nextDiff() {
        if(this.editorActive == AppConstants.DIFF_EDITOR) {
            this.diffEditorInstance?.goToDiff('next');
        }
    }

    @Output() prevDiff() {
        if(this.editorActive == AppConstants.DIFF_EDITOR) {
            this.diffEditorInstance?.goToDiff('previous');
        }
    }

    @Output() swapDiff() {
        if(this.editorActive == AppConstants.DIFF_EDITOR) {
            let model = this.diffEditorInstance!.getModel()!;
            let viewstate = this.diffEditorInstance!.saveViewState();
            let temp = model.modified;
            model.modified = model.original;
            model.original = temp;
            this.diffEditorInstance!.setModel(model);
            this.diffEditorInstance!.restoreViewState(viewstate);
        }
    }

    @Output() wordWrap(wrapWord : boolean) {
        if(this.codeEditorInstance) {
            this.codeEditorInstance.updateOptions({
                wordWrap : wrapWord ? 'on' : 'off'
            });
        }
        if(this.diffEditorInstance) {
            this.diffEditorInstance.updateOptions({
                wordWrap : wrapWord ? 'on' : 'off'
            });
        }
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('code-editor.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }

}