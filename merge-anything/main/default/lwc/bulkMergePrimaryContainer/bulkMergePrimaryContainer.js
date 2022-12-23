import { LightningElement } from 'lwc';

//TODO: Stop using strings, define final variables or use labels
//TODO: Maybe we shouldn't allow the add merge button unless we have a valid merge selected.
const MERGES = 'merges';
const MERGE_ITEMS = 'merge_items';
const NEW_MERGE_BTN_ID = 'lightning-button[data-id=newMergeBtn]';
const ADD_MERGE_ITEM_BTN_ID = 'lightning-button[data-id=addMergeItemBtn]';

export default class BulkMergePrimaryContainer extends LightningElement {

    //TODO: Should we get the newest Merge by CREATED DATE && Status? As a start point?
    
    _mergeOption;

    constructor () {
        super();
        this._mergeOption = MERGES;
    }

    get _mergeOptions() {
        return [
            { label: 'Merges', value: MERGES },
            { label: 'Merge Items', value: MERGE_ITEMS },
        ];
    }

    handleMergeOption(event) {
        this._mergeOption = event.detail.value;
        this.toggleMergeOptionView(this._mergeOption);
    }

    handleNewMerge(event) {
        console.log('New Merge Clicked');
    }

    handleAddMergeItem(event) {
        console.log('Add Merge Item Clicked');
    }

    toggleMergeOptionView(value) {
        //TODO: Need to handle hiding/showing the listviews properly
        
        if(value === MERGES) {
            this.template.querySelector(NEW_MERGE_BTN_ID).hidden = false;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = true;
        } else {
            this.template.querySelector(NEW_MERGE_BTN_ID).hidden = true;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = false;
        }
    }
}