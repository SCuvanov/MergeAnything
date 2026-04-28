import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';
import getMergeJobFieldPreview from '@salesforce/apex/BulkMergeController.getMergeJobFieldPreview';

const PREVIEW_COLUMNS = [
    { label: 'Field', fieldName: 'label', wrapText: true },
    { label: 'Primary', fieldName: 'primaryValue', wrapText: true },
    { label: 'Secondary', fieldName: 'secondaryValue', wrapText: true },
    { label: 'Merged', fieldName: 'mergedValue', wrapText: true },
    { label: 'Source', fieldName: 'valueSource', wrapText: true, initialWidth: 120 },
];

export default class MergePreviewModal extends LightningModal {
    @api mergeJobId;

    @track sections = [];
    @track loadError;

    previewColumns = PREVIEW_COLUMNS;

    async connectedCallback() {
        if (!this.mergeJobId) {
            this.loadError = 'Missing merge job.';
            return;
        }
        try {
            const data = await getMergeJobFieldPreview({ mergeJobId: this.mergeJobId });
            this.sections = Array.isArray(data) ? data : [];
        } catch (e) {
            this.loadError = e?.body?.message || e?.message || 'Could not load preview.';
        }
    }

    get showEmpty() {
        return !this.loadError && this.sections.length === 0;
    }

    handleClose() {
        this.close();
    }
}