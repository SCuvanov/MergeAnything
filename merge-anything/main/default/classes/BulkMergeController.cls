public class BulkMergeController {
    @AuraEnabled(cacheable=true)
    public static Merge__c getNewestMerge() {
        return MergeSelector.getInstance().getNewestMerge();
    }

    @AuraEnabled(cacheable=true)
    public static Id getNewestMergeId() {
        return MergeSelector.getInstance().getNewestMergeId();
    }

    @AuraEnabled(cacheable=true)
    public static List<Merge__c> getAllMerges() {
        return MergeSelector.getInstance().getAllMerges();
    }
}
