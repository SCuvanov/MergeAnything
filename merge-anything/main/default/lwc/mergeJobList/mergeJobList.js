import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAllMergeJobs from '@salesforce/apex/BulkMergeController.getAllMergeJobs';
import deleteMergeJob from '@salesforce/apex/BulkMergeController.deleteMergeJob';
import MergeConfirmationModal from 'c/mergeConfirmationModal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const ALL_MERGE_JOBS = 'all_merge_jobs';
const PENDING_MERGE_JOBS = 'pending_merge_jobs';
const IN_PROGRESS_MERGE_JOBS = 'in_progress_merge_jobs';
const COMPLETED_MERGE_JOBS = 'completed_merge_jobs';
const FAILED_MERGE_JOBS = 'failed_merge_jobs';

//EVENTS
const MERGE_JOB_SELECTED_EVENT = 'mergejobselected';

const JOB_BASE_COLUMNS = [
    {
        label: 'Merge Job Number',
        fieldName: 'Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_blank',
        },
    },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created By', fieldName: '_createdByName' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

function decorateMergeJobsForDisplay(jobs) {
    if (!jobs) {
        return jobs;
    }
    return jobs.map((row) => ({
        ...row,
        _createdByName: row.CreatedBy?.Name || '',
    }));
}

function apexErrorMessage(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((e) => e.message).join(', ');
    }
    return error?.body?.message || error?.message || 'Unknown error';
}

export default class MergeJobList extends LightningElement {
    _recordId;
    _mergeJobs;
    _filteredMergeJobs;
    _wiredMergeJobs;
    _selectedMergeJob;
    _mergeView;
    _columns;
    _jobsLoadComplete = false;
    _error;
    _jobCreatedByFilter = '';
    _jobDateFrom = '';
    _jobDateTo = '';

    constructor() {
        super();
        this._mergeJobs = undefined;
        this._filteredMergeJobs = [];
        this._wiredMergeJobs = null;
        this._selectedMergeJob = [];
        this._mergeView = ALL_MERGE_JOBS;
        const boundRowActions = this.computeRowActions.bind(this);
        this._columns = [
            ...JOB_BASE_COLUMNS,
            {
                type: 'action',
                typeAttributes: {
                    rowActions: boundRowActions,
                    menuAlignment: 'auto',
                },
            },
        ];
    }

    computeRowActions(row, doneCallback) {
        const actions = [];
        if (row.Status__c !== 'In Progress') {
            actions.push({ label: 'Delete', name: 'delete', iconName: 'utility:delete' });
        }
        doneCallback(actions);
    }

    get showJobLoading() {
        return !this._jobsLoadComplete && !this._error;
    }

    get showJobError() {
        return this._jobsLoadComplete && this._error;
    }

    get showNoJobsAtAll() {
        return (
            this._jobsLoadComplete &&
            !this._error &&
            (this._mergeJobs === undefined || this._mergeJobs.length === 0)
        );
    }

    get showFilteredJobEmpty() {
        return (this._filteredMergeJobs?.length ?? 0) === 0;
    }

    get emptyJobMessage() {
        const total = this._mergeJobs?.length ?? 0;
        if (total === 0) {
            return 'No merge jobs found. Create one with New Merge Job.';
        }
        return 'No merge jobs match the current filter.';
    }

    get creatorFilterOptions() {
        const base = [{ label: 'All', value: '' }];
        if (!this._mergeJobs?.length) {
            return base;
        }
        const map = new Map();
        this._mergeJobs.forEach((j) => {
            const id = j.CreatedById;
            if (id && !map.has(id)) {
                map.set(id, j.CreatedBy?.Name || id);
            }
        });
        const rest = [...map.entries()]
            .map(([value, label]) => ({ label, value }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        return [...base, ...rest];
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

    @api
    refreshList() {
        if (this._wiredMergeJobs) {
            return refreshApex(this._wiredMergeJobs);
        }
        return Promise.resolve();
    }

    dispatchMergeItemsInvalidated() {
        this.dispatchEvent(
            new CustomEvent('mergeitemsinvalidated', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    @wire(getAllMergeJobs, {})
    wireAllMerges(result) {
        this._wiredMergeJobs = result;
        const { data, error } = result;

        if (error) {
            this._jobsLoadComplete = true;
            this._error = error;
            this._mergeJobs = undefined;
        } else if (data !== undefined) {
            this._jobsLoadComplete = true;
            this._error = undefined;
            this._mergeJobs = decorateMergeJobsForDisplay(data == null ? [] : data);
        }

        this.filterMerges();
    }

    filterMerges() {
        if (!this._mergeJobs) {
            this._filteredMergeJobs = [];
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
        } else {
            this._filteredMergeJobs = this._mergeJobs;
        }

        if (this._jobCreatedByFilter) {
            this._filteredMergeJobs = this._filteredMergeJobs.filter(
                (merge) => merge.CreatedById === this._jobCreatedByFilter,
            );
        }
        if (this._jobDateFrom) {
            const fromMs = new Date(this._jobDateFrom).setHours(0, 0, 0, 0);
            this._filteredMergeJobs = this._filteredMergeJobs.filter((merge) => {
                const d = merge.CreatedDate != null ? new Date(merge.CreatedDate).getTime() : 0;
                return d >= fromMs;
            });
        }
        if (this._jobDateTo) {
            const to = new Date(this._jobDateTo);
            to.setHours(23, 59, 59, 999);
            const toMs = to.getTime();
            this._filteredMergeJobs = this._filteredMergeJobs.filter((merge) => {
                const d = merge.CreatedDate != null ? new Date(merge.CreatedDate).getTime() : 0;
                return d <= toMs;
            });
        }

        this.setSelectedMerge();
    }

    handleCreatorFilterChange(event) {
        this._jobCreatedByFilter = event.detail.value || '';
        this.filterMerges();
    }

    handleJobDateFromChangeNative(event) {
        this._jobDateFrom = event.target.value || '';
        this.filterMerges();
    }

    handleJobDateToChangeNative(event) {
        this._jobDateTo = event.target.value || '';
        this.filterMerges();
    }

    get jobFiltersResetDisabled() {
        return !this._jobCreatedByFilter && !this._jobDateFrom && !this._jobDateTo;
    }

    handleResetJobFilters() {
        this._jobCreatedByFilter = '';
        this._jobDateFrom = '';
        this._jobDateTo = '';
        this.filterMerges();
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

    async handleRowAction(event) {
        const { action, row } = event.detail;
        if (action.name !== 'delete') {
            return;
        }

        const confirmed = await MergeConfirmationModal.open({
            size: 'small',
            headerLabel: 'Delete merge job?',
            bodyMessage: `Permanently delete merge job "${row.Name}" and all of its merge items? You cannot delete a job that has completed merge items until you roll back the job.`,
        });
        if (!confirmed) {
            return;
        }

        const wasSelected = row.Id === this._recordId;

        try {
            await deleteMergeJob({ mergeJobId: row.Id });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Merge job deleted',
                    message: 'The merge job and its items were removed.',
                    variant: 'success',
                }),
            );
            await this.refreshList();
            this.dispatchMergeItemsInvalidated();
            if (wasSelected) {
                this.dispatchEvent(
                    new CustomEvent(MERGE_JOB_SELECTED_EVENT, {
                        detail: undefined,
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        } catch (err) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Delete failed',
                    message: apexErrorMessage(err),
                    variant: 'error',
                    mode: 'sticky',
                }),
            );
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

        const mergeJobSelectedEvent = new CustomEvent(MERGE_JOB_SELECTED_EVENT, {
            detail: this._recordId,
        });
        this.dispatchEvent(mergeJobSelectedEvent);
    }
}
