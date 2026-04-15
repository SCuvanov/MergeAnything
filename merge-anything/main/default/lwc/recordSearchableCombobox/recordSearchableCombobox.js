import { LightningElement, api, wire } from 'lwc';
import getRecordsWithEditableFields from '@salesforce/apex/BulkMergeController.getRecordsWithEditableFields';

//UI
const SEARCH_INPUT_ID = 'searchInput';

//EVENTS
const ITEM_SELECTED_EVENT = 'itemselected';

export default class RecordSearchableCombobox extends LightningElement {
    @api label;
    @api sobjectApiName;

    _searchValue;
    _searchValueTemp;
    _items;
    _showDropdown = false;
    _selectedItemId;
    _selectedItemName;

    @wire(getRecordsWithEditableFields, { sObjectApiName: '$sobjectApiName', name: '$_searchValueTemp' })
    wireRecords({ error, data }) {
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
        this._selectedItemId = event.currentTarget.dataset.id;
        this._selectedItemName = event.currentTarget.dataset.name;

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
        this._searchValue = this._selectedItemName;
        this._items = [];
        this._showDropdown = false;

        const selectedItem = {
            id: this._selectedItemId,
            name: this._selectedItemName
        };

        this.dispatchItemSelectedEvent(selectedItem, ITEM_SELECTED_EVENT);
    }

    dispatchItemSelectedEvent(selectedItem, eventName) {
        const itemSelectedEvent = new CustomEvent(eventName, {
            detail: selectedItem
        });
        this.dispatchEvent(itemSelectedEvent);
    }

}
