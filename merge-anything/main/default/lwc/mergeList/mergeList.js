import { LightningElement, api, wire, track } from 'lwc';
import getAllMerges from '@salesforce/apex/BulkMergeController.getAllMerges';

const ALL_MERGES = 'all_merges';
const PENDING_MERGES = 'pending_merges';
const IN_PROGRESS_MERGES = 'in_progress_merges';
const COMPLETED_MERGES = 'completed_merges';
const FAILED_MERGES = 'failed_merges';

const _columns = [
    { label: 'Merge Number', fieldName: 'Name' },
    { label: 'Merge Id', fieldName: 'Id' },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

export default class MergeList extends LightningElement {
    _recordId;
    _merges;
    _filteredMerges;
    _selectedMerge;
    _mergeView;
    _columns = _columns;

    constructor() {
        super();
        this._merges = [];
        this._filteredMerges = [];
        this._selectedMerge = [];
        this._mergeView = ALL_MERGES;
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

        this.filterMerges(this._mergeView);
    }

    @wire(getAllMerges, {})
    wireAllMerges({ error, data }) {
        if (data) {
            this._merges = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._merges = undefined;
        } else {
            this._error = undefined;
            this._merges = undefined;
        }

        this.filterMerges(this._mergeView);
    }

    filterMerges(value) {
        if (!this._merges) {
            return;
        }

        if (value === undefined || value === null || value === ALL_MERGES) {
            this._filteredMerges = this._merges;
        } else if (value === PENDING_MERGES) {
            this._filteredMerges = this._merges.filter((merge) => merge.Status__c === 'Pending');
        } else if (value === IN_PROGRESS_MERGES) {
            this._filteredMerges = this._merges.filter((merge) => merge.Status__c === 'In Progress');
        } else if (value === COMPLETED_MERGES) {
            this._filteredMerges = this._merges.filter((merge) => merge.Status__c === 'Completed');
        } else if (value === FAILED_MERGES) {
            this._filteredMerges = this._merges.filter((merge) => merge.Status__c === 'Failed');
        }

        this.setSelectedMerge();
    }

    setSelectedMerge() {
        if (
            this._filteredMerges === undefined ||
            this._filteredMerges === null ||
            this._filteredMerges.length === 0 ||
            this._filteredMerges.filter((merge) => merge.Id === this._recordId).length === 0
        ) {
            this._selectedMerge = [];
        } else {
            this._selectedMerge = [this._recordId];
        }
    }

    handleMergeSelection(event) {
        if (
            event.detail.selectedRows === undefined ||
            event.detail.selectedRows === null ||
            event.detail.selectedRows.length === 0
        ) {
            return;
        }

        if (event.detail.selectedRows[0].Id === this._recordId) {
            return;
        }

        this._recordId = event.detail.selectedRows[0].Id;
        this.setSelectedMerge();

        //DISPATCH MERGE SELECTED EVENT
        const mergeSelectedEvent = new CustomEvent('mergeselection', {
            detail: this._recordId,
        });
        this.dispatchEvent(mergeSelectedEvent);
    }
}
