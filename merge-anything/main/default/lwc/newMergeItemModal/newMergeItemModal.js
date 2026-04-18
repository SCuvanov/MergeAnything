import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import createMergeItem from '@salesforce/apex/BulkMergeController.createMergeItem';
import getMergeFieldRows from '@salesforce/apex/BulkMergeController.getMergeFieldRows';

const SUCCESS = 'success';
const ERROR = 'error';

function apexErrorMessage(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((e) => e.message).join(', ');
    }
    return error?.body?.message || error?.message || 'Unknown error';
}

export default class NewMergeItemModal extends LightningModal {
    /** Merge_Job__c Id from the hosting context (required to save). */
    @api mergeJobId;

    _sobjectApiName;
    _primaryRecord;
    _secondaryRecord;
    _showNewMergeItemSection = true;
    _showFieldMergeSection = false;
    _mergeFields = [];
    _loadingMergeFields = false;
    _savingMergeItem = false;

    get recordsComboboxDisabled() {
        return !this._sobjectApiName;
    }

    get showNewMergeItemSection() {
        return this._showNewMergeItemSection;
    }

    get showFieldMergeSection() {
        return this._showFieldMergeSection;
    }

    get mergeFields() {
        return this._mergeFields;
    }

    get loadingMergeFields() {
        return this._loadingMergeFields;
    }

    get continueDisabled() {
        return this._loadingMergeFields || this._savingMergeItem;
    }

    get finishDisabled() {
        return this._savingMergeItem;
    }

    handleBack() {
        this._showNewMergeItemSection = true;
        this._showFieldMergeSection = false;
        this._mergeFields = [];
    }

    handleCancel() {
        this.close();
    }

    async handleContinue() {
        if (!this._primaryRecord || !this._secondaryRecord) {
            this.showToast({
                title: 'Error',
                message: 'Please select a primary and secondary record',
                variant: 'error'
            });
            return;
        }

        if (this._primaryRecord.id === this._secondaryRecord.id) {
            this.showToast({
                title: 'Error',
                message: 'Primary and secondary records must be different.',
                variant: 'error'
            });
            return;
        }

        this._loadingMergeFields = true;

        try {
            const rows = await getMergeFieldRows({
                sObjectApiName: this._sobjectApiName,
                primaryId: this._primaryRecord.id,
                secondaryId: this._secondaryRecord.id
            });

            if (!rows || rows.length === 0) {
                this.showToast({
                    title: 'Error',
                    message: 'Could not load field values for the selected records.',
                    variant: 'error'
                });
                return;
            }

            this._mergeFields = rows.map((row) => ({
                apiName: row.apiName,
                label: row.label,
                primaryValue: row.primaryValue,
                secondaryValue: row.secondaryValue,
                choosePrimary: true,
                chooseSecondary: false
            }));

            this._showNewMergeItemSection = false;
            this._showFieldMergeSection = true;
        } catch (error) {
            this.showToast({
                title: 'Error',
                message: apexErrorMessage(error),
                variant: 'error'
            });
        } finally {
            this._loadingMergeFields = false;
        }
    }

    async handleFinish() {
        if (!this.mergeJobId) {
            this.showToast({
                title: 'Error',
                message: 'Merge Job is required. Open this app from a Merge Job record.',
                variant: 'error'
            });
            return;
        }

        if (!this._primaryRecord?.id || !this._secondaryRecord?.id || !this._sobjectApiName) {
            this.showToast({
                title: 'Error',
                message: 'Missing object or record selection.',
                variant: 'error'
            });
            return;
        }

        const fieldSelections = this._mergeFields.map((row) => ({
            fieldApiName: row.apiName,
            usePrimary: row.choosePrimary
        }));

        this._savingMergeItem = true;

        try {
            const mergeItem = await createMergeItem({
                mergeJobId: this.mergeJobId,
                sObjectApiName: this._sobjectApiName,
                primaryRecordId: this._primaryRecord.id,
                secondaryRecordId: this._secondaryRecord.id,
                fieldSelections
            });

            if (mergeItem) {
                this.close({ status: SUCCESS, mergeItem });
            }
        } catch (error) {
            this.showToast({
                title: 'Error',
                message: apexErrorMessage(error),
                variant: 'error'
            });
        } finally {
            this._savingMergeItem = false;
        }
    }

    handleSObjectSelected(event) {
        const api = event.detail?.apiName;
        const previous = this._sobjectApiName;
        this._sobjectApiName = api || undefined;

        if (!this._sobjectApiName || (previous && previous !== this._sobjectApiName)) {
            this._primaryRecord = undefined;
            this._secondaryRecord = undefined;
            this._mergeFields = [];
        }
    }

    handlePrimaryRecordSelected(event) {
        if (event.detail?.id) {
            this._primaryRecord = {
                id: event.detail.id,
                name: event.detail.name
            };
        } else {
            this._primaryRecord = undefined;
        }
        this._mergeFields = [];
    }

    handleSecondaryRecordSelected(event) {
        if (event.detail?.id) {
            this._secondaryRecord = {
                id: event.detail.id,
                name: event.detail.name
            };
        } else {
            this._secondaryRecord = undefined;
        }
        this._mergeFields = [];
    }

    handleFieldChoice(event) {
        const apiName = event.target.dataset.field;
        const source = event.target.dataset.source;

        this._mergeFields = this._mergeFields.map((row) => {
            if (row.apiName !== apiName) {
                return row;
            }
            return {
                ...row,
                choosePrimary: source === 'primary',
                chooseSecondary: source === 'secondary'
            };
        });
    }
}
