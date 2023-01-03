import { api } from 'lwc';
import LightningModal from 'lightning/modal';

const SUCCESS = 'success';

export default class NewMergeModal extends LightningModal {
    handleNo() {
        this.close();
    }

    handleYes() {
        this.close(SUCCESS);
    }
}