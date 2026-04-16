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
        this._sobjectApiName = event.detail.apiName;
        console.log('SObject Selected: ' + this._sobjectApiName);
    }

    handlePrimaryRecordSelected(event) {
        this._primaryRecord = {
            id: event.detail.id,
            name: event.detail.name
        };
        console.log('Primary Record Selected: ' + event.detail.id);
        console.log('Primary Record Name: ' + event.detail.name);
    }

    handleSecondaryRecordSelected(event) {
        this._secondaryRecord = {
            id: event.detail.id,
            name: event.detail.name
        };
        console.log('Secondary Record Selected: ' + event.detail.id);
        console.log('Secondary Record Name: ' + event.detail.name);
    }
}
