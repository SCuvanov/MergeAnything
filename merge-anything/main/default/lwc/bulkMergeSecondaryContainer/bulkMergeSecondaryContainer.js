import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

import NAME_FIELD from '@salesforce/schema/Merge__c.Name';
import STATUS_FIELD from '@salesforce/schema/Merge__c.Status__c';

export default class BulkMergeSecondaryContainer extends LightningElement {
    @api recordId = 'a013J000005AQLGQA4';

    @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD, STATUS_FIELD] })
    merge;

    get recordName() {
        return getFieldValue(this.merge.data, NAME_FIELD);
    }

    get recordStatus(){
        return getFieldValue(this.merge.data, STATUS_FIELD);
    }
}