import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { CustomTypeaheadComponent } from "../custom-typeahead/custom-typeahead.component";

export class PromptDialogOptions {
    text?: string;
    label?: string;
    regex?: string; // legacy, fallback

    showTopRightTextbox?: boolean;
    topRightTextboxPlaceholder?: string;
    topRightTextboxLabel?: string;
    topRightTextboxValue?: string;
    topRightTextboxChangeHandler?: (event: any, cmpInstance : PromptDialogComponent) => void;
    
    dropdownRequired?: boolean;
    dropdownList?: any[];
    dropdownPlaceholder?: string;
    
    isTextFieldRequired?: boolean;
    placeholder?: string;
    textFieldRegex?: string;
    inputValue?: string;
    validationText?: string;
    
    isTextAreaRequired?: boolean;
    textAreaRegex?: string;
    textAreaValue?: string;
    
    checkboxRequired?: boolean;
    checkboxValue?: boolean;
    checkboxLabel?: string;

    isTableRequired?: boolean;
    tableData?: {
        columns: { key: string; label: string }[];
        rows: any[];
        maxHeight?: string;
    };

    okButtonText?: string;
    cancelButtonText?: string;
    isCheckboxInTableRequired?: boolean;
    defaultTableCheckboxState?: boolean = false;

    helperBtn1Required?: boolean;
    helperBtn1Text?: string;
    helperBtn1_onclick? : (event: any, cmpInstance: PromptDialogComponent) => void;
    helperBtn2Required?: boolean;
    helperBtn2Text?: string;
    helperBtn2_onclick? : (event: any, cmpInstance: PromptDialogComponent) => void;
}

@Component({
    selector: 'app-prompt-dialog',
    standalone: true,
    imports: [FormsModule, CustomTypeaheadComponent],
    templateUrl: './prompt-dialog.component.html',
    styleUrl: './prompt-dialog.component.css'
})
export class PromptDialogComponent {
    @ViewChild('formInput') inputField: any;
    
    dropdownSelection? : string;
    maxListSize : number = 10000;
    
    @ViewChild('formTextArea') textAreaField: any;
    
    typeaheadRootStyle: string = '';
    @ViewChild('typeaheadParent') typeaheadParent : any;
    @ViewChild('typeahead') typeahead : any;

    tableData?: { columns: { key: string; label: string }[]; rows: any[]; maxHeight?: string };
    tableCheckboxStates: boolean[] = [];
    @ViewChild('tableElement') tableElement?: ElementRef;

    //! TODO - Duplicate properties as PromptDialogOptions , must use options direct
    constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: PromptDialogOptions) {
        data.text = data.text || 'Please enter some input';
        data.placeholder = data.placeholder || 'Input';
        data.label = data.label || 'Input';
        // this.regex = data.regex; // legacy, fallback
        data.textFieldRegex = data.textFieldRegex || data.regex;
        data.textAreaRegex = data.textAreaRegex || data.regex;
        data.validationText = data.validationText || 'Please enter a valid input';
        data.dropdownRequired = !!data.dropdownRequired;
        data.dropdownList = data.dropdownList;
        data.dropdownPlaceholder = data.dropdownPlaceholder || '';
        data.isTextAreaRequired = !!data.isTextAreaRequired;
        data.isTextFieldRequired = data.isTextFieldRequired !== false; // default true
        data.textAreaValue = data.textAreaValue || '';
        data.inputValue = data.inputValue || '';
        data.checkboxRequired = data.checkboxRequired || false;
        data.checkboxValue = data.checkboxValue || false;
        data.checkboxLabel = data.checkboxLabel || '';
        data.isTableRequired = !!data.isTableRequired;
        data.okButtonText = data.okButtonText || 'Yes';
        data.cancelButtonText = data.cancelButtonText || 'No';
        data.isCheckboxInTableRequired = !!data.isCheckboxInTableRequired;
        data.defaultTableCheckboxState = !!data.defaultTableCheckboxState;

        if (data.isTableRequired && data.tableData && Array.isArray(data.tableData.columns) && Array.isArray(data.tableData.rows)) {
            this.tableData = JSON.parse(JSON.stringify(data.tableData)); // deep copy
            this.tableCheckboxStates = data.tableData.rows.map(() => this.data.defaultTableCheckboxState!);
            this.log('Table data initialized:', this.tableData);
        }
        data.showTopRightTextbox = !!data.showTopRightTextbox;
        data.topRightTextboxPlaceholder = data.topRightTextboxPlaceholder || '';
        data.topRightTextboxLabel = data.topRightTextboxLabel || '';
        data.topRightTextboxValue = data.topRightTextboxValue || '';
        data.topRightTextboxChangeHandler = data.topRightTextboxChangeHandler || ((event: any, cmpInstance: PromptDialogComponent) => {});
        data.topRightTextboxChangeHandler({target : { value: data.topRightTextboxValue }}, this);

        data.helperBtn1Required = !!data.helperBtn1Required;
        data.helperBtn1Text = data.helperBtn1Text || 'Button 1';
        data.helperBtn1_onclick = data.helperBtn1_onclick ?? ((event: any, cmpInstance: PromptDialogComponent) => {});
        data.helperBtn2Required = !!data.helperBtn2Required;
        data.helperBtn2Text = data.helperBtn2Text || 'Button 2';
        data.helperBtn2_onclick = data.helperBtn2_onclick ?? ((event: any, cmpInstance: PromptDialogComponent) => {});
    }

    isTextFieldValid(): boolean {
        if (!this.data.isTextFieldRequired) return true;
        return !!this.data.inputValue && (!this.data.textFieldRegex || !!this.data.inputValue.match(this.data.textFieldRegex));
    }
    isTextAreaValid(): boolean {
        if (!this.data.isTextAreaRequired) return true;
        return !!this.data.textAreaValue && (!this.data.textAreaRegex || !!this.data.textAreaValue.match(this.data.textAreaRegex));
    }
    isInputValid(): boolean {
        return this.isTextFieldValid() && this.isTextAreaValid();
    }

    confirm() {
        const inputValid = this.isTextFieldValid();
        const textAreaValid = this.isTextAreaValid();
        const valid = inputValid && textAreaValid;
        // Set classes for input field
        if (this.inputField) {
            if (inputValid) {
                this.inputField.nativeElement.classList.remove("is-invalid");
                this.inputField.nativeElement.classList.add("is-valid");
            } else {
                this.inputField.nativeElement.classList.remove("is-valid");
                this.inputField.nativeElement.classList.add("is-invalid");
            }
        }
        // Set classes for textarea field
        if (this.textAreaField) {
            if (textAreaValid) {
                this.textAreaField.nativeElement.classList.remove("is-invalid");
                this.textAreaField.nativeElement.classList.add("is-valid");
            } else {
                this.textAreaField.nativeElement.classList.remove("is-valid");
                this.textAreaField.nativeElement.classList.add("is-invalid");
            }
        }
        if (valid) {
            let tableRowsWithCheckbox = undefined;
            if (this.data.isTableRequired && this.data.isCheckboxInTableRequired && this.tableData?.rows) {
                tableRowsWithCheckbox = this.tableData.rows.map((row, idx) => ({ ...row, checked: this.tableCheckboxStates[idx] }));
            }
            this.dialogRef.close({
                input: this.data.inputValue,
                textArea: this.data.textAreaValue,
                dropdownSelection: this.dropdownSelection,
                checkbox: this.data.checkboxValue,
                tableRows: tableRowsWithCheckbox,
                topRightTextboxValue: this.data.topRightTextboxValue
            });
        }
    }

    helperBtn1Click(event : any) {
        this.data.helperBtn1_onclick!(event, this);
    }
    helperBtn2Click(event : any) {
        this.data.helperBtn2_onclick!(event, this);
    }

    close() {
        this.dialogRef.close();
    }

    onKeyDown(evt : any) {
        if(evt.key == 'Enter') {
            this.confirm();
        }
    }

    onTextAreaKeyDown(evt: KeyboardEvent) {
        if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
            if (this.isInputValid() && !(this.data.dropdownRequired && !this.dropdownSelection)) {
                this.confirm();
            }
        }
    }

    dropdownOnSelect(selection : any) {
        this.dropdownSelection = selection;
    }

    masterChecked = false;
    masterIndeterminate = false;
    toggleAllCheckboxes(event: Event) {
        const checked = (event.target as HTMLInputElement).checked;

        this.tableCheckboxStates = this.tableCheckboxStates.map(() => checked);

        this.masterChecked = checked;
        this.masterIndeterminate = false;
    }
    updateMasterState() {
        const total = this.tableCheckboxStates.length;
        const selected = this.tableCheckboxStates.filter(v => v).length;

        this.masterChecked = selected === total && total > 0;
        this.masterIndeterminate = selected > 0 && selected < total;
    }

    onRowCheckboxChange() {
        this.updateMasterState();
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('prompt-dialog.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }
}
