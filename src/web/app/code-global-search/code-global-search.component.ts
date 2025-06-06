import { Component, Inject, Output, EventEmitter } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { IpcService } from '../../ipc.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-code-global-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './code-global-search.component.html',
    styleUrl: './code-global-search.component.css'
})
export class CodeGlobalSearchComponent {
    searchText: string = '';
    orgName: string = '';
    loading: boolean = false;
    results: any[] = [];
    error: string = '';
    submitted: boolean = false;
    selectedRowIndex: number | null = null;
    @Output() rowDoubleClicked = new EventEmitter<any>();

    constructor(
        private ipc: IpcService,
        public dialogRef: MatDialogRef<CodeGlobalSearchComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.orgName = data.orgName;
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

    close() {
        this.dialogRef.close();
    }

    selectRow(row: any, index: number) {
        this.selectedRowIndex = index;
    }

    openRow(row: any, index: number) {
        this.selectedRowIndex = index;
        // Emit event to parent (code-browser) to load entity
        this.rowDoubleClicked.emit(row);
        // Optionally close dialog here if you want:
        // this.close();
    }
}
