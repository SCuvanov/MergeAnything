public class MergeJob {
    @AuraEnabled
    public Merge_Job__c mergeJob { get; private set; }
    @AuraEnabled
    public List<Merge_Item__c> mergeItems { get; private set; }
    @AuraEnabled
    public List<String> errors { get; private set; }

    public MergeJob() {
        this.mergeJob = new Merge_Job__c();
        this.mergeItems = new List<Merge_Item__c>();

        this.init();
    }

    public MergeJob(Merge_Job__c mergeJob) {
        this.mergeJob = mergeJob;
        this.mergeItems = new List<Merge_Item__c>();

        this.init();
    }

    public MergeJob(Merge_Job__c mergeJob, List<Merge_Item__c> mergeItems) {
        this.mergeJob = mergeJob;
        this.mergeItems = mergeItems;

        this.init();
    }

    private void init() {
        this.errors = new List<String>();
        this.setStatus(MergeAnythingConstants.MERGE_JOB_STATUS.PENDING);
    }

    public void setStatus(String status) {
        this.mergeJob.Status__c = status;
    }

    public void addMergeItem(Merge_Item__c mergeItem) {
        this.mergeItems.add(mergeItem);
    }

    public MergeJob create() {
        Database.SaveResult sr = Database.insert(this.mergeJob, false);
        if (!sr.isSuccess()) {
            for (Database.Error objErr : sr.getErrors()) {
                this.errors.add(objErr.getStatusCode() + ': ' + objErr.getMessage());
                this.errors.add('Invoice oject field which are affected by the error:' + objErr.getFields());
            }
        } else {
            this.mergeJob = MergeJobSelector.getInstance().getMergeJobById(sr.getId());
        }
        return this;
    }
}
