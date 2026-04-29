import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';

export default class MergeConfirmationModal extends LightningModal {
    /** @type {string} */
    @api headerLabel = 'Confirm';
    /** @type {string} */
    @api bodyMessage = '';
    /** When true, user must check the acknowledgement box before Continue is enabled. */
    @api requireCheckbox = false;
    /** Label shown beside the acknowledgement checkbox when requireCheckbox is true. */
    @api checkboxLabel = '';

    @track _acknowledged = false;

    connectedCallback() {
        this._acknowledged = false;
    }

    get acknowledgementText() {
        return (
            this.checkboxLabel ||
            'I understand the description above and want to continue with this action.'
        );
    }

    get continueDisabled() {
        return !!(this.requireCheckbox && !this._acknowledged);
    }

    handleAcknowledgementChange(event) {
        this._acknowledged = event.target.checked;
    }

    handleCancel() {
        this.close(false);
    }

    handleConfirm() {
        if (this.continueDisabled) {
            return;
        }
        this.close(true);
    }
}