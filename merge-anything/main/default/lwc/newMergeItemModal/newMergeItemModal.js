import { api } from 'lwc';
import LightningModal from 'lightning/modal';

const SUCCESS = 'success';

export default class NewMergeItemModal extends LightningModal {
    handleCancel() {
        this.close();
    }

    handleSave() {
        this.close(SUCCESS);
        //TODO: Pass a merge item object to the close method
    }
}
