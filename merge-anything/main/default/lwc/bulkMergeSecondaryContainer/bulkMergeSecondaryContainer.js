import { LightningElement, api, wire } from 'lwc';
import { getRecord, getRecordNotifyChange, getFieldValue } from 'lightning/uiRecordApi';

//FIELDS
import ID_FIELD from '@salesforce/schema/Merge__c.Id';
import NAME_FIELD from '@salesforce/schema/Merge__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge__c.Status__c';

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId;
    _merge;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [ID_FIELD, NAME_FIELD, STATUS_FIELD],
    })
    wireMerge({ error, data }) {
        if (data) {
            this._merge = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._merge = undefined;
        } else {
            this._error = undefined;
            this._merge = undefined;
        }
    }

    get _mergeId() {
        return getFieldValue(this._merge, ID_FIELD);
    }

    get _mergeName() {
        return getFieldValue(this._merge, NAME_FIELD);
    }

    get _mergeStatus() {
        return getFieldValue(this._merge, STATUS_FIELD);
    }

    handleRefresh(event) {
        getRecordNotifyChange([{ recordId: this.recordId }]);
    }

    handleStart(event) {
        console.log('starting');
    }
}
