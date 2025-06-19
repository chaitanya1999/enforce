import { Component, Input, Output, EventEmitter, signal, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeEntity } from '../AppConstants'; // Adjust the import path as necessary
/*
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>CF_ALL_NetBankingHelper</members>
        <members>CF_ALL_PerfiosUpldStrtRequest</members>
        <members>CF_UC_UploadBankStmnt_CC</members>
        <members>CF_UC_Pre_DA_CC</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>CF_UC_Pre_DA</members>
        <name>AuraDefinitionBundle</name>
    </types>
	<types>
        <members>cf_UC_DA_Charges</members>
        <name>LightningComponentBundle</name>
    </types>
    <types>
        <members>LoanApplicationTrigger</members>
        <name>ApexTrigger</name>
    </types>
    <types>
        <members>LoanApplicationCalculations</members>
        <name>StaticResource</name>
    </types>
    <types>
        <members>CF_ALL_LoanApplicationEdit</members>
        <name>ApexPage</name>
    </types>
    <types>
        <members>CF_UC_ApplicationFormPDF</members>
        <name>ApexComponent</name>
    </types>
    <version>59.0</version>
</Package>
*/

@Component({
	selector: 'app-tree-view',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './app-tree-view.component.html',
	styleUrl: './app-tree-view.component.css',
})
export class AppTreeViewComponent implements OnInit, OnChanges, AfterViewInit {
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

	ngAfterViewInit() {
		// Initial scroll if needed
		this.scrollToActiveTab();
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['treeData'] && !changes['treeData'].firstChange) {
			this.expandAllNodes();
		}
		if (changes['activeTabModelId'] && this.activeTabModelId) {
			this.expandPathToActiveTab();
			this.scrollToActiveTab();
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

	// Helper to get display name for a tab without mutating the original object
	getDisplayTabName(tab: any): string {
		const name = tab.tabName || '';
		if (name.startsWith('Diff : ') && !name.includes('<>')) {
			return name.substring(7);
		}
		return name;
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
		// Sort orgs, entity types, bundles, and tabs
		const sortedOrgMap: any = {};
		for (const org of Object.keys(orgMap).sort((a, b) => a.localeCompare(b))) {
			sortedOrgMap[org] = {};
			for (const entityType of Object.keys(orgMap[org]).sort((a, b) => a.localeCompare(b))) {
				sortedOrgMap[org][entityType] = {};
				// Bundles or _tabs
				if (entityType === CodeEntity.AuraComponent || entityType === CodeEntity.LWC) {
					for (const bundle of Object.keys(orgMap[org][entityType]).sort((a, b) => a.localeCompare(b))) {
						// Always remove 'Diff : ' for sorting
						sortedOrgMap[org][entityType][bundle] = orgMap[org][entityType][bundle].slice().sort((a: any, b: any) => {
							const aName = (a.tabName || '').startsWith('Diff : ') ? (a.tabName || '').substring(7) : (a.tabName || '');
							const bName = (b.tabName || '').startsWith('Diff : ') ? (b.tabName || '').substring(7) : (b.tabName || '');
							return aName.localeCompare(bName);
						});
					}
				} else {
					if (orgMap[org][entityType]['_tabs']) {
						sortedOrgMap[org][entityType]['_tabs'] = orgMap[org][entityType]['_tabs'].slice().sort((a: any, b: any) => {
							const aName = (a.tabName || '').startsWith('Diff : ') ? (a.tabName || '').substring(7) : (a.tabName || '');
							const bName = (b.tabName || '').startsWith('Diff : ') ? (b.tabName || '').substring(7) : (b.tabName || '');
							return aName.localeCompare(bName);
						});
					}
				}
			}
		}
		return sortedOrgMap;
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

	scrollToActiveTab() {
		setTimeout(() => {
			const el = document.querySelector(
				`.tree-leaf.tab-leaf.active-leaf`
			) as HTMLElement;
			if (el) {
				el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}
		}, 0);
	}
}
