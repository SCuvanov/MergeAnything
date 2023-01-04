import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAllMergeJobs from '@salesforce/apex/BulkMergeController.getAllMergeJobs';

const ALL_MERGE_JOBS = 'all_merge_jobs';
const PENDING_MERGE_JOBS = 'pending_merge_jobs';
const IN_PROGRESS_MERGE_JOBS = 'in_progress_merge_jobs';
const COMPLETED_MERGE_JOBS = 'completed_merge_jobs';
const FAILED_MERGE_JOBS = 'failed_merge_jobs';

//EVENTS
const MERGE_JOB_SELECTED_EVENT = 'mergejobselected';

const _columns = [
    { label: 'Merge Job Number', fieldName: 'Name' },
    { label: 'Merge Job Id', fieldName: 'Id' },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' }
];

export default class MergeJobList extends LightningElement {
    _recordId;
    _mergeJobs;
    _filteredMergeJobs;
    _wiredMergeJobs;
    _selectedMergeJob;
    _mergeView;
    _columns = _columns;

    constructor() {
        super();
        this._mergeJobs = [];
        this._filteredMergeJobs = [];
        this._wiredMergeJobs = null;
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

        if (this._wiredMergeJobs && this._wiredMergeJobs.data) {
            refreshApex(this._wiredMergeJobs);
        }
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
    wireAllMerges(result) {
        this._wiredMergeJobs = result;

        if (result.data) {
            this._mergeJobs = result.data;
            this._error = undefined;
        } else if (result.error) {
            this._error = result.error;
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

    handleMergeJobSelected(event) {
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
        const mergeJobSelectedEvent = new CustomEvent(MERGE_JOB_SELECTED_EVENT, {
            detail: this._recordId
        });
        this.dispatchEvent(mergeJobSelectedEvent);
    }
}
