import { LightningElement } from 'lwc';

//TODO: Stop using strings, define final variables or use labels
//TODO: Maybe we shouldn't allow the add merge button unless we have a valid merge selected.

export default class BulkMergePrimaryContainer extends LightningElement {
    value = 'merges';

    get options() {
        return [
            { label: 'Merges', value: 'merges' },
            { label: 'Merge Items', value: 'merge_items' },
        ];
    }

    handleMergeOption(event) {
        this.value = event.detail.value;

        if(this.value === 'merges') {
            this.template.querySelector('lightning-button[data-id=newMergeBtn]').hidden = false;
            this.template.querySelector('lightning-button[data-id=addMergeItemBtn]').hidden = true;
        } else {
            this.template.querySelector('lightning-button[data-id=newMergeBtn]').hidden = true;
            this.template.querySelector('lightning-button[data-id=addMergeItemBtn]').hidden = false;

            //TODO: Add / Remove if there is a valid merge.
            this.template.querySelector('lightning-button[data-id=addMergeItemBtn]').disabled = true; 
        }
    }

    handleNewMerge(event) {
        console.log('New Merge Clicked');
    }

    handleAddMergeItem(event) {
        console.log('Add Merge Item Clicked');
    }
}