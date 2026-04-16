import { LightningElement, api, wire } from 'lwc';
import getRecordsWithEditableFields from '@salesforce/apex/BulkMergeController.getRecordsWithEditableFields';

//UI
const SEARCH_INPUT_ID = 'searchInput';
const DEBOUNCE_MS = 350;

//EVENTS
const ITEM_SELECTED_EVENT = 'itemselected';

export default class RecordSearchableCombobox extends LightningElement {
    @api label;

    _sobjectApiName;

    @api
    get sobjectApiName() {
        return this._sobjectApiName;
    }
    set sobjectApiName(value) {
        const next = value ? String(value) : undefined;
        const prev = this._sobjectApiName;
        if (next === prev) {
            return;
        }
        if (prev && next !== prev) {
            this.clearSelectionAfterObjectContextChange();
        }
        this._sobjectApiName = next;
    }

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
    /** When true, wire results are ignored and dropdown stays closed (display name must not re-trigger search). */
    _selectionLocked = false;

    get formElementClass() {
        return this._selectionLocked ? 'slds-form-element comboboxselected' : 'slds-form-element';
    }

    @wire(getRecordsWithEditableFields, { sObjectApiName: '$sobjectApiName', name: '$_searchValueTemp' })
    wireRecords({ error, data }) {
        if (this.disabled) {
            this._showDropdown = false;
            return;
        }
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

    resetWhenDisabled() {
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
        this._selectionLocked = false;
        this._searchValue = '';
        this._searchValueTemp = '';
        this._items = [];
        this._showDropdown = false;
        this._selectedItemId = undefined;
        this._selectedItemName = undefined;
    }

    handleOnChange(event) {
        if (this.disabled) {
            return;
        }
        if (event.target.dataset.id === SEARCH_INPUT_ID) {
            const newVal = event.target.value;
            if (this._selectionLocked) {
                const trimmedInput = String(newVal ?? '').trim();
                const sameAsSelection =
                    this._selectedItemName != null &&
                    trimmedInput === String(this._selectedItemName).trim();
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
            this._selectedItemId = undefined;
            this._selectedItemName = undefined;
            this._searchValueTemp = '';
            this.setSearchState();
            this.dispatchItemSelectedEvent({ id: undefined, name: undefined }, ITEM_SELECTED_EVENT);
            return;
        }

        this._debounceTimer = window.setTimeout(() => {
            this._debounceTimer = undefined;
            this.flushWireSearch();
        }, DEBOUNCE_MS);

        this.setSearchState();
    }

    handleOnCommit(event) {
        if (this.disabled || this._selectionLocked) {
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

    /**
     * mousedown (with preventDefault) runs before blur/commit on lightning-input.
     * Using click alone lets blur fire commit → flushWireSearch → list removed before click lands.
     */
    handleOptionMouseDown(event) {
        if (this.disabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this._selectedItemId = event.currentTarget.dataset.id;
        this._selectedItemName = event.currentTarget.dataset.name;

        this.setSelectedItem();
    }

    setSearchState() {
        if (this.disabled) {
            this._showDropdown = false;
            return;
        }
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
        this._searchValue = this._selectedItemName;
        this._searchValueTemp = '';
        this._items = [];
        this._showDropdown = false;

        const selectedItem = {
            id: this._selectedItemId,
            name: this._selectedItemName
        };

        this.dispatchItemSelectedEvent(selectedItem, ITEM_SELECTED_EVENT);
    }

    clearSelectionAfterObjectContextChange() {
        this._selectionLocked = false;
        this._selectedItemId = undefined;
        this._selectedItemName = undefined;
        this._searchValue = '';
        this._searchValueTemp = '';
        this._items = [];
        this._showDropdown = false;
        window.clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
    }

    dispatchItemSelectedEvent(selectedItem, eventName) {
        const itemSelectedEvent = new CustomEvent(eventName, {
            detail: selectedItem
        });
        this.dispatchEvent(itemSelectedEvent);
    }

}
