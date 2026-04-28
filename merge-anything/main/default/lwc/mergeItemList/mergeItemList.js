import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMergeItemsByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemsByMergeJobId';

const ALL_MERGE_ITEMS = 'all_merge_items';
const PENDING_MERGE_ITEMS = 'pending_merge_items';
const IN_PROGRESS_MERGE_ITEMS = 'in_progress_merge_items';
const COMPLETED_MERGE_ITEMS = 'completed_merge_items';
const FAILED_MERGE_ITEMS = 'failed_merge_items';

const _columns = [
    {
        label: 'Merge Item Number',
        fieldName: 'Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_blank',
        },
    },
    { label: 'Merge Item Id', fieldName: 'Id' },
    {
        label: 'Primary Record',
        fieldName: 'Primary_Record_Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: '_primaryRecordLabel' },
            target: '_blank',
        },
    },
    {
        label: 'Secondary Record',
        fieldName: 'Secondary_Record_Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: '_secondaryRecordLabel' },
            target: '_blank',
        },
    },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

function decorateMergeItemsForDisplay(items) {
    if (!items) {
        return items;
    }
    return items.map((row) => ({
        ...row,
        _primaryRecordLabel: row.Primary_Record_Name__c || row.Primary_Record_Id__c || '',
        _secondaryRecordLabel: row.Secondary_Record_Name__c || row.Secondary_Record_Id__c || '',
    }));
}

export default class MergeItemList extends LightningElement {
    _recordId;
    _mergeItems;
    _filteredMergeItems;
    _mergeView;
    _columns = _columns;
    _wiredMergeItems;

    constructor() {
        super();
        this._mergeItems = [];
        this._filteredMergeItems = [];
        this._mergeView = ALL_MERGE_ITEMS;
    }

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        this.setAttribute('record-id', value);
        this._recordId = value;
    }

    @api
    get mergeView() {
        return this._mergeView;
    }

    set mergeView(value) {
        this.setAttribute('merge-view', value);
        this._mergeView = value;

        this.filterMergeItems();
    }

    @wire(getMergeItemsByMergeJobId, { mergeJobId: '$_recordId' })
    wireMergesItems(result) {
        this._wiredMergeItems = result;
        const { error, data } = result;
        if (data) {
            this._mergeItems = decorateMergeItemsForDisplay(data);
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._mergeItems = undefined;
        } else {
            this._error = undefined;
            this._mergeItems = undefined;
        }

        this.filterMergeItems();
    }

    /**
     * Re-runs the wired Apex so the datatable reflects new or updated merge items.
     */
    @api
    refreshList() {
        if (this._wiredMergeItems) {
            return refreshApex(this._wiredMergeItems);
        }
        return Promise.resolve();
    }

    filterMergeItems() {
        if (!this._mergeItems) {
            return;
        }

        if (this._mergeView === undefined || this._mergeView === null || this._mergeView === ALL_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems;
        } else if (this._mergeView === PENDING_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Pending');
        } else if (this._mergeView === IN_PROGRESS_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'In Progress');
        } else if (this._mergeView === COMPLETED_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Completed');
        } else if (this._mergeView === FAILED_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Failed');
        } else {
            this._filteredMergeItems = this._mergeItems;
        }
    }
}