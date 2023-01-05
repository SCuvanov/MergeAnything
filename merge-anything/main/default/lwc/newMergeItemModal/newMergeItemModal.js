import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import createMergeItem from '@salesforce/apex/BulkMergeController.createMergeItem';

const SUCCESS = 'success';

export default class NewMergeItemModal extends LightningModal {
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
}
