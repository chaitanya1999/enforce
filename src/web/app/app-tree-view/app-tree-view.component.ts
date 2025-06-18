import { Component, Input, Output, EventEmitter, signal, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeEntity } from '../AppConstants'; // Adjust the import path as necessary

@Component({
	selector: 'app-tree-view',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './app-tree-view.component.html',
	styleUrl: './app-tree-view.component.css',
})
export class AppTreeViewComponent implements OnInit, OnChanges {
	@Input({ required: true }) treeData: any[] = [];
	@Input() activeTabModelId: string | null = null;
	@Input() showHiddenNodes: boolean = false;
	@Input() showPinnedNodes: boolean = false;
	@Input() showTemporaryNodes: boolean = false;
	@Input() showOrgName: boolean = true;

	@Output() onNodeClick = new EventEmitter<any>();
	@Output() onNodeContextMenu = new EventEmitter<{event: MouseEvent, node: any}>();
	@Output() onNodeMouseUp = new EventEmitter<{event: MouseEvent, node: any}>();
	@Output() closeTab = new EventEmitter<any>();

	expanded = signal<{ [key: string]: boolean }>({});

	ngOnInit() {
		this.expandAllNodes();
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['treeData'] && !changes['treeData'].firstChange) {
			this.expandAllNodes();
		}
		if (changes['activeTabModelId'] && this.activeTabModelId) {
			this.expandPathToActiveTab();
		}
	}

	expandAllNodes() {
		const expanded: { [key: string]: boolean } = {};
		const tree = this.tree;
		for (const orgName of this.getKeys(tree)) {
			expanded[orgName] = true;
			for (const entityType of this.getKeys(tree[orgName])) {
				expanded[orgName + '-' + entityType] = true;
				if (entityType == this.CodeEntity.AuraComponent || entityType == this.CodeEntity.LWC) {
					for (const bundle of this.getKeys(tree[orgName][entityType])) {
						expanded[orgName + '-' + entityType + '-' + bundle] = true;
					}
				}
			}
		}
		this.expanded.set(expanded);
	}

	expandPathToActiveTab() {
		const tab = this.treeData.find(t => t.modelId === this.activeTabModelId);
		if (!tab) return;
		const org = tab.orgName || 'Unknown Org';
		const entityType = tab.entityType || 'Other';
		const expanded = { ...this.expanded() };
		expanded[org] = true;
		expanded[org + '-' + entityType] = true;
		if (entityType === this.CodeEntity.AuraComponent || entityType === this.CodeEntity.LWC) {
			const bundle = tab.bundleName || 'Unknown Bundle';
			expanded[org + '-' + entityType + '-' + bundle] = true;
		}
		this.expanded.set(expanded);
	}

	getKeys(obj: any): string[] {
		return obj ? Object.keys(obj) : [];
	}

	// Computed tree structure for display
	get tree() {
		const orgMap: any = {};
		for (const tab of this.treeData) {
			if (!this.showHiddenNodes && tab.hidden) continue;
			if (!this.showPinnedNodes && tab.pinned) continue;
			if (!this.showTemporaryNodes && tab.temporary) continue;
			const org = tab.orgName || 'Unknown Org';
			if (!orgMap[org]) orgMap[org] = {};
			const entityType = tab.entityType || 'Other';
			if (!orgMap[org][entityType]) orgMap[org][entityType] = {};
			if (entityType === CodeEntity.AuraComponent || entityType === CodeEntity.LWC) {
				const bundle = tab.bundleName || 'Unknown Bundle';
				if (!orgMap[org][entityType][bundle]) orgMap[org][entityType][bundle] = [];
				orgMap[org][entityType][bundle].push(tab);
			} else {
				if (!orgMap[org][entityType]['_tabs']) orgMap[org][entityType]['_tabs'] = [];
				orgMap[org][entityType]['_tabs'].push(tab);
			}
		}
		return orgMap;
	}

	toggle(key: string) {
		this.expanded.update(state => ({ ...state, [key]: !state[key] }));
	}

	isExpanded(key: string) {
		return !!this.expanded()[key];
	}

	handleNodeClick(tab: any, event?: MouseEvent) {
		this.onNodeClick.emit(tab);
		if (event) event.stopPropagation();
	}

	handleNodeContextMenu(tab: any, event: MouseEvent) {
		event.preventDefault();
		this.onNodeContextMenu.emit({ event, node: tab });
	}

	handleNodeMouseUp(tab: any, event: MouseEvent) {
		this.onNodeMouseUp.emit({ event, node: tab });
	}

	isTabPinned(tab: any): boolean {
		return !!tab.pinned;
	}
	isTabHidden(tab: any): boolean {
		return !!tab.hidden;
	}

	public CodeEntity = CodeEntity;
}
