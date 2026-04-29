import { LightningElement, api, wire } from 'lwc';
import { getRecord, getRecordNotifyChange, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import executeMergeJob from '@salesforce/apex/BulkMergeController.executeMergeJob';
import startMergeJobInBackground from '@salesforce/apex/BulkMergeController.startMergeJobInBackground';
import rollbackMergeJob from '@salesforce/apex/BulkMergeController.rollbackMergeJob';
import validateMergeJob from '@salesforce/apex/BulkMergeController.validateMergeJob';
import getMergeItemCountByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemCountByMergeJobId';
import getCompletedMergeItemCountByMergeJobId from '@salesforce/apex/BulkMergeController.getCompletedMergeItemCountByMergeJobId';
import getMergeItemStatusCountsByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemStatusCountsByMergeJobId';
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

const STATUS_COLORS = {
    Pending: '#fe9339',
    'In Progress': '#1b96ff',
    Completed: '#2e844a',
    Failed: '#ba0517',
};

function statusToColor(status) {
    if (!status) {
        return '#706e6b';
    }
    return STATUS_COLORS[status] || '#706e6b';
}

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId;
    _mergeJob;
    _executing = false;
    _wiredMergeItemCount;
    _wiredCompletedMergeItemCount;
    _wiredMergeItemStatusCounts;

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

    @wire(getMergeItemStatusCountsByMergeJobId, { mergeJobId: '$recordId' })
    wiredMergeItemStatusCounts(result) {
        this._wiredMergeItemStatusCounts = result;
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

    @api
    refreshMergeItemCount() {
        const promises = [];
        if (this._wiredMergeItemCount) {
            promises.push(refreshApex(this._wiredMergeItemCount));
        }
        if (this._wiredCompletedMergeItemCount) {
            promises.push(refreshApex(this._wiredCompletedMergeItemCount));
        }
        if (this._wiredMergeItemStatusCounts) {
            promises.push(refreshApex(this._wiredMergeItemStatusCounts));
        }
        return promises.length ? Promise.all(promises) : Promise.resolve();
    }

    get mergeItemStatusRows() {
        if (!this.recordId || !this._wiredMergeItemStatusCounts) {
            return [];
        }
        const { data, error } = this._wiredMergeItemStatusCounts;
        if (error || data == null) {
            return [];
        }
        return data;
    }

    get mergeItemStatusTotalCount() {
        return this.mergeItemStatusRows.reduce((sum, row) => sum + (row.itemCount || 0), 0);
    }

    get showMergeItemStatusLoading() {
        return (
            !!this.recordId &&
            this._wiredMergeItemStatusCounts &&
            !this._wiredMergeItemStatusCounts.data &&
            !this._wiredMergeItemStatusCounts.error
        );
    }

    get showMergeItemStatusEmpty() {
        const w = this._wiredMergeItemStatusCounts;
        return (
            !!this.recordId &&
            w &&
            !w.error &&
            w.data !== undefined &&
            this.mergeItemStatusTotalCount === 0
        );
    }

    get mergeItemStatusChartErrorMessage() {
        const w = this._wiredMergeItemStatusCounts;
        if (!w?.error) {
            return '';
        }
        return apexErrorMessage(w.error);
    }

    get mergeItemStatusPieStyle() {
        const rows = this.mergeItemStatusRows;
        const total = rows.reduce((sum, row) => sum + (row.itemCount || 0), 0);
        if (total === 0) {
            return 'background-color: var(--lwc-colorBackgroundAlt, #f3f3f3);';
        }
        let acc = 0;
        const parts = [];
        for (const row of rows) {
            const n = row.itemCount || 0;
            if (n <= 0) {
                continue;
            }
            const startPct = (acc / total) * 100;
            acc += n;
            const endPct = (acc / total) * 100;
            parts.push(`${statusToColor(row.status)} ${startPct}% ${endPct}%`);
        }
        if (parts.length === 0) {
            return 'background-color: var(--lwc-colorBackgroundAlt, #f3f3f3);';
        }
        return `background-image: conic-gradient(${parts.join(', ')});`;
    }

    get mergeItemStatusPieTitle() {
        const rows = this.mergeItemStatusRows;
        const total = rows.reduce((sum, row) => sum + (row.itemCount || 0), 0);
        return `${total} merge item${total === 1 ? '' : 's'} total`;
    }

    get mergeItemStatusLegendRows() {
        return this.mergeItemStatusRows.map((row, idx) => {
            const n = row.itemCount || 0;
            const st = row.status || '';
            return {
                rowKey: `legend-${idx}-${st}`,
                status: st,
                legendLabel: `${st}: ${n}`,
                swatchStyle: `background-color: ${statusToColor(st)}`,
            };
        });
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

    get mergeJobStatusTextClass() {
        const base = 'slds-text-heading_small slds-m-top_xx-small';
        const s = this._mergeJobStatus;
        if (s === 'Completed') {
            return `${base} slds-text-color_success`;
        }
        if (s === 'Failed') {
            return `${base} slds-text-color_error`;
        }
        if (s === 'In Progress') {
            return `${base} slds-text-color_default`;
        }
        if (s === 'Pending') {
            return `${base} slds-text-color_weak`;
        }
        return base;
    }

    get isJobCompleted() {
        return this._mergeJobStatus === 'Completed';
    }

    get isJobInProgress() {
        return this._mergeJobStatus === 'In Progress';
    }

    get startButtonsDisabled() {
        return this._executing || this.isJobInProgress;
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
        if (!this.recordId || this._executing || this.isJobCompleted || this.isJobInProgress) {
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

    async handleStartInBackground() {
        if (!this.recordId || this._executing || this.isJobCompleted || this.isJobInProgress) {
            return;
        }

        const confirmed = await MergeConfirmationModal.open({
            size: 'small',
            headerLabel: 'Run merge in the background?',
            bodyMessage:
                'Pending or failed items will be processed in chunks. You will get an in-app notification when the job finishes. If the run cannot start (for example validation failures), details are saved on the merge job in Async Last Error. Continue?',
        });
        if (!confirmed) {
            return;
        }

        this._executing = true;
        try {
            await startMergeJobInBackground({ mergeJobId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Merge queued',
                    message:
                        'Background processing has started. Watch for a notification when it completes; check Async Last Error on the job if nothing runs.',
                    variant: 'success',
                })
            );
            getRecordNotifyChange([{ recordId: this.recordId }]);
            this.refreshMergeItemCount();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Could not queue merge',
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