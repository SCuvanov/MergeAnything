import { LightningElement, api, wire } from 'lwc';

export default class RecordSearchableCombobox extends LightningElement {
    @api label;
    @api sobjectApiName;
}
