import { LightningElement, api } from "lwc";

const MERGES = "merges";
const MERGE_ITEMS = "merge_items";
const ALL_MERGES = "all_merges";
const PENDING_MERGES = "pending_merges";
const IN_PROGRESS_MERGES = "in_progress_merges";
const COMPLETED_MERGES = "completed_merges";
const FAILED_MERGES = "failed_merges";
const ALL_MERGE_ITEMS = "all_merge_items";
const PENDING_MERGE_ITEMS = "pending_merge_items";
const IN_PROGRESS_MERGE_ITEMS = "in_progress_merge_items";
const COMPLETED_MERGE_ITEMS = "completed_merge_items";
const FAILED_MERGE_ITEMS = "failed_merge_items";

//UI
const NEW_MERGE_BTN_ID = "lightning-button[data-id=newMergeBtn]";
const ADD_MERGE_ITEM_BTN_ID = "lightning-button[data-id=addMergeItemBtn]";

export default class BulkMergePrimaryContainer extends LightningElement {
    @api merge;
    _merge;
    _mergeOption;
    _mergeView;

    constructor() {
        super();
        this._mergeOption = MERGES;
        this._mergeView = ALL_MERGES;
    }

    get merge() {
        return this._merge;
    }
    set merge(value) {
        this.setAttribute("merge", value);
        this._merge = value;
    }

    get _mergeOptions() {
        return [
            { label: "Merges", value: MERGES },
            { label: "Merge Items", value: MERGE_ITEMS },
        ];
    }

    get _mergeViews() {
        let mergeViews = [];
        if (this._mergeOption === MERGES) {
            mergeViews = [
                { label: "All Merges", value: ALL_MERGES },
                { label: "Pending Merges", value: PENDING_MERGES },
                { label: "In Progress Merges", value: IN_PROGRESS_MERGES },
                { label: "Completed Merges", value: COMPLETED_MERGES },
                { label: "Failed Merges", value: FAILED_MERGES },
            ];
        } else if (this._mergeOption === MERGE_ITEMS) {
            mergeViews = [
                { label: "All Merge Items", value: ALL_MERGE_ITEMS },
                { label: "Pending Merge Items", value: PENDING_MERGE_ITEMS },
                { label: "In Progress Merge Items", value: IN_PROGRESS_MERGE_ITEMS },
                { label: "Completed Merge Items", value: COMPLETED_MERGE_ITEMS },
                { label: "Failed Merge Items", value: FAILED_MERGE_ITEMS },
            ];
        }
        return mergeViews;
    }

    handleMergeOption(event) {
        this._mergeOption = event.detail.value;
        this.toggleMergeOptionView(this._mergeOption);
    }

    handleNewMerge(event) {
        console.log("New Merge Clicked");
    }

    handleAddMergeItem(event) {
        console.log("Add Merge Item Clicked");
    }

    handleMergeView(event) {
        this._mergeView = event.detail.value;
    }

    toggleMergeOptionView(value) {
        if (value === MERGES) {
            this.template.querySelector(NEW_MERGE_BTN_ID).hidden = false;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = true;
            this._mergeView = ALL_MERGES;
        } else {
            this.template.querySelector(NEW_MERGE_BTN_ID).hidden = true;
            this.template.querySelector(ADD_MERGE_ITEM_BTN_ID).hidden = false;
            this._mergeView = ALL_MERGE_ITEMS;
        }
    }
}
