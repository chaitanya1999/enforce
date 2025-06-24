import { Component, Inject, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CommandPaletteDialogData } from './command-palette-dialog-data';

@Component({
	selector: 'app-command-palette',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './command-palette.component.html',
	styleUrls: ['./command-palette.component.css']
})
export class CommandPaletteComponent implements AfterViewInit {
	search = '';
	filtered: any[] = [];
	activeIndex = 0;
	@ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
	@ViewChildren('cmdListItem') cmdListItems!: QueryList<ElementRef<HTMLLIElement>>;
	placeholder: string = 'Type a command...';
	emptyMessage: string = 'No commands found';
	commandFlag: boolean = false;
	wildcardEnabled: boolean = false;

	constructor(
		public dialogRef: MatDialogRef<CommandPaletteComponent>,
		@Inject(MAT_DIALOG_DATA) public data: CommandPaletteDialogData
	) {
		data.commands = data.commands || [];
		this.filtered = data.commands;
		if (data.placeholder) this.placeholder = data.placeholder;
		if (typeof data.commandFlag === 'boolean') this.commandFlag = data.commandFlag;
		if (typeof data.wildcardEnabled === 'boolean') this.wildcardEnabled = data.wildcardEnabled;
		this.emptyMessage = data.emptyMessage || 'No commands found';
	}

	ngAfterViewInit() {
		setTimeout(() => this.inputEl?.nativeElement?.focus(), 0);
	}

	onInput() {
		const s = this.search.toLowerCase();
		if (this.wildcardEnabled && s.includes('*')) {
			console.log('wildcardEnabled');
			// Convert * to .*, escape other regex chars
			const regexStr = '' + s.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '';
			const regex = new RegExp(regexStr, 'i');
			this.filtered = this.data.commands!.filter(cmd => regex.test(cmd.name.toLowerCase()));
		} else {
			this.filtered = this.data.commands!.filter(cmd =>
				cmd.name.toLowerCase().includes(s)
			);
		}
		this.activeIndex = 0;
	}

	onKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.activeIndex = (this.activeIndex + 1) % this.filtered.length;
			this.scrollActiveItemIntoView();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			this.activeIndex = (this.activeIndex - 1 + this.filtered.length) % this.filtered.length;
			this.scrollActiveItemIntoView();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (this.filtered[this.activeIndex]) {
				this.select(this.filtered[this.activeIndex]);
			}
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.dialogRef.close();
		}
	}

	scrollActiveItemIntoView() {
		setTimeout(() => {
			const items = this.cmdListItems?.toArray();
			if (items && items[this.activeIndex]) {
				items[this.activeIndex].nativeElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
			}
		}, 0);
	}

	select(cmd: any) {
		this.dialogRef.close(cmd);
	}
}
