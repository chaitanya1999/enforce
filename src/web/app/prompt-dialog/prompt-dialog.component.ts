import { Component, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { CustomTypeaheadComponent } from "../custom-typeahead/custom-typeahead.component";


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
    regex: string;
    inputValue?: string;
    @ViewChild('formInput') inputField: any;
    validationText: string;
    dropdownRequired: boolean;
    dropdownList: any;
    dropdownPlaceholder: string;
    dropdownSelection? : string;
    typeaheadRootStyle: string = '';
    maxListSize : number = 10000;

    @ViewChild('typeaheadParent') typeaheadParent : any;
    @ViewChild('typeahead') typeahead : any;

    constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
        this.text = data.text || 'Please enter some input';
        this.placeholder = data.placeholder || 'Input';
        this.label = data.label || 'Input';
        this.regex = data.regex;
        this.validationText = data.validationText || 'Please enter a valid input';
        this.dropdownRequired = data.dropdownRequired;
        this.dropdownList = data.dropdownList;
        this.dropdownPlaceholder = data.dropdownPlaceholder;
    }

    confirm() {
        let valid = this.regex ? this.inputValue?.match(this.regex)?.length : true;
        if (this.inputField.nativeElement.checkValidity() && valid) {
            this.inputField.nativeElement.classList.remove("is-invalid");
            this.inputField.nativeElement.classList.add("is-valid");
            this.dialogRef.close({input : this.inputValue, dropdownSelection : this.dropdownSelection});
        } else {
            this.inputField.nativeElement.classList.remove("is-valid");
            this.inputField.nativeElement.classList.add("is-invalid");
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

    dropdownOnSelect(selection : any) {
        this.dropdownSelection = selection;
    }
}
