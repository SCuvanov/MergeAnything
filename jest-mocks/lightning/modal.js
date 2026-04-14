import { LightningElement } from 'lwc';

/**
 * Minimal stub for LightningModal in Jest (not shipped in sfdx-lwc-jest lightning-stubs).
 */
export default class LightningModal extends LightningElement {
    close() {
        return Promise.resolve();
    }

    static open() {
        return Promise.resolve();
    }
}
