import { LightningElement, api, wire } from 'lwc';
import getMergeItemsByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemsByMergeJobId';

const ALL_MERGE_ITEMS = 'all_merge_items';
const PENDING_MERGE_ITEMS = 'pending_merge_items';
const IN_PROGRESS_MERGE_ITEMS = 'in_progress_merge_items';
const COMPLETED_MERGE_ITEMS = 'completed_merge_items';
const FAILED_MERGE_ITEMS = 'failed_merge_items';

const _columns = [
    { label: 'Merge Item Number', fieldName: 'Name' },
    { label: 'Merge Item Id', fieldName: 'Id' },
    { label: 'Primary Record', fieldName: 'Primary_Record_Id__c' },
    { label: 'Secondary Record', fieldName: 'Secondary_Record_Id__c' },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

export default class MergeItemList extends LightningElement {
    _recordId;
    _mergeItems;
    _filteredMergeItems;
    _mergeView;
    _columns = _columns;

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

    @wire(getMergeItemsByMergeJobId, { mergeId: '$_recordId' })
    wireMergesItems({ error, data }) {
        if (data) {
            this._mergeItems = data;
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
        }
    }
}
