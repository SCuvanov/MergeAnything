import { wire } from 'lwc';
import LightningModal from 'lightning/modal';
import createMergeItem from '@salesforce/apex/BulkMergeController.createMergeItem';
import getEntityDefinitionsByLabel from '@salesforce/apex/BulkMergeController.getEntityDefinitionsByLabel';
//import getAllEntityDefinitions from '@salesforce/apex/BulkMergeController.getAllEntityDefinitions';

//UI
const ENTITY_DEFINITION_INPUT_ID = 'entityDefinitionInput';
const PRIMARY_RECORD_INPUT_ID = 'primaryRecordInput';
const SECONDARY_RECORD_INPUT_ID = 'secondaryRecordInput';

const SUCCESS = 'success';
const ERROR = 'error';

export default class NewMergeItemModal extends LightningModal {
    _primarySearchValue;
    _secondarySearchValue;
    _entityDefinitionSearchValueTemp;
    _entityDefinitionSearchValue;
    _entityDefinition;
    _entityDefinitions = [];
    _primaryRecord;
    _secondaryRecord;

    handleCancel() {
        this.close();
    }

    handleSave() {
        createMergeItem()
            .then((result) => {
                if (result && result.mergeItem) {
                    this.close({ status: SUCCESS, mergeItem: result.mergeItem });
                }
            })
            .catch((error) => {
                this.close({ status: ERROR, error: error });
            });
    }

    @wire(getEntityDefinitionsByLabel, { label: '$_entityDefinitionSearchValueTemp' })
    wireEntityDefinitions({ error, data }) {
        console.log(data);

        if (data) {
            this._entityDefinitions = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._entityDefinitions = undefined;
        } else {
            this._error = undefined;
            this._entityDefinitions = undefined;
        }
    }

    /*
    @wire(getAllEntityDefinitions, {})
    wireAllEntityDefinitions({ error, data }) {
        if (data) {
            let entityDefinitionOptions = [];
            data.forEach((ele) => {
                entityDefinitionOptions.push({
                    label: ele.MasterLabel + '($ele.QualifiedApiName)',
                    value: ele.QualifiedApiName
                });
            });

            this._entityDefinitions = entityDefinitionOptions;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._entityDefinitions = undefined;
        } else {
            this._error = undefined;
            this._entityDefinitions = undefined;
        }
    }
    

    handleEntityDefinitionChange(event) {
        this._entityDefinition = event.detail.value;
        console.log(this._entityDefinition);
    }
    */

    handleInputChange(event) {
        if (event.target.dataset.id === ENTITY_DEFINITION_INPUT_ID) {
            this._entityDefinitionSearchValue = event.target.value;
        } else if (event.target.dataset.id === PRIMARY_RECORD_INPUT_ID) {
            this._primarySearchValue = event.target.value;
        } else if (event.target.dataset.id === SECONDARY_RECORD_INPUT_ID) {
            this._secondarySearchValue = event.target.value;
        }
    }

    handleKeyUp(event) {
        const isEnterKey = event.keyCode === 13;
        if (!isEnterKey) {
            return;
        }

        if (event.target.dataset.id === ENTITY_DEFINITION_INPUT_ID) {
            this._entityDefinitionSearchValueTemp = this._entityDefinitionSearchValue;
            console.log(this._entityDefinitionSearchValue);
        } else if (event.target.dataset.id === PRIMARY_RECORD_INPUT_ID) {
            console.log(this._primarySearchValue);
        } else if (event.target.dataset.id === SECONDARY_RECORD_INPUT_ID) {
            console.log(this._secondarySearchValue);
        }
    }
}
