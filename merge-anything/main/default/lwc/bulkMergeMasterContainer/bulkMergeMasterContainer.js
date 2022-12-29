import { LightningElement, wire } from 'lwc';
import getNewestMergeId from '@salesforce/apex/BulkMergeController.getNewestMergeId';

export default class BulkMergeMasterContainer extends LightningElement {
    _recordId;
    _error;

    @wire(getNewestMergeId, {})
    wireNewestMergeId({ error, data }) {
        if (data) {
            this._recordId = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._recordId = undefined;
        } else {
            this._error = undefined;
            this._recordId = undefined;
        }
    }

    handleMergeSelection(event) {
        this._recordId = event.detail;
    }
}
