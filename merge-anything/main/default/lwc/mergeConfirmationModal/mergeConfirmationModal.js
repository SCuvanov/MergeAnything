import LightningModal from 'lightning/modal';
import { api } from 'lwc';

export default class MergeConfirmationModal extends LightningModal {
    /** @type {string} */
    @api headerLabel = 'Confirm';
    /** @type {string} */
    @api bodyMessage = '';

    handleCancel() {
        this.close(false);
    }

    handleConfirm() {
        this.close(true);
    }
}
