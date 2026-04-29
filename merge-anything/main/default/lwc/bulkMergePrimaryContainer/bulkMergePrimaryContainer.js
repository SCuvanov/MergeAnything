import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createMergeJob from '@salesforce/apex/BulkMergeController.createMergeJob';
import NewMergeJobModal from 'c/newMergeJobModal';
import NewMergeItemModal from 'c/newMergeItemModal';
import BulkMergeItemsModal from 'c/bulkMergeItemsModal';

const MERGE_JOBS = 'merge_jobs';
const MERGE_ITEMS = 'merge_items';
const ALL_MERGE_JOBS = 'all_merge_jobs';
const PENDING_MERGE_JOBS = 'pending_merge_jobs';
const IN_PROGRESS_MERGE_JOBS = 'in_progress_merge_jobs';
const COMPLETED_MERGE_JOBS = 'completed_merge_jobs';
const FAILED_MERGE_JOBS = 'failed_merge_jobs';
const ALL_MERGE_ITEMS = 'all_merge_items';
const PENDING_MERGE_ITEMS = 'pending_merge_items';
const IN_PROGRESS_MERGE_ITEMS = 'in_progress_merge_items';
const COMPLETED_MERGE_ITEMS = 'completed_merge_items';
const FAILED_MERGE_ITEMS = 'failed_merge_items';
const SUCCESS = 'success';

//EVENTS
const MERGE_JOB_CREATED_EVENT = 'mergejobcreated';
const MERGE_JOB_SELECTED_EVENT = 'mergejobselected';

//FIELDS
import ID_FIELD from '@salesforce/schema/Merge_Job__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge_Job__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge_Job__c.Status__c';

export default class BulkMergePrimaryContainer extends LightningElement {
    @api recordId;
    _mergeJob;
    _mergeOption;
    _mergeView;
    _showMergeJobList;
    _itemObjectFilter = '';
    _itemErrorsOnly = false;

    constructor() {
        super();
        this._mergeOption = MERGE_JOBS;
        this._mergeView = ALL_MERGE_JOBS;
        this._showMergeJobList = true;
    }

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [ID_FIELD, NAME_FIELD, STATUS_FIELD]
    })
    wireMergeJob({ error, data }) {
        if (data) {
            this._mergeJob = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._mergeJob = undefined;
        } else {
            this._error = undefined;
            this._mergeJob = undefined;
        }
    }

    get _mergeOptions() {
        return [
            { label: 'Merge Jobs', value: MERGE_JOBS },
            { label: 'Merge Items', value: MERGE_ITEMS }
        ];
    }

    /** Only mount merge job table so it does not receive merge-item view values (and vice versa). */
    get showMergeJobListSection() {
        return this._showMergeJobList === true;
    }

    get showMergeItemListSection() {
        return this._showMergeJobList === false;
    }

    get _mergeViews() {
        let mergeViews = [];
        if (this._mergeOption === MERGE_JOBS) {
            mergeViews = [
                { label: 'All Merge Jobs', value: ALL_MERGE_JOBS },
                { label: 'Pending Merge Jobs', value: PENDING_MERGE_JOBS },
                { label: 'In Progress Merge Jobs', value: IN_PROGRESS_MERGE_JOBS },
                { label: 'Completed Merge Jobs', value: COMPLETED_MERGE_JOBS },
                { label: 'Failed Merge Jobs', value: FAILED_MERGE_JOBS }
            ];
        } else if (this._mergeOption === MERGE_ITEMS) {
            mergeViews = [
                { label: 'All Merge Items', value: ALL_MERGE_ITEMS },
                { label: 'Pending Merge Items', value: PENDING_MERGE_ITEMS },
                { label: 'In Progress Merge Items', value: IN_PROGRESS_MERGE_ITEMS },
                { label: 'Completed Merge Items', value: COMPLETED_MERGE_ITEMS },
                { label: 'Failed Merge Items', value: FAILED_MERGE_ITEMS }
            ];
        }
        return mergeViews;
    }

    get mergeJobStatus() {
        return getFieldValue(this._mergeJob, STATUS_FIELD);
    }

    get isMergeJobCompleted() {
        return this.mergeJobStatus === 'Completed';
    }

    get hideNewMergeJobButton() {
        return !this._showMergeJobList;
    }

    get hideNewMergeItemButton() {
        return this._showMergeJobList || this.isMergeJobCompleted;
    }

    get hideBulkImportButton() {
        return this.hideNewMergeItemButton;
    }

    handleMergeOption(event) {
        this._mergeOption = event.detail.value;
        this.toggleMergeOptionView(this._mergeOption);
    }

    async handleNewMergeJob() {
        const result = await NewMergeJobModal.open({
            size: 'small'
        });

        if (!result) {
            return;
        }

        if (result.status === SUCCESS && result.mergeJob) {
            this.dispatchMergeJobEvent(result.mergeJob.Id, MERGE_JOB_CREATED_EVENT);
            this.showToastEvent(
                null,
                'Merge Job "{0}" was created.',
                [
                    {
                        url: result.mergeJob.Link__c,
                        label: result.mergeJob.Name
                    }
                ],
                'success'
            );
        }

        //TODO: HANDLE ERROR
    }

    async handleNewMergeItem() {
        if (this.isMergeJobCompleted) {
            return;
        }
        const result = await NewMergeItemModal.open({
            size: 'small',
            mergeJobId: this.recordId
        });

        if (!result) {
            return;
        }

        if (result.status === SUCCESS && result.mergeItem) {
            this.showToastEvent(
                null,
                'Merge Item "{0}" was created.',
                [
                    {
                        url: result.mergeItem.Link__c,
                        label: result.mergeItem.Name
                    }
                ],
                'success'
            );
            const mergeItemList = this.template.querySelector('c-merge-item-list');
            if (mergeItemList) {
                mergeItemList.refreshList();
            }
        }

        //TODO: HANDLE ERROR
    }

    async handleBulkImportCsv() {
        if (this.isMergeJobCompleted || !this.recordId) {
            return;
        }
        const result = await BulkMergeItemsModal.open({
            size: 'large',
            mergeJobId: this.recordId,
        });
        if (!result || result.status !== SUCCESS) {
            return;
        }
        const mergeItemList = this.template.querySelector('c-merge-item-list');
        if (mergeItemList) {
            await mergeItemList.refreshList();
        }
    }

    handleItemObjectFilterInput(event) {
        this._itemObjectFilter = event.target.value;
    }

    handleItemErrorsOnlyChange(event) {
        this._itemErrorsOnly = event.target.checked;
    }

    handleMergeView(event) {
        this._mergeView = event.detail.value;
    }

    createMergeJob() {
        createMergeJob()
            .then((result) => {
                if (result && result.mergeJob && result.mergeJob.Id) {
                    this.dispatchMergeJobEvent(result.mergeJob.Id, MERGE_JOB_CREATED_EVENT);
                    this.showToastEvent(
                        null,
                        'Merge Job "{0}" was created.',
                        [
                            {
                                url: result.mergeJob.Link__c,
                                label: result.mergeJob.Name
                            }
                        ],
                        'success'
                    );
                }
            })
            .catch((error) => {
                console.log(error);
                this.showToastEvent('Error', 'Something went wrong: ' + error, 'error');
            });
    }

    handleMergeJobSelected(event) {
        this.dispatchMergeJobEvent(event.detail, MERGE_JOB_SELECTED_EVENT);
    }

    toggleMergeOptionView(value) {
        if (value === MERGE_JOBS) {
            this._mergeView = ALL_MERGE_JOBS;
            this._showMergeJobList = true;
        } else {
            this._mergeView = ALL_MERGE_ITEMS;
            this._showMergeJobList = false;
            this._itemObjectFilter = '';
            this._itemErrorsOnly = false;
        }
    }

    dispatchMergeJobEvent(mergeJobId, eventName) {
        const mergeJobEvent = new CustomEvent(eventName, {
            detail: mergeJobId
        });
        this.dispatchEvent(mergeJobEvent);
    }

    showToastEvent(title, message, messageData, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            messageData: messageData,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}