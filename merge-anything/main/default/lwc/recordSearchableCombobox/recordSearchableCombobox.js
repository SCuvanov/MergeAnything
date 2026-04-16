import { LightningElement, api, wire } from 'lwc';
import getRecordsWithEditableFields from '@salesforce/apex/BulkMergeController.getRecordsWithEditableFields';

//UI
const SEARCH_INPUT_ID = 'searchInput';
const DEBOUNCE_MS = 350;

//EVENTS
const ITEM_SELECTED_EVENT = 'itemselected';

export default class RecordSearchableCombobox extends LightningElement {
    @api label;
    @api sobjectApiName;

    _disabled = false;

    @api
    get disabled() {
        return this._disabled;
    }
    set disabled(value) {
        const next = Boolean(value);
        if (next === this._disabled) {
            return;
        }
        this._disabled = next;
        if (next) {
            this.resetWhenDisabled();
        }
    }

    _searchValue;
    _searchValueTemp;
    _items;
    _showDropdown = false;
    _debounceTimer;
    _selectedItemId;
    _selectedItemName;

    @wire(getRecordsWithEditableFields, { sObjectApiName: '$sobjectApiName', name: '$_searchValueTemp' })
    wireRecords({ error, data }) {
        if (this.disabled) {
            this._showDropdown = false;
            return;
        }
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

    resetWhenDisabled() {
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
        this._searchValue = '';
        this._searchValueTemp = '';
        this._items = [];
        this._showDropdown = false;
    }

    handleOnChange(event) {
        if (this.disabled) {
            return;
        }
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            this._searchValue = event.target.value;
        }

        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;

        if (!this._searchValue) {
            this._searchValueTemp = '';
            this.setSearchState();
            return;
        }

        this._debounceTimer = window.setTimeout(() => {
            this._debounceTimer = undefined;
            this.flushWireSearch();
        }, DEBOUNCE_MS);

        this.setSearchState();
    }

    handleOnCommit(event) {
        if (this.disabled) {
            return;
        }
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            window.clearTimeout(this._debounceTimer);
            this._debounceTimer = undefined;
            this.flushWireSearch();
        }
    }

    flushWireSearch() {
        this._items = [];
        this._showDropdown = false;
        this._searchValueTemp = this._searchValue;
        this.setSearchState();
    }

    disconnectedCallback() {
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
    }

    handleOnClick(event) {
        if (this.disabled) {
            return;
        }
        this._selectedItemId = event.currentTarget.dataset.id;
        this._selectedItemName = event.currentTarget.dataset.name;

        this.setSelectedItem();
    }

    setSearchState() {
        if (this.disabled) {
            this._showDropdown = false;
            return;
        }
        if (!this._searchValue) {
            this._showDropdown = false;
            this._items = [];
            return;
        }

        if (this._searchValue !== this._searchValueTemp) {
            this._showDropdown = false;
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
        this._searchValueTemp = this._selectedItemName;
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
