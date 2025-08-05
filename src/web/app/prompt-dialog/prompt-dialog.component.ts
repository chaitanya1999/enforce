import { Component, Inject, ViewChild } from '@angular/core';
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
    defaultTableCheckboxState?: boolean;
}

@Component({
    selector: 'app-prompt-dialog',
    standalone: true,
    imports: [FormsModule, CustomTypeaheadComponent],
    templateUrl: './prompt-dialog.component.html',
    styleUrl: './prompt-dialog.component.css'
})
export class PromptDialogComponent {
    text: string;
    placeholder: string;
    label: string;
    regex?: string;
    inputValue?: string;
    @ViewChild('formInput') inputField: any;
    validationText: string;
    dropdownRequired: boolean;
    dropdownList: any;
    dropdownPlaceholder: string;
    dropdownSelection? : string;
    typeaheadRootStyle: string = '';
    maxListSize : number = 10000;
    isTextAreaRequired: boolean;
    isTextFieldRequired: boolean;
    textAreaValue?: string;
    @ViewChild('formTextArea') textAreaField: any;

    @ViewChild('typeaheadParent') typeaheadParent : any;
    @ViewChild('typeahead') typeahead : any;

    textFieldRegex?: string;
    textAreaRegex?: string;

    checkboxRequired :  boolean = false;
    checkboxValue : boolean = false;
    checkboxLabel : string = 'Checkbox'

    isTableRequired: boolean = false;
    tableData?: { columns: { key: string; label: string }[]; rows: any[]; maxHeight?: string };

    okButtonText: string;
    cancelButtonText: string;

    isCheckboxInTableRequired: boolean = false;
    defaultTableCheckboxState: boolean = false;
    tableCheckboxStates: boolean[] = [];

    showTopRightTextbox: boolean = false;
    topRightTextboxPlaceholder: string;
    topRightTextboxLabel: string;
    topRightTextboxValue: string;
    topRightTextboxChangeHandler: (event: any, cmpInstance : PromptDialogComponent) => void;

    constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: PromptDialogOptions) {
        this.text = data.text || 'Please enter some input';
        this.placeholder = data.placeholder || 'Input';
        this.label = data.label || 'Input';
        this.regex = data.regex; // legacy, fallback
        this.textFieldRegex = data.textFieldRegex || this.regex;
        this.textAreaRegex = data.textAreaRegex || this.regex;
        this.validationText = data.validationText || 'Please enter a valid input';
        this.dropdownRequired = !!data.dropdownRequired;
        this.dropdownList = data.dropdownList;
        this.dropdownPlaceholder = data.dropdownPlaceholder || '';
        this.isTextAreaRequired = !!data.isTextAreaRequired;
        this.isTextFieldRequired = data.isTextFieldRequired !== false; // default true
        this.textAreaValue = data.textAreaValue || '';
        this.inputValue = data.inputValue || '';
        this.checkboxRequired = data.checkboxRequired || false;
        this.checkboxValue = data.checkboxValue || false;
        this.checkboxLabel = data.checkboxLabel || '';
        this.isTableRequired = !!data.isTableRequired;
        this.okButtonText = data.okButtonText || 'Yes';
        this.cancelButtonText = data.cancelButtonText || 'No';
        this.isCheckboxInTableRequired = !!data.isCheckboxInTableRequired;
        this.defaultTableCheckboxState = !!data.defaultTableCheckboxState;
        if (this.isTableRequired && data.tableData && Array.isArray(data.tableData.columns) && Array.isArray(data.tableData.rows)) {
            this.tableData = JSON.parse(JSON.stringify(data.tableData)); // deep copy
            this.tableCheckboxStates = data.tableData.rows.map(() => this.defaultTableCheckboxState);
            this.log('Table data initialized:', this.tableData);
        }
        this.showTopRightTextbox = !!data.showTopRightTextbox;
        this.topRightTextboxPlaceholder = data.topRightTextboxPlaceholder || '';
        this.topRightTextboxLabel = data.topRightTextboxLabel || '';
        this.topRightTextboxValue = data.topRightTextboxValue || '';
        this.topRightTextboxChangeHandler = data.topRightTextboxChangeHandler || ((event: any, cmpInstance: PromptDialogComponent) => {});
        this.topRightTextboxChangeHandler({target : { value: this.topRightTextboxValue }}, this);
    }

    isTextFieldValid(): boolean {
        if (!this.isTextFieldRequired) return true;
        return !!this.inputValue && (!this.textFieldRegex || !!this.inputValue.match(this.textFieldRegex));
    }
    isTextAreaValid(): boolean {
        if (!this.isTextAreaRequired) return true;
        return !!this.textAreaValue && (!this.textAreaRegex || !!this.textAreaValue.match(this.textAreaRegex));
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
            if (this.isTableRequired && this.isCheckboxInTableRequired && this.tableData?.rows) {
                tableRowsWithCheckbox = this.tableData.rows.map((row, idx) => ({ ...row, checked: this.tableCheckboxStates[idx] }));
            }
            this.dialogRef.close({
                input: this.inputValue,
                textArea: this.textAreaValue,
                dropdownSelection: this.dropdownSelection,
                checkbox: this.checkboxValue,
                tableRows: tableRowsWithCheckbox,
                topRightTextboxValue: this.topRightTextboxValue
            });
        }
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
            if (this.isInputValid() && !(this.dropdownRequired && !this.dropdownSelection)) {
                this.confirm();
            }
        }
    }

    dropdownOnSelect(selection : any) {
        this.dropdownSelection = selection;
    }

    log(...str: any) {
        if(!str) str = [];
        str.unshift('prompt-dialog.component |');
        // console.log('#$#$ ' , str);
        console.log(...str);
    }
}
