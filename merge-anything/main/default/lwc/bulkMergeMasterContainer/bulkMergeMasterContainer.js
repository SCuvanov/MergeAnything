import { LightningElement, wire } from "lwc";
import getNewestMergeJobId from "@salesforce/apex/BulkMergeController.getNewestMergeJobId";

export default class BulkMergeMasterContainer extends LightningElement {
    _recordId;
    _error;

    @wire(getNewestMergeJobId, {})
    wireNewestMergeJobId({ error, data }) {
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

    handleMergeJobSelected(event) {
        this._recordId = event.detail;
    }

    handleMergeJobCreated(event) {
        this._recordId = event.detail;
    }
}
