export type CommandPaletteDialogData = {
	emptyMessage?: string;
	commands?: any[];
	placeholder?: string;
	commandFlag?: boolean;
	wildcardEnabled?: boolean;
	limitResults?: boolean;
	maxResults?: number;
	commonAction? : any; //function
}
