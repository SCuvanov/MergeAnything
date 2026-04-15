public class BulkMergeController {
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

    @AuraEnabled
    public static MergeItem createMergeItem() {
        return null; //new MergeItem().create();
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
}
