import LightningModal from 'lightning/modal';
import { api } from 'lwc';

export default class MergeValidationResultsModal extends LightningModal {
    @api result;

    get jobLevelErrors() {
        return this.result?.jobLevelErrors?.length ? this.result.jobLevelErrors : [];
    }

    get jobLevelErrorRows() {
        return this.jobLevelErrors.map((text, i) => ({ key: `job-err-${i}`, text }));
    }

    get hasJobLevelErrors() {
        return this.jobLevelErrors.length > 0;
    }

    get decoratedItems() {
        const items = this.result?.items || [];
        return items.map((row, rowIdx) => ({
            ...row,
            rowKey: row.mergeItemId || `row-${rowIdx}`,
            statusLabel: row.isValid ? 'OK' : 'Needs attention',
            hasErrors: !!(row.errors && row.errors.length),
            hasWarnings: !!(row.warnings && row.warnings.length),
            safeErrors: (row.errors || []).map((text, i) => ({ key: `${row.mergeItemId}-e-${i}`, text })),
            safeWarnings: (row.warnings || []).map((text, i) => ({ key: `${row.mergeItemId}-w-${i}`, text })),
        }));
    }

    get summaryClass() {
        return this.result?.allItemsValid
            ? 'slds-text-heading_small slds-text-color_success'
            : 'slds-text-heading_small slds-text-color_error';
    }

    get summaryTitle() {
        if (!this.result) {
            return '';
        }
        return this.result.allItemsValid ? 'All checks passed' : 'Issues found';
    }

    handleClose() {
        this.close();
    }
}