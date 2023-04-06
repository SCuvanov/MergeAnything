import { wire } from 'lwc';
import LightningModal from 'lightning/modal';
import createMergeItem from '@salesforce/apex/BulkMergeController.createMergeItem';

const SUCCESS = 'success';
const ERROR = 'error';

export default class NewMergeItemModal extends LightningModal {
    _sobjectApiName;
    _primaryRecord;
    _secondaryRecord;

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
    }

    handlePrimaryRecordSelected(event) {
        console.log('Primary Record Selected: ' + event.detail.apiName);
    }

    handleSecondaryRecordSelected(event) {
        console.log('Secondary Record Selected: ' + event.detail.apiName);
    }
}
