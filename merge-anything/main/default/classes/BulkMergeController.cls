public with sharing class BulkMergeController {
    @AuraEnabled(cacheable=true)
    public static Merge_Job__c getNewestMergeJob() {
        return MergeJobSelector.getInstance().getNewestMergeJob();
    }

    @AuraEnabled(cacheable=true)
    public static Id getNewestMergeJobId() {
        return MergeJobSelector.getInstance().getNewestMergeJobId();
    }

    @AuraEnabled(cacheable=true)
    public static List<Merge_Job__c> getAllMergeJobs() {
        return MergeJobSelector.getInstance().getAllMergeJobs();
    }

    @AuraEnabled(cacheable=true)
    public static List<Merge_Item__c> getMergeItemsByMergeJobId(Id mergeJobId) {
        return MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
    }

    @AuraEnabled
    public static MergeJob createMergeJob() {
        return new MergeJob().create();
    }

    /**
     * @param mergeJobId        Parent Merge Job (master-detail).
     * @param sObjectApiName    API name of the records being merged.
     * @param primaryRecordId   Surviving-record candidate / primary Id.
     * @param secondaryRecordId Duplicate / secondary Id.
     * @param fieldSelections   Per-field choice: {@code usePrimary == false} takes secondary value in merged JSON.
     */
    @AuraEnabled
    public static Merge_Item__c createMergeItem(
        Id mergeJobId,
        String sObjectApiName,
        Id primaryRecordId,
        Id secondaryRecordId,
        List<RecordSelector.MergeFieldSelection> fieldSelections
    ) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job is required.');
        }
        if (String.isBlank(sObjectApiName) || primaryRecordId == null || secondaryRecordId == null) {
            throw new AuraHandledException('Object and both records are required.');
        }

        RecordSelector.MergeJsonBlob jsonPayload = RecordSelector.getInstance()
            .buildMergeItemJson(sObjectApiName, primaryRecordId, secondaryRecordId, fieldSelections);
        if (jsonPayload == null) {
            throw new AuraHandledException('Could not build merge data for the selected records.');
        }

        List<RecordSelector.MergeFieldSelection> selectionsToStore = fieldSelections != null
            ? fieldSelections
            : new List<RecordSelector.MergeFieldSelection>();

        Merge_Item__c item = new Merge_Item__c(
            Merge_Job__c = mergeJobId,
            Primary_Record_Id__c = primaryRecordId,
            Secondary_Record_Id__c = secondaryRecordId,
            Field_Selections_JSON__c = JSON.serialize(selectionsToStore),
            Primary_Record_JSON__c = jsonPayload.primaryJson,
            Secondary_Record_JSON__c = jsonPayload.secondaryJson,
            Merged_Record_JSON__c = jsonPayload.mergedJson
        );
        insert item;

        return [
            SELECT Id, Name, Link__c, Merge_Job__c
            FROM Merge_Item__c
            WHERE Id = :item.Id
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<EntityDefinition> getEntityDefinitionsByLabel(String label) {
        return EntityDefinitionSelector.getInstance().getEntityDefinitionsByLabel(label);
    }

    @AuraEnabled(cacheable=true)
    public static List<EntityDefinition> getAllEntityDefinitions() {
        return EntityDefinitionSelector.getInstance().getAllEntityDefinitions();
    }

    /**
     * @param sObjectApiName Qualified API name of the sObject to query (e.g. Account, Custom__c)
     * @param name           Name search value used when the object supports Name filtering
     * @return Search options normalized to always return Id + Name
     */
    @AuraEnabled(cacheable=true)
    public static List<RecordSelector.RecordSearchOption> getRecordsWithEditableFields(String sObjectApiName, String name) {
        return RecordSelector.getInstance().getRecordSearchOptions(sObjectApiName, name, null);
    }

    /**
     * @description Editable field values for two records of the same object type, for the merge field picker UI.
     */
    @AuraEnabled
    public static List<RecordSelector.MergeFieldRow> getMergeFieldRows(String sObjectApiName, Id primaryId, Id secondaryId) {
        return RecordSelector.getInstance().getMergeFieldRows(sObjectApiName, primaryId, secondaryId);
    }

    /**
     * @description For each merge item, loads field choices from {@code Field_Selections_JSON__c} (fallback: infer from
     *              legacy JSON snapshots), rebuilds {@code Merged_Record_JSON__c}, updates the primary record, and sets
     *              the merge job to Completed when every item succeeds (otherwise Failed).
     */
    @AuraEnabled
    public static MergeJobExecutionResult executeMergeJob(Id mergeJobId) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job Id is required.');
        }

        List<Merge_Item__c> items = MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
        update new Merge_Job__c(Id = mergeJobId, Status__c = 'In Progress');

        Integer successCount = 0;
        Integer failureCount = 0;
        List<String> errorMessages = new List<String>();
        List<Merge_Item__c> itemsToSave = new List<Merge_Item__c>();
        RecordSelector selector = RecordSelector.getInstance();

        for (Merge_Item__c item : items) {
            try {
                if (item.Primary_Record_Id__c == null || item.Secondary_Record_Id__c == null) {
                    throw new AuraHandledException('Merge Item is missing primary or secondary record Id.');
                }

                Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
                Id secondaryId = Id.valueOf(item.Secondary_Record_Id__c);
                String objectApiName = primaryId.getSObjectType().getDescribe().getName();
                List<RecordSelector.MergeFieldSelection> selections = selector.parseFieldSelectionsFromJson(
                    item.Field_Selections_JSON__c
                );
                if (selections.isEmpty()) {
                    selections = selector.inferFieldSelectionsFromStoredJson(
                        item.Primary_Record_JSON__c,
                        item.Secondary_Record_JSON__c,
                        item.Merged_Record_JSON__c
                    );
                }

                String mergedJson = selector.buildMergedRecordJson(objectApiName, primaryId, secondaryId, selections);
                if (String.isBlank(mergedJson)) {
                    throw new AuraHandledException('Could not rebuild merged JSON; verify both records still exist.');
                }

                selector.updateSurvivorFromMergedJson(objectApiName, primaryId, mergedJson);

                item.Merged_Record_JSON__c = mergedJson;
                item.Status__c = 'Completed';
                itemsToSave.add(item);
                successCount++;
            } catch (Exception e) {
                item.Status__c = 'Failed';
                itemsToSave.add(item);
                failureCount++;
                String itemLabel = item.Name != null ? item.Name : String.valueOf(item.Id);
                errorMessages.add(itemLabel + ': ' + e.getMessage());
            }
        }

        if (!itemsToSave.isEmpty()) {
            update itemsToSave;
        }

        String finalStatus = failureCount > 0 ? 'Failed' : 'Completed';
        update new Merge_Job__c(Id = mergeJobId, Status__c = finalStatus);

        MergeJobExecutionResult result = new MergeJobExecutionResult();
        result.jobStatus = finalStatus;
        result.successCount = successCount;
        result.failureCount = failureCount;
        result.errors = errorMessages;
        return result;
    }

    public class MergeJobExecutionResult {
        @AuraEnabled
        public String jobStatus { get; set; }
        @AuraEnabled
        public Integer successCount { get; set; }
        @AuraEnabled
        public Integer failureCount { get; set; }
        @AuraEnabled
        public List<String> errors { get; set; }
    }
}
