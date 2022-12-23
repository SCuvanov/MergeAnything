import { LightningElement, api } from 'lwc';

const MERGES = 'merges';
const MERGE_ITEMS = 'merge_items';

export default class BulkMergeOptionContainer extends LightningElement {

    @api mergeOption;
    _mergeOption;

    constructor () {
        super();
    }

    get mergeOption() {
        return this._mergeOption;
    }
    set mergeOption(value) {
        this.setAttribute('mergeOption', value);
        this._mergeOption = value;
        this.handleMergeOption(this._mergeOption);
    }

    handleMergeOption(value) {
        //TODO: Hide/Show values based on _mergeOption
    }
}