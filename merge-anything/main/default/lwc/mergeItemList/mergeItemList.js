import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { getRecord, getFieldValue, getRecordNotifyChange } from 'lightning/uiRecordApi';
import getMergeItemsByMergeJobId from '@salesforce/apex/BulkMergeController.getMergeItemsByMergeJobId';
import rollbackMergeItem from '@salesforce/apex/BulkMergeController.rollbackMergeItem';
import deleteMergeItem from '@salesforce/apex/BulkMergeController.deleteMergeItem';
import MergeConfirmationModal from 'c/mergeConfirmationModal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import MERGE_JOB_STATUS_FIELD from '@salesforce/schema/Merge_Job__c.Status__c';

const ALL_MERGE_ITEMS = 'all_merge_items';
const PENDING_MERGE_ITEMS = 'pending_merge_items';
const IN_PROGRESS_MERGE_ITEMS = 'in_progress_merge_items';
const COMPLETED_MERGE_ITEMS = 'completed_merge_items';
const FAILED_MERGE_ITEMS = 'failed_merge_items';

const BASE_COLUMNS = [
    {
        label: 'Merge Item Number',
        fieldName: 'Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_blank',
        },
    },
    {
        label: 'Record Object',
        fieldName: 'Record_Object__c',
        type: 'text',
    },
    {
        label: 'Merge Action',
        fieldName: '_mergeActionDisplay',
        type: 'text',
    },
    {
        label: 'Primary Record',
        fieldName: 'Primary_Record_Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: '_primaryRecordLabel' },
            target: '_blank',
        },
    },
    {
        label: 'Secondary Record',
        fieldName: 'Secondary_Record_Link__c',
        type: 'url',
        typeAttributes: {
            label: { fieldName: '_secondaryRecordLabel' },
            target: '_blank',
        },
    },
    { label: 'Status', fieldName: 'Status__c' },
    { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
];

function mergeActionDisplay(apiValue) {
    if (apiValue === 'Merge_and_Keep') {
        return 'Merge and Keep';
    }
    if (!apiValue || apiValue === 'Merge_Reparent_and_Delete') {
        return 'Merge, Reparent and Delete';
    }
    return apiValue;
}

function decorateMergeItemsForDisplay(items) {
    if (!items) {
        return items;
    }
    return items.map((row) => ({
        ...row,
        _mergeActionDisplay: mergeActionDisplay(row.Merge_Action__c),
        _primaryRecordLabel: row.Primary_Record_Name__c || row.Primary_Record_Id__c || '',
        _secondaryRecordLabel: row.Secondary_Record_Name__c || row.Secondary_Record_Id__c || '',
    }));
}

function apexErrorMessage(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((e) => e.message).join(', ');
    }
    return error?.body?.message || error?.message || 'Unknown error';
}

export default class MergeItemList extends LightningElement {
    _recordId;
    _mergeItems;
    _filteredMergeItems;
    _mergeView;
    _wiredMergeItems;
    _itemsLoadComplete = false;
    _error;
    _mergeJobCompleted = false;
    _mergeJobAllowsItemRollback = false;
    _mergeJobInProgress = false;
    _tableColumns;
    _itemObjectFilter = '';
    _itemErrorsOnly = false;

    constructor() {
        super();
        this._mergeItems = undefined;
        this._filteredMergeItems = [];
        this._mergeView = ALL_MERGE_ITEMS;
        const boundRowActions = this.computeRowActions.bind(this);
        this._tableColumns = [
            ...BASE_COLUMNS,
            {
                type: 'action',
                typeAttributes: {
                    rowActions: boundRowActions,
                    menuAlignment: 'auto',
                },
            },
        ];
    }

    @wire(getRecord, {
        recordId: '$_recordId',
        fields: [MERGE_JOB_STATUS_FIELD],
    })
    wiredMergeJobForActions({ data }) {
        if (!data) {
            this._mergeJobCompleted = false;
            this._mergeJobAllowsItemRollback = false;
            this._mergeJobInProgress = false;
            return;
        }
        const status = getFieldValue(data, MERGE_JOB_STATUS_FIELD);
        this._mergeJobCompleted = status === 'Completed';
        this._mergeJobAllowsItemRollback = status === 'Completed' || status === 'Failed';
        this._mergeJobInProgress = status === 'In Progress';
    }

    get showNoMergeJob() {
        return !this._recordId;
    }

    get showItemLoading() {
        return !!this._recordId && !this._itemsLoadComplete && !this._error;
    }

    get showItemError() {
        return !!this._recordId && this._itemsLoadComplete && this._error;
    }

    get showItemEmpty() {
        return (
            !!this._recordId &&
            this._itemsLoadComplete &&
            !this._error &&
            this._filteredMergeItems.length === 0
        );
    }

    get emptyItemMessage() {
        if (!this._recordId) {
            return 'Select a merge job to view its merge items.';
        }
        const total = this._mergeItems?.length ?? 0;
        if (total === 0) {
            return 'There are no merge items for this merge job yet. Add one with New Merge Item.';
        }
        return 'No merge items match the current filter.';
    }

    computeRowActions(row, doneCallback) {
        const actions = [];
        if (this._mergeJobAllowsItemRollback && row.Status__c === 'Completed') {
            actions.push({ label: 'Rollback', name: 'rollback' });
        }
        if (!this._mergeJobInProgress && row.Status__c !== 'Completed') {
            actions.push({ label: 'Delete', name: 'delete', iconName: 'utility:delete' });
        }
        doneCallback(actions);
    }

    dispatchMergeItemsInvalidated() {
        this.dispatchEvent(
            new CustomEvent('mergeitemsinvalidated', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    async handleRowAction(event) {
        const { action, row } = event.detail;
        if (action.name === 'delete') {
            const confirmed = await MergeConfirmationModal.open({
                size: 'small',
                headerLabel: 'Delete merge item?',
                bodyMessage: `Permanently delete merge item "${row.Name}"? This removes the line only; it does not merge or roll back records.`,
            });
            if (!confirmed) {
                return;
            }
            try {
                await deleteMergeItem({ mergeItemId: row.Id });
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Merge item deleted',
                        message: 'The merge item was removed.',
                        variant: 'success',
                    }),
                );
                await this.refreshList();
                this.dispatchMergeItemsInvalidated();
                if (this._recordId) {
                    getRecordNotifyChange([{ recordId: this._recordId }]);
                }
            } catch (error) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Delete failed',
                        message: apexErrorMessage(error),
                        variant: 'error',
                        mode: 'sticky',
                    }),
                );
            }
            return;
        }

        if (action.name !== 'rollback') {
            return;
        }

        const confirmed = await MergeConfirmationModal.open({
            size: 'small',
            headerLabel: 'Roll back merge item?',
            bodyMessage: `Restore the primary record and undelete the secondary for "${row.Name}"? If the merge job finished with errors, only completed line items can be rolled back individually.`,
            requireCheckbox: true,
            checkboxLabel:
                'I understand this will restore the primary and undelete the secondary for this line, and I want to roll back this merge item.',
        });
        if (!confirmed) {
            return;
        }

        try {
            await rollbackMergeItem({ mergeItemId: row.Id });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Merge item rolled back',
                    message: 'The primary record was restored and the secondary was undeleted.',
                    variant: 'success',
                })
            );
            await this.refreshList();
            this.dispatchMergeItemsInvalidated();
            if (this._recordId) {
                getRecordNotifyChange([{ recordId: this._recordId }]);
            }
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Rollback failed',
                    message: apexErrorMessage(error),
                    variant: 'error',
                    mode: 'sticky',
                })
            );
        }
    }

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        this.setAttribute('record-id', value);
        this._recordId = value;
        if (!value) {
            this._mergeItems = [];
            this._filteredMergeItems = [];
            this._itemsLoadComplete = true;
            this._error = undefined;
            this._mergeJobCompleted = false;
            this._mergeJobAllowsItemRollback = false;
            this._mergeJobInProgress = false;
        } else {
            this._itemsLoadComplete = false;
        }
    }

    @api
    get mergeView() {
        return this._mergeView;
    }

    set mergeView(value) {
        this.setAttribute('merge-view', value);
        this._mergeView = value;

        this.filterMergeItems();
    }

    @api
    get itemObjectFilter() {
        return this._itemObjectFilter;
    }

    set itemObjectFilter(value) {
        this.setAttribute('item-object-filter', value);
        this._itemObjectFilter = value ?? '';
        this.filterMergeItems();
    }

    @api
    get itemErrorsOnly() {
        return this._itemErrorsOnly;
    }

    set itemErrorsOnly(value) {
        const flag = value === true || value === 'true';
        this.setAttribute('item-errors-only', flag);
        this._itemErrorsOnly = flag;
        this.filterMergeItems();
    }

    @wire(getMergeItemsByMergeJobId, { mergeJobId: '$_recordId' })
    wireMergesItems(result) {
        this._wiredMergeItems = result;
        if (!this._recordId) {
            return;
        }
        const { error, data } = result;
        if (error) {
            this._itemsLoadComplete = true;
            this._error = error;
            this._mergeItems = undefined;
        } else if (data !== undefined) {
            this._itemsLoadComplete = true;
            this._error = undefined;
            this._mergeItems = decorateMergeItemsForDisplay(data == null ? [] : data);
        }

        this.filterMergeItems();
    }

    /**
     * Re-runs the wired Apex so the datatable reflects new or updated merge items.
     */
    @api
    refreshList() {
        if (this._wiredMergeItems) {
            return refreshApex(this._wiredMergeItems);
        }
        return Promise.resolve();
    }

    filterMergeItems() {
        if (!this._mergeItems) {
            this._filteredMergeItems = [];
            return;
        }

        if (this._mergeView === undefined || this._mergeView === null || this._mergeView === ALL_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems;
        } else if (this._mergeView === PENDING_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Pending');
        } else if (this._mergeView === IN_PROGRESS_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'In Progress');
        } else if (this._mergeView === COMPLETED_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Completed');
        } else if (this._mergeView === FAILED_MERGE_ITEMS) {
            this._filteredMergeItems = this._mergeItems.filter((merge) => merge.Status__c === 'Failed');
        } else {
            this._filteredMergeItems = this._mergeItems;
        }

        const q = (this._itemObjectFilter || '').trim().toLowerCase();
        if (q) {
            this._filteredMergeItems = this._filteredMergeItems.filter((row) =>
                (row.Record_Object__c || '').toLowerCase().includes(q)
            );
        }
        if (this._itemErrorsOnly) {
            this._filteredMergeItems = this._filteredMergeItems.filter((row) => {
                const err = (row.Merge_Error__c || '').trim();
                return err.length > 0 || row.Status__c === 'Failed';
            });
        }
    }
}