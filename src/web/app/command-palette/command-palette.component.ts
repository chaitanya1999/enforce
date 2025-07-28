import { Component, Inject, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CommandPaletteDialogData } from './command-palette-dialog-data';

@Component({
	selector: 'app-command-palette',
	standalone: true,
	imports: [FormsModule, CommonModule],
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
	limitResults: boolean = false;
	maxResults: number = 100;
	totalFiltered: number = 0;

	searchInBadge : boolean = false;
	searchInShadowText : boolean = false;
	debounceInput: boolean = false;
	private inputDebounceTimer: any;
	private debounceLimit: number = 5
	private debounceCount: number = 5;

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
		if (typeof data.limitResults === 'boolean') this.limitResults = data.limitResults;
		if (typeof data.maxResults === 'number') this.maxResults = data.maxResults;
		this.totalFiltered = this.filtered.length;
		if (this.limitResults) {
			this.filtered = this.filtered.slice(0, this.maxResults);
		}
		this.searchInBadge = data.searchInBadge || false;
		this.searchInShadowText = data.searchInShadowText || false;
		this.debounceInput = !!data.debounce;

	}

	ngAfterViewInit() {
		setTimeout(() => this.inputEl?.nativeElement?.focus(), 0);
	}

	onInput() {
		if (this.debounceInput) {
			if (this.inputDebounceTimer) {
				clearTimeout(this.inputDebounceTimer);
			}
			this.debounceCount++;
			if(this.debounceCount >= this.debounceLimit) {
				this.debounceCount = 0;
				this.runInputFilter();
			} else {
				this.inputDebounceTimer = setTimeout(() => this.runInputFilter(), 200);
			}
		} else {
			this.runInputFilter();
		}
	}

	runInputFilter() {
		const s = this.search.toLowerCase();
		let matches: any[] = [];
		const opts = { searchInShadowText: this.searchInShadowText, searchInBadge: this.searchInBadge };

		if (this.wildcardEnabled && (s.includes('*') || s.includes(' '))) {
			const regexStr = s.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g,'.*')).join('.*')+'';
			const regex = new RegExp(regexStr, 'i');
			const allMatches = this.getRegexMatches(this.data.commands!, regex, opts);
			const exactMatches = this.getExactMatches(allMatches, s, opts);
			const partialMatches = allMatches.filter(cmd => !exactMatches.includes(cmd));
			matches = [...exactMatches, ...partialMatches];
		} else {
			const allMatches = this.getPartialMatches(this.data.commands!, s, opts);
			const exactMatches = this.getExactMatches(this.data.commands!, s, opts);
			const partialMatches = allMatches.filter(cmd => !exactMatches.includes(cmd));
			matches = [...exactMatches, ...partialMatches];
		}
		this.totalFiltered = matches.length;
		this.filtered = this.limitResults ? matches.slice(0, this.maxResults) : matches;
		this.activeIndex = 0;
	}


	private getPartialMatches(commands: any[], s: string, opts: { searchInShadowText: boolean, searchInBadge: boolean }) {
		return commands.filter(cmd =>
			(cmd.name.toLowerCase().includes(s) && cmd.name.toLowerCase() !== s) ||
			(opts.searchInShadowText && cmd.shadowText && cmd.shadowText.toLowerCase().includes(s) && cmd.shadowText.toLowerCase() !== s) ||
			(opts.searchInBadge && cmd.badge && cmd.badge.toLowerCase().includes(s) && cmd.badge.toLowerCase() !== s)
		);
	}

	private getRegexMatches(commands: any[], regex: RegExp, opts: { searchInShadowText: boolean, searchInBadge: boolean }) {
		return commands.filter(cmd =>
			regex.test(cmd.name.toLowerCase()) ||
			(opts.searchInShadowText && cmd.shadowText && regex.test(cmd.shadowText.toLowerCase())) ||
			(opts.searchInBadge && cmd.badge && regex.test(cmd.badge.toLowerCase()))
		);
	}

	private getExactMatches(commands: any[], s: string, opts: { searchInShadowText: boolean, searchInBadge: boolean }) {
		return commands.filter(cmd =>
			cmd.name.toLowerCase() === s ||
			(opts.searchInShadowText && cmd.shadowText && cmd.shadowText.toLowerCase() === s) ||
			(opts.searchInBadge && cmd.badge && cmd.badge.toLowerCase() === s)
		);
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
		this.dialogRef.close({command : cmd , commonAction : this.data.commonAction});
	}
}
