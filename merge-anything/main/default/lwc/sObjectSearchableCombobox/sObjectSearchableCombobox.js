import { LightningElement, api, wire } from 'lwc';
import getEntityDefinitionsByLabel from '@salesforce/apex/BulkMergeController.getEntityDefinitionsByLabel';

//UI
const SEARCH_INPUT_ID = 'searchInput';
const DEBOUNCE_MS = 350;

//EVENTS
const ITEM_SELECTED_EVENT = 'itemselected';

export default class SObjectSearchableCombobox extends LightningElement {
    @api label;

    _searchValue;
    _searchValueTemp;
    _items;
    _showDropdown = false;
    _debounceTimer;
    _selectedItemLabel;
    _selectedItemApiName;
    _selectionLocked = false;

    get formElementClass() {
        return this._selectionLocked ? 'slds-form-element comboboxselected' : 'slds-form-element';
    }

    @wire(getEntityDefinitionsByLabel, { label: '$_searchValueTemp' })
    wireEntityDefinitions({ error, data }) {
        if (this._selectionLocked) {
            this._items = [];
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

    handleOnChange(event) {
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            const newVal = event.target.value;
            if (this._selectionLocked) {
                const trimmedInput = String(newVal ?? '').trim();
                const sameAsSelection =
                    this._selectedItemLabel != null &&
                    trimmedInput === String(this._selectedItemLabel).trim();
                if (sameAsSelection) {
                    window.clearTimeout(this._debounceTimer);
                    this._debounceTimer = undefined;
                    return;
                }
                if (newVal) {
                    this._selectionLocked = false;
                }
            }
            this._searchValue = newVal;
        }

        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;

        if (!this._searchValue) {
            this._selectionLocked = false;
            this._selectedItemLabel = undefined;
            this._selectedItemApiName = undefined;
            this._searchValueTemp = '';
            this.setSearchState();
            this.dispatchItemSelectedEvent(
                { label: undefined, apiName: undefined },
                ITEM_SELECTED_EVENT
            );
            return;
        }

        this._debounceTimer = window.setTimeout(() => {
            this._debounceTimer = undefined;
            this.flushWireSearch();
        }, DEBOUNCE_MS);

        this.setSearchState();
    }

    handleOnCommit(event) {
        if (this._selectionLocked) {
            return;
        }
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            window.clearTimeout(this._debounceTimer);
            this._debounceTimer = undefined;
            this.flushWireSearch();
        }
    }

    flushWireSearch() {
        if (this._selectionLocked) {
            return;
        }
        this._items = [];
        this._showDropdown = false;
        this._searchValueTemp = this._searchValue;
        this.setSearchState();
    }

    disconnectedCallback() {
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
    }

    handleOptionMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();
        this._selectedItemLabel = event.currentTarget.dataset.label;
        this._selectedItemApiName = event.currentTarget.dataset.api;

        this.setSelectedItem();
    }

    setSearchState() {
        if (this._selectionLocked) {
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
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;

        this._selectionLocked = true;
        this._searchValue = this._selectedItemLabel;
        this._searchValueTemp = '';
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
