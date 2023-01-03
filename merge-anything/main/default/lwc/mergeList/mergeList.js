import { LightningElement, api, wire } from 'lwc';
import getAllMergeJobs from '@salesforce/apex/BulkMergeController.getAllMergeJobs';

const ALL_MERGE_JOBS = 'all_merge_jobs';
const PENDING_MERGE_JOBS = 'pending_merge_jobs';
const IN_PROGRESS_MERGE_JOBS = 'in_progress_merge_jobs';
const COMPLETED_MERGE_JOBS = 'completed_merge_jobs';
const FAILED_MERGE_JOBS = 'failed_merge_jobs';

const _columns = [
    { label: 'Merge Job Number', fieldName: 'Name' },
    { label: 'Merge Job Id', fieldName: 'Id' },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

export default class MergeList extends LightningElement {
    _recordId;
    _mergeJobs;
    _filteredMergeJobs;
    _selectedMergeJob;
    _mergeView;
    _columns = _columns;

    constructor() {
        super();
        this._mergeJobs = [];
        this._filteredMergeJobs = [];
        this._selectedMergeJob = [];
        this._mergeView = ALL_MERGE_JOBS;
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

        this.filterMerges();
    }

    @wire(getAllMergeJobs, {})
    wireAllMerges({ error, data }) {
        if (data) {
            this._mergeJobs = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._mergeJobs = undefined;
        } else {
            this._error = undefined;
            this._mergeJobs = undefined;
        }

        this.filterMerges();
    }

    filterMerges() {
        if (!this._mergeJobs) {
            return;
        }

        if (this._mergeView === undefined || this._mergeView === null || this._mergeView === ALL_MERGE_JOBS) {
            this._filteredMergeJobs = this._mergeJobs;
        } else if (this._mergeView === PENDING_MERGE_JOBS) {
            this._filteredMergeJobs = this._mergeJobs.filter((merge) => merge.Status__c === 'Pending');
        } else if (this._mergeView === IN_PROGRESS_MERGE_JOBS) {
            this._filteredMergeJobs = this._mergeJobs.filter((merge) => merge.Status__c === 'In Progress');
        } else if (this._mergeView === COMPLETED_MERGE_JOBS) {
            this._filteredMergeJobs = this._mergeJobs.filter((merge) => merge.Status__c === 'Completed');
        } else if (this._mergeView === FAILED_MERGE_JOBS) {
            this._filteredMergeJobs = this._mergeJobs.filter((merge) => merge.Status__c === 'Failed');
        }

        this.setSelectedMerge();
    }

    setSelectedMerge() {
        if (
            this._filteredMergeJobs === undefined ||
            this._filteredMergeJobs === null ||
            this._filteredMergeJobs.length === 0 ||
            this._filteredMergeJobs.filter((merge) => merge.Id === this._recordId).length === 0
        ) {
            this._selectedMergeJob = [];
        } else {
            this._selectedMergeJob = [this._recordId];
        }
    }

    handleMergeJobSelection(event) {
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
        const mergeJobSelectedEvent = new CustomEvent('mergejobselected', {
            detail: this._recordId,
        });
        this.dispatchEvent(mergeJobSelectedEvent);
    }
}
