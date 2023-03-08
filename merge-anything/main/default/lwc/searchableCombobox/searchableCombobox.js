import { LightningElement, api, wire } from 'lwc';
import getEntityDefinitionsByLabel from '@salesforce/apex/BulkMergeController.getEntityDefinitionsByLabel';

//UI
const SEARCH_INPUT_ID = 'searchInput';

export default class SearchableCombobox extends LightningElement {
    @api label;

    _searchValue;
    _searchValueTemp;
    _items;
    _showDropdown = false;
    _selectedItemLabel;
    _selectedItemApiName;

    //TODO: Can we pass in dynamic wire functions?
    //TODO: Handle List Item Select
    //TODO: Pass List Item Value back to Parent
    //TODO: Is it possible to expand the modal to show the list items?

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

    set;
}
