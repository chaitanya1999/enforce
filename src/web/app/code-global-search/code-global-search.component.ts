import { Component, Inject, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {MatTooltipModule} from '@angular/material/tooltip';
import { IpcService } from '../../ipc.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-code-global-search',
    standalone: true,
    imports: [CommonModule, FormsModule, MatTooltipModule],
    templateUrl: './code-global-search.component.html',
    styleUrl: './code-global-search.component.css'
})
export class CodeGlobalSearchComponent implements AfterViewInit {
    searchText: string = '';
    orgName: string = '';
    loading: boolean = false;
    results: any[] = [];
    displayResults: any[] = [];
    error: string = '';
    submitted: boolean = false;
    selectedRowIndex: number | null = null;
    // @Output() rowDoubleClicked = new EventEmitter<any>();
    @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('tableContainer') tableContainer? : ElementRef;
    stateLoaded : boolean = false;

    constructor(
        private ipc: IpcService,
        public dialogRef: MatDialogRef<CodeGlobalSearchComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.orgName = data.orgName;
        if(this.orgName == data.state?.orgName) {
            //restore state
            this.searchText = data.state?.searchText;
            this.results = data.state?.results;
            this.error = data.state?.error;
            this.submitted = data.state?.submitted;
            this.selectedRowIndex = data.state?.selectedRowIndex;
            this.hideTestClasses = data.state?.hideTestClasses;
            this.stateLoaded = true;
            this.filterTestClasses();
        }

        dialogRef.beforeClosed().subscribe(result => {
            if (result === undefined) {
                this.close();
            }
        });
    }


    async onSearch() {
        if (!this.searchText) return;
        this.loading = true;
        this.error = '';
        this.results = [];
        this.submitted = true;
        let text = this.searchText.trim().replaceAll('{', '\\{').replaceAll('}', '\\}');
        try {
            const res = await this.ipc.callMethod('codeGlobalSearch', { orgName: this.orgName, searchText: text });
            if (res && res.isSuccess) {
                this.results = res.data;
                this.displayResults = res.data;
                this.filterTestClasses();
            } else {
                this.error = res?.errors?.[0]?.message || 'No results or error occurred.';
            }
        } catch (err: any) {
            this.error = err?.message || 'Error occurred.';
        } finally {
            this.loading = false;
        }
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            if (this.searchText && this.searchText.trim().length > 0) {
                this.onSearch();
            }
            // If blank, do nothing
        }
    }

    close(closeData : any = {}) {
        this.dialogRef.close({
            searchText : this.searchText,
            orgName : this.orgName,
            results : this.results,
            error : this.error,
            submitted : this.submitted,
            selectedRowIndex : this.selectedRowIndex,
            tableScroll : this.tableContainer?.nativeElement.scrollTop,
            hideTestClasses : this.hideTestClasses,
            ...closeData
        });
    }

    selectRow(row: any, index: number) {
        this.selectedRowIndex = index;
    }

    openRow(row: any, index: number) {
        this.selectedRowIndex = index;
        this.close({row});
        // Emit event to parent (code-browser) to load entity
        // this.rowDoubleClicked.emit(row);
        // Optionally close dialog here if you want:
        // this.close();
    }

    ngAfterViewInit() {
        setTimeout(() => {
            if (this.searchInputRef && this.searchInputRef.nativeElement) {
                this.searchInputRef.nativeElement.focus();
            }
            if(this.stateLoaded && this.tableContainer && this.data.state?.tableScroll) this.tableContainer.nativeElement.scrollTop = this.data.state?.tableScroll;
        }, 150);
    }

    hideTestClasses : boolean = false;
    filterTestClasses() {
        this.displayResults = [];
        if(!this.hideTestClasses)
            this.displayResults = this.results;
        else this.displayResults = this.results.filter((x:any) => !x.isTestClass);
    }
}
