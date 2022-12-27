import { LightningElement, wire } from "lwc";
import { getRecord } from "lightning/uiRecordApi";
import getNewestMergeId from "@salesforce/apex/BulkMergeController.getNewestMergeId";

//USE LABELS / LABEL .JS FILE
import ID_FIELD from "@salesforce/schema/Merge__c.Id";
import NAME_FIELD from "@salesforce/schema/Merge__c.Name";
import STATUS_FIELD from "@salesforce/schema/Merge__c.Status__c";

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

  @wire(getRecord, {
    recordId: "$_recordId",
    fields: [ID_FIELD, NAME_FIELD, STATUS_FIELD],
  })
  _merge;
}
