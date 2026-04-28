import { LightningElement, api, wire } from 'lwc';
import { getRecord, getRecordNotifyChange, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import executeMergeJob from '@salesforce/apex/BulkMergeController.executeMergeJob';
import rollbackMergeJob from '@salesforce/apex/BulkMergeController.rollbackMergeJob';
import validateMergeJob from '@salesforce/apex/BulkMergeController.validateMergeJob';
import getMergeItemCountByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemCountByMergeJobId';
import getCompletedMergeItemCountByMergeJobId from '@salesforce/apex/BulkMergeController.getCompletedMergeItemCountByMergeJobId';
import MergeConfirmationModal from 'c/mergeConfirmationModal';
import MergePreviewModal from 'c/mergePreviewModal';
import MergeValidationResultsModal from 'c/mergeValidationResultsModal';

//FIELDS
import ID_FIELD from '@salesforce/schema/Merge_Job__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge_Job__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge_Job__c.Status__c';
import LINK_FIELD from '@salesforce/schema/Merge_Job__c.Link__c';

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
    _wiredMergeItemCount;
    _wiredCompletedMergeItemCount;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [ID_FIELD, NAME_FIELD, STATUS_FIELD, LINK_FIELD],
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

    @wire(getMergeItemCountByMergeJobId, { mergeJobId: '$recordId' })
    wiredMergeItemCount(result) {
        this._wiredMergeItemCount = result;
    }

    @wire(getCompletedMergeItemCountByMergeJobId, { mergeJobId: '$recordId' })
    wiredCompletedMergeItemCount(result) {
        this._wiredCompletedMergeItemCount = result;
    }

    get mergeItemCountDisplay() {
        if (!this.recordId || !this._wiredMergeItemCount) {
            return '';
        }
        const { data, error } = this._wiredMergeItemCount;
        if (error) {
            return '';
        }
        if (data !== undefined && data !== null) {
            const n = data;
            return `${n} merge item${n === 1 ? '' : 's'}`;
        }
        return '';
    }

    get completedMergeItemCount() {
        if (!this.recordId || !this._wiredCompletedMergeItemCount) {
            return 0;
        }
        const { data, error } = this._wiredCompletedMergeItemCount;
        if (error || data === undefined || data === null) {
            return 0;
        }
        return data;
    }

    refreshMergeItemCount() {
        const promises = [];
        if (this._wiredMergeItemCount) {
            promises.push(refreshApex(this._wiredMergeItemCount));
        }
        if (this._wiredCompletedMergeItemCount) {
            promises.push(refreshApex(this._wiredCompletedMergeItemCount));
        }
        return promises.length ? Promise.all(promises) : Promise.resolve();
    }

    get _mergeJobId() {
        return getFieldValue(this._mergeJob, ID_FIELD);
    }

    get _mergeJobName() {
        return getFieldValue(this._mergeJob, NAME_FIELD);
    }

    get _mergeJobLink() {
        return getFieldValue(this._mergeJob, LINK_FIELD);
    }

    get _mergeJobStatus() {
        return getFieldValue(this._mergeJob, STATUS_FIELD);
    }

    get isJobCompleted() {
        return this._mergeJobStatus === 'Completed';
    }

    get showRunActions() {
        return this._mergeJob && !this.isJobCompleted;
    }

    get showRollbackAction() {
        return (
            this._mergeJob &&
            (this.isJobCompleted || (this._mergeJobStatus === 'Failed' && this.completedMergeItemCount > 0))
        );
    }

    handleRefresh() {
        getRecordNotifyChange([{ recordId: this.recordId }]);
        this.refreshMergeItemCount();
    }

    async handlePreview() {
        if (!this.recordId || this._executing) {
            return;
        }
        this._executing = true;
        try {
            await MergePreviewModal.open({
                size: 'large',
                mergeJobId: this.recordId,
            });
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Preview unavailable',
                    message: apexErrorMessage(error),
                    variant: 'error',
                })
            );
        } finally {
            this._executing = false;
        }
    }

    async handleValidate() {
        if (!this.recordId || this._executing || this.isJobCompleted) {
            return;
        }
        this._executing = true;
        try {
            const result = await validateMergeJob({ mergeJobId: this.recordId });
            await MergeValidationResultsModal.open({
                size: 'large',
                result,
            });
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation failed',
                    message: apexErrorMessage(error),
                    variant: 'error',
                    mode: 'sticky',
                })
            );
        } finally {
            this._executing = false;
        }
    }

    async handleStart() {
        if (!this.recordId || this._executing || this.isJobCompleted) {
            return;
        }

        const confirmed = await MergeConfirmationModal.open({
            size: 'small',
            headerLabel: 'Start merge job?',
            bodyMessage:
                'Pending or failed merge items will be merged into their primary records, and secondary records will be deleted. Completed items are skipped. Duplicate primaries, records used on another pending merge item, or records changed after the merge item was created will block the run. Use Validate to check first. Rollback can undo completed items (including after a partial failure). Continue?',
        });
        if (!confirmed) {
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
            this.refreshMergeItemCount();
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

    async handleRollback() {
        if (!this.recordId || this._executing || !this.isJobCompleted) {
            return;
        }

        const confirmed = await MergeConfirmationModal.open({
            size: 'small',
            headerLabel: 'Roll back Merge Job',
            bodyMessage:
                'Primary records will be restored from the saved snapshot, secondary records will be undeleted from the recycle bin, and completed items will return to Pending (failed items are left as-is). The merge job will return to Pending. Continue?',
        });
        if (!confirmed) {
            return;
        }

        this._executing = true;
        try {
            await rollbackMergeJob({ mergeJobId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Merge job rolled back',
                    message: 'Primary records were restored and secondary records were undeleted.',
                    variant: 'success',
                })
            );
            getRecordNotifyChange([{ recordId: this.recordId }]);
            this.refreshMergeItemCount();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Rollback failed',
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