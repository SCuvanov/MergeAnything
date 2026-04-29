import LightningModal from 'lightning/modal';
import { api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import bulkCreateMergeItemsFromCsv from '@salesforce/apex/BulkMergeController.bulkCreateMergeItemsFromCsv';
import getMergeFieldTemplates from '@salesforce/apex/BulkMergeController.getMergeFieldTemplates';

function apexErrorMessage(error) {
    if (Array.isArray(error?.body)) {
        return error.body.map((e) => e.message).join(', ');
    }
    return error?.body?.message || error?.message || 'Unknown error';
}

export default class BulkMergeItemsModal extends LightningModal {
    @api mergeJobId;

    @track _sobjectApiName;
    @track _csvBody = '';
    @track _templateId;
    @track _importing = false;

    _templates = [];

    @wire(getMergeFieldTemplates, { targetObjectApiName: '$_sobjectApiName' })
    wiredTemplates({ data }) {
        this._templates = data || [];
    }

    get templateOptions() {
        const opts = [{ label: '-- No template (all primary fields) --', value: '' }];
        (this._templates || []).forEach((t) => {
            opts.push({
                label: `${t.Name}${t.Description__c ? ' — ' + t.Description__c : ''}`,
                value: t.Id,
            });
        });
        return opts;
    }

    get canImport() {
        return !!(this.mergeJobId && this._sobjectApiName && this._csvBody?.trim() && !this._importing);
    }

    get templateComboboxDisabled() {
        return !this._sobjectApiName;
    }

    get importButtonDisabled() {
        return !this.canImport;
    }

    handleObjectSelected(event) {
        this._sobjectApiName = event.detail?.apiName || undefined;
        this._templateId = '';
    }

    handleCsvChange(event) {
        this._csvBody = event.target.value;
    }

    handleTemplateChange(event) {
        this._templateId = event.detail.value;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    buildFieldSelectionsFromTemplate() {
        if (!this._templateId || !this._templates?.length) {
            return [];
        }
        const t = this._templates.find((x) => x.Id === this._templateId);
        if (!t?.Field_Selections_JSON__c) {
            return [];
        }
        try {
            const raw = JSON.parse(t.Field_Selections_JSON__c);
            if (!Array.isArray(raw)) {
                return [];
            }
            return raw.map((row) => ({
                fieldApiName: row.fieldApiName,
                usePrimary: row.usePrimary !== false,
            }));
        } catch (e) {
            return [];
        }
    }

    async handleImport() {
        if (!this.canImport) {
            return;
        }
        this._importing = true;
        try {
            const fieldSelections = this.buildFieldSelectionsFromTemplate();
            const result = await bulkCreateMergeItemsFromCsv({
                mergeJobId: this.mergeJobId,
                sObjectApiName: this._sobjectApiName,
                csvBody: this._csvBody,
                fieldSelections,
            });
            const msg = `${result.successCount} created, ${result.failureCount} failed.`;
            this.showToast(
                result.failureCount > 0 ? 'Import finished with errors' : 'Import complete',
                result.errors?.length ? `${msg} ${result.errors.join(' ')}` : msg,
                result.failureCount > 0 ? 'warning' : 'success'
            );
            this.close({ status: 'success', result });
        } catch (error) {
            this.showToast('Import failed', apexErrorMessage(error), 'error');
        } finally {
            this._importing = false;
        }
    }

    handleCancel() {
        this.close();
    }
}
