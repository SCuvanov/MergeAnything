import { LightningElement, api, wire } from "lwc";
import { getRecordNotifyChange, getFieldValue } from "lightning/uiRecordApi";

import ID_FIELD from "@salesforce/schema/Merge__c.Id";
import NAME_FIELD from "@salesforce/schema/Merge__c.Name";
import STATUS_FIELD from "@salesforce/schema/Merge__c.Status__c";

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId;
    @api merge;
    _merge;
    _recordId;

    get merge() {
        return this._merge;
    }
    set merge(value) {
        this.setAttribute("merge", value);
        this._merge = value;
    }

    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this.setAttribute("recordId", value);
        this._recordId = value;
    }

    get _mergeId() {
        return getFieldValue(this._merge.data, ID_FIELD);
    }

    get _mergeName() {
        return getFieldValue(this._merge.data, NAME_FIELD);
    }

    get _mergeStatus() {
        return getFieldValue(this._merge.data, STATUS_FIELD);
    }

    handleRefresh(event) {
        getRecordNotifyChange([{ recordId: this._recordId }]);
    }

    handleStart(event) {
        console.log("starting");
    }
}
