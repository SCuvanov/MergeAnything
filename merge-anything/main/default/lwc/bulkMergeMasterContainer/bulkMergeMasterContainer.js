import { LightningElement, wire } from 'lwc';
import getNewestMerge from '@salesforce/apex/BulkMergeController.getNewestMerge';

export default class BulkMergeMasterContainer extends LightningElement {

    _merge;

    @wire(getNewestMerge, { })
    wireNewestMerge({ error, data }){
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
    
    get merge(){
        return this._merge;
    }
}