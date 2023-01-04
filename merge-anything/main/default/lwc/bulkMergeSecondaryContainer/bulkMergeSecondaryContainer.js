import { LightningElement, api, wire } from 'lwc';
import { getRecord, getRecordNotifyChange, getFieldValue } from 'lightning/uiRecordApi';

//FIELDS
import ID_FIELD from '@salesforce/schema/Merge_Job__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge_Job__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge_Job__c.Status__c';

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId;
    _mergeJob;

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

    get _mergeJobId() {
        return getFieldValue(this._mergeJob, ID_FIELD);
    }

    get _mergeJobName() {
        return getFieldValue(this._mergeJob, NAME_FIELD);
    }

    get _mergeJobStatus() {
        return getFieldValue(this._mergeJob, STATUS_FIELD);
    }

    handleRefresh(event) {
        getRecordNotifyChange([{ recordId: this.recordId }]);
    }

    handleStart(event) {}
}