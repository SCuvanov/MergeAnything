import { LightningElement } from 'lwc';

export default class BulkMergePrimaryContainer extends LightningElement {
    value = '';

    get options() {
        return [
            { label: 'Merges', value: 'option1' },
            { label: 'Merge Items', value: 'option2' },
        ];
    }
}