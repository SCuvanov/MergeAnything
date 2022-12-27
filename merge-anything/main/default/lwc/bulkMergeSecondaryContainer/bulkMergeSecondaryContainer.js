import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

import ID_FIELD from '@salesforce/schema/Merge__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge__c.Status__c';

export default class BulkMergeSecondaryContainer extends LightningElement {

    @api merge;
    _merge;

    get merge() {
        return this._merge;
    }
    set merge(value) {
        this.setAttribute('merge', value);
        this._merge = value;
    }

    //TODO: Add some type of true/false to show a message if there is no record (merge) selected
}