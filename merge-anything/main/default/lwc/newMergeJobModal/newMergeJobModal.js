import { api } from 'lwc';
import LightningModal from 'lightning/modal';

const SUCCESS = 'success';

export default class NewMergeJobModal extends LightningModal {
    handleNo() {
        this.close();
    }

    handleYes() {
        this.close(SUCCESS);
    }
}
