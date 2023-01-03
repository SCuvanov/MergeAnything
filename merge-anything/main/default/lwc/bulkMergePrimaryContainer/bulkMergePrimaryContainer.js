import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import NewMergeJobModal from 'c/newMergeJobModal';

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

//UI
const NEW_MERGE_JOB_BTN_ID = 'lightning-button[data-id=newMergeJobBtn]';
const ADD_MERGE_ITEM_BTN_ID = 'lightning-button[data-id=addMergeItemBtn]';

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

    constructor() {
        super();
        this._mergeOption = MERGE_JOBS;
        this._mergeView = ALL_MERGE_JOBS;
        this._showMergeJobList = true;
    }

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [ID_FIELD, NAME_FIELD, STATUS_FIELD],
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
            { label: 'Merge Items', value: MERGE_ITEMS },
        ];
    }

    get _mergeViews() {
        let mergeViews = [];
        if (this._mergeOption === MERGE_JOBS) {
            mergeViews = [
                { label: 'All Merge Jobs', value: ALL_MERGE_JOBS },
                { label: 'Pending Merge Jobs', value: PENDING_MERGE_JOBS },
                { label: 'In Progress Merge Jobs', value: IN_PROGRESS_MERGE_JOBS },
                { label: 'Completed Merge Jobs', value: COMPLETED_MERGE_JOBS },
                { label: 'Failed Merge Jobs', value: FAILED_MERGE_JOBS },
            ];
        } else if (this._mergeOption === MERGE_ITEMS) {
            mergeViews = [
                { label: 'All Merge Items', value: ALL_MERGE_ITEMS },
                { label: 'Pending Merge Items', value: PENDING_MERGE_ITEMS },
                { label: 'In Progress Merge Items', value: IN_PROGRESS_MERGE_ITEMS },
                { label: 'Completed Merge Items', value: COMPLETED_MERGE_ITEMS },
                { label: 'Failed Merge Items', value: FAILED_MERGE_ITEMS },
            ];
        }
        return mergeViews;
    }

    handleMergeOption(event) {
        this._mergeOption = event.detail.value;
        this.toggleMergeOptionView(this._mergeOption);
    }

    async handleNewMerge() {
        const result = await NewMergeJobModal.open({
            size: 'small',
        });

        if (result === SUCCESS) {
            this.createNewMerge();
        }
    }

    async handleAddMergeItem() {
        console.log('Add Merge Item Clicked');
    }

    handleMergeView(event) {
        this._mergeView = event.detail.value;
    }

    handleMergeJobSelection(event) {
        const mergeJobSelectedEvent = new CustomEvent('mergejobselected', {
            detail: event.detail,
        });
        this.dispatchEvent(mergeJobSelectedEvent);
    }

    toggleMergeOptionView(value) {
        if (value === MERGE_JOBS) {
            this.template.querySelector(NEW_MERGE_JOB_BTN_ID).hidden = false;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = true;
            this._mergeView = ALL_MERGE_JOBS;
            this._showMergeJobList = true;
        } else {
            this.template.querySelector(NEW_MERGE_JOB_BTN_ID).hidden = true;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = false;
            this._mergeView = ALL_MERGE_ITEMS;
            this._showMergeJobList = false;
        }
    }

    createNewMerge() {
        //TODO: Write a controller method to create a new merge, refresh the list, and select the new merge
        //TODO: Perhaps use the refreshApex method for newestMerge, might need to create an event to refresh the list
    }
}
