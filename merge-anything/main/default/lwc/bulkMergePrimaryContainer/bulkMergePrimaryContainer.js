import { LightningElement } from 'lwc';

//TODO Stop using strings, define final variables or use labels

export default class BulkMergePrimaryContainer extends LightningElement {
    value = 'merges';

    get options() {
        return [
            { label: 'Merges', value: 'merges' },
            { label: 'Merge Items', value: 'merge_items' },
        ];
    }
}