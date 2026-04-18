import { LightningElement, api, wire } from 'lwc';
import { getRecord, getRecordNotifyChange, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeMergeJob from '@salesforce/apex/BulkMergeController.executeMergeJob';

//FIELDS
import ID_FIELD from '@salesforce/schema/Merge_Job__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge_Job__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge_Job__c.Status__c';

function apexErrorMessage(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((e) => e.message).join(', ');
    }
    return error?.body?.message || error?.message || 'Unknown error';
}

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId;
    _mergeJob;
    _executing = false;

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

    get actionsDisabled() {
        return this._executing;
    }

    handleRefresh() {
        getRecordNotifyChange([{ recordId: this.recordId }]);
    }

    async handleStart() {
        if (!this.recordId || this._executing) {
            return;
        }

        this._executing = true;
        try {
            const result = await executeMergeJob({ mergeJobId: this.recordId });
            const ok = result.jobStatus === 'Completed';
            let message = `${result.successCount} merge item(s) succeeded`;
            if (result.failureCount > 0) {
                message += `, ${result.failureCount} failed`;
            }
            if (result.errors?.length) {
                message += `. ${result.errors.join(' ')}`;
            }
            this.dispatchEvent(
                new ShowToastEvent({
                    title: ok ? 'Merge job completed' : 'Merge job finished with errors',
                    message,
                    variant: ok ? 'success' : 'error',
                    mode: result.errors?.length > 1 ? 'sticky' : 'dismissable',
                })
            );
            getRecordNotifyChange([{ recordId: this.recordId }]);
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Merge job failed',
                    message: apexErrorMessage(error),
                    variant: 'error',
                    mode: 'sticky',
                })
            );
        } finally {
            this._executing = false;
        }
    }
}