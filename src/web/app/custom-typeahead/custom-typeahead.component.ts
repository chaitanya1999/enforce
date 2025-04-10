import { Component, EventEmitter, Input, Output, QueryList, SimpleChanges, ViewChild, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';


@Component({
    selector: 'app-custom-typeahead',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './custom-typeahead.component.html',
    styleUrl: './custom-typeahead.component.css'
})
export class CustomTypeaheadComponent {
    LOG: boolean = true;
    searchQuery: string = '';
    displayTypeahead: boolean = false;
    _dataset: SelectOption[] = [];
    @Input() set dataset(value: SelectOption[]) {
        this._dataset = value;
        this.onDatasetChange();
    }
    get dataset() {
        return this._dataset;
    }

    displayList: SelectOption[] = [];
    maxListSize: number = 50;

    keyboardHoverIndex = -1;
    @ViewChildren('listOptionDiv') view_listOptions : any;

    maxSelectSize: number = 5;
    @ViewChild('typeaheadSelect') typeaheadSelect!: any;
    @ViewChild('typeaheadInput') typeaheadInput!: any;
    isSomeOptionFocused: boolean = false;
    selectedOption: SelectOption | undefined;
    @Input() placeholder: string = 'Type...';

    @Output() onSelect = new EventEmitter();
    @Output() onUnfocus = new EventEmitter();

    get displayListSize(): number {
        return Math.max(2, Math.min(this.maxSelectSize, this.displayList.length));
    }

    constructor() {
        this.dataset = [
            // { label : 'Option 1', value : 'Value 1' },
            // { label : 'Option 2', value : 'Value 2' },
            // { label : 'Option 3', value : 'Value 3' },
            // { label : 'Option 4', value : 'Value 4' },
            // { label : 'Option 5', value : 'Value 5' },
            // { label : 'apple', value : 'Value 6' },
            // { label : 'mango', value : 'Value 7' },
            // { label : 'banana', value : 'Value 8' },
            // { label : 'chiku', value : 'Value 9' }
        ];
    }

    onFocus(evt: any) {
        console.log('#$#$ ', document.activeElement);
        this.displayTypeahead = true;
    }
    onBlur(evt: any) {
        // this.log('onBlur | focusExists = ' + this.isSomeOptionFocused);
        if (!this.isSomeOptionFocused) {
            this.displayTypeahead = false;
            this.keyboardHoverIndex = -1;
        }
    }
    onClick(evt : any) {
        this.displayTypeahead = true;
    }

    onChange(evt: any) {
        this.log('onChange | searchQuery = ' + this.searchQuery);
        this.keyboardHoverIndex = -1;
        this.filter();
    }
    filter() {
        this.displayList = this.dataset
            // .filter((x: any) => x.label.toLowerCase().includes(this.searchQuery.toLowerCase()))
            .filter((x: any) => this.matchRuleExpl(x.label.toLowerCase() , "*"+this.searchQuery.toLowerCase()))
            .filter((x: any, index: number) => index < this.maxListSize);
    }

    //Explanation code
    matchRuleExpl(str: string, rule: string) {
        // for this solution to work on any string, no matter what characters it has
        var escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

        // "."  => Find a single character, except newline or line terminator
        // ".*" => Matches any string that contains zero or more characters
        rule = rule.split("*").map(escapeRegex).join(".*");

        if(rule == '') rule = '.*';

        // "^"  => Matches any string with the following at the beginning of it
        // "$"  => Matches any string with that in front at the end of it
        rule = "^" + rule;

        //Create a regular expression object for matching string
        var regex = new RegExp(rule);

        //Returns true if it finds a match, otherwise it returns false
        let matchVal = regex.test(str);        
        // console.log('###$$$ ' + str + " " + rule + ' = ' + matchVal);
        return matchVal;
    }

    onDatasetChange() {
        this.log('onDatasetChange');
        // this.searchQuery = '';
        this.keyboardHoverIndex = -1;
        this.filter();
    }

    onTypeaheadFocus() {
        this.isSomeOptionFocused = true;
        this.log('typeahead is focused');
    }

    onTypeaheadUnfocus() {
        this.isSomeOptionFocused = false;
        this.log('typeahead is unfocused');
    }

    onSelectFocus() {
        this.typeaheadInput.nativeElement.focus();
    }

    onKeyDown(evt: any) {
        if(evt.key == 'ArrowDown') {
            if(!this.displayTypeahead)
                this.displayTypeahead = true

            this.keyboardHoverIndex = (this.keyboardHoverIndex + 1) % this.displayList.length;
            this.view_listOptions._results[this.keyboardHoverIndex].nativeElement.scrollIntoView({block: "nearest"});            

        } else if(evt.key == 'ArrowUp') {
            this.keyboardHoverIndex = (this.keyboardHoverIndex - 1 + this.displayList.length) % this.displayList.length;
            this.view_listOptions._results[this.keyboardHoverIndex].nativeElement.scrollIntoView({block: "nearest"});

        } else if(evt.key == 'Enter') {
            if(this.keyboardHoverIndex != -1){
                this.onSelectOption(this.displayList[this.keyboardHoverIndex]);
            }
        } else if(evt.key == 'Escape') {
            this.onUnfocus.emit();
        }
    }

    onSelectOption(option: SelectOption) {
        this.log('onSelect | selected = ' + option.value);
        this.searchQuery = option.label;
        this.selectedOption = option;
        this.displayTypeahead = false;
        this.isSomeOptionFocused = false;
        this.keyboardHoverIndex = -1;

        this.onSelect.emit(option);
    }

    @Output() clearSearchQuery() {
        this.setSearchQuery('');
    }

    @Output() setSearchQuery(query: string) {
        this.searchQuery = query;
    }

    @Output() focus() {
        this.typeaheadInput.nativeElement.focus();
    }

    log(...str: any) {
        if (this.LOG)
            console.log('custom-typeahead | ', ...str);
    }

}
