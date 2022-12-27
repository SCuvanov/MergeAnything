public class BulkMergeController {
    
    @AuraEnabled(cacheable=true)
    public static Merge__c getNewestMerge() {
        return MergeSelector.getInstance().getNewestMerge();
    }
}
