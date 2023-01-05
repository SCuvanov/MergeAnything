import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import createMergeJob from '@salesforce/apex/BulkMergeController.createMergeJob';

const ERROR = 'error';
const SUCCESS = 'success';

export default class NewMergeJobModal extends LightningModal {
    handleNo() {
        this.close();
    }

    handleYes() {
        createMergeJob()
            .then((result) => {
                if (result && result.mergeJob) {
                    this.close({ status: SUCCESS, mergeJob: result.mergeJob });
                }
            })
            .catch((error) => {
                this.close({ status: ERROR, error: error });
            });
    }
}
