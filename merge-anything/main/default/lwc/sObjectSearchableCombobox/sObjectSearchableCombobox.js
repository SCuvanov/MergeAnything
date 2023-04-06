import { LightningElement, api, wire } from 'lwc';
import getEntityDefinitionsByLabel from '@salesforce/apex/BulkMergeController.getEntityDefinitionsByLabel';

//UI
const SEARCH_INPUT_ID = 'searchInput';

//EVENTS
const ITEM_SELECTED_EVENT = 'itemselected';

export default class SObjectSearchableCombobox extends LightningElement {
    @api label;

    _searchValue;
    _searchValueTemp;
    _items;
    _showDropdown = false;
    _selectedItemLabel;
    _selectedItemApiName;

    @wire(getEntityDefinitionsByLabel, { label: '$_searchValueTemp' })
    wireEntityDefinitions({ error, data }) {
        if (data) {
            this._items = data;
            this._error = undefined;
        } else if (error) {
            this._error = error;
            this._items = undefined;
        } else {
            this._error = undefined;
            this._items = undefined;
        }
        this.setSearchState();
    }

    handleOnChange(event) {
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            this._searchValue = event.target.value;
        }
        this.setSearchState();
    }

    handleOnCommit(event) {
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            this._searchValueTemp = this._searchValue;
        }
    }

    handleOnClick(event) {
        this._selectedItemLabel = event.currentTarget.dataset.label;
        this._selectedItemApiName = event.currentTarget.dataset.api;

        this.setSelectedItem();
    }

    setSearchState() {
        if (!this._searchValue) {
            this._showDropdown = false;
            this._items = [];
            return;
        }

        if (this._items && this._items.length > 0) {
            this._showDropdown = true;
        } else {
            this._showDropdown = false;
        }
    }

    setSelectedItem() {
        this._searchValue = this._selectedItemLabel;
        this._items = [];
        this._showDropdown = false;

        let selectedItem = {
            label: this._selectedItemLabel,
            apiName: this._selectedItemApiName
        };

        this.dispatchItemSelectedEvent(selectedItem, ITEM_SELECTED_EVENT);
    }

    dispatchItemSelectedEvent(selectedItem, eventName) {
        const mergeJobEvent = new CustomEvent(eventName, {
            detail: selectedItem
        });
        this.dispatchEvent(mergeJobEvent);
    }
}
