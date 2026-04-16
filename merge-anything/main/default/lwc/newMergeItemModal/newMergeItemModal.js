import LightningModal from 'lightning/modal';
import createMergeItem from '@salesforce/apex/BulkMergeController.createMergeItem';

const SUCCESS = 'success';
const ERROR = 'error';

export default class NewMergeItemModal extends LightningModal {
    _sobjectApiName;
    _primaryRecord;
    _secondaryRecord;

    get recordsComboboxDisabled() {
        return !this._sobjectApiName;
    }

    get showFieldMergeSection() {
        const primaryId = this._primaryRecord?.id;
        const secondaryId = this._secondaryRecord?.id;
        return Boolean(primaryId && secondaryId && primaryId !== secondaryId);
    }

    get fieldMergeRecordSummary() {
        const pName = this._primaryRecord?.name;
        const sName = this._secondaryRecord?.name;
        if (!pName || !sName) {
            return '';
        }
        return `Primary: ${pName} — Secondary: ${sName}`;
    }

    handleCancel() {
        this.close();
    }

    handleSave() {
        createMergeItem()
            .then((result) => {
                if (result && result.mergeItem) {
                    this.close({ status: SUCCESS, mergeItem: result.mergeItem });
                }
            })
            .catch((error) => {
                this.close({ status: ERROR, error: error });
            });
    }

    handleSObjectSelected(event) {
        const api = event.detail?.apiName;
        const previous = this._sobjectApiName;
        this._sobjectApiName = api || undefined;

        if (!this._sobjectApiName || (previous && previous !== this._sobjectApiName)) {
            this._primaryRecord = undefined;
            this._secondaryRecord = undefined;
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
    }
}
