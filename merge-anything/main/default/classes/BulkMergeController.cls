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
}
