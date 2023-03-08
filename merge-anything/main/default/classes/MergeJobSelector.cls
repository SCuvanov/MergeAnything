public class MergeJobSelector {
    private static MergeJobSelector instance = new MergeJobSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private MergeJobSelector() {
    }

    /**
     * @description The instance `MergeJobSelector` used for any querying specific to merges
     * @return   The singleton instance of `MergeJobSelector`
     */
    public static MergeJobSelector getInstance() {
        return instance;
    }

    /**
     * @description Returns a single `Merge_Job__c` record
     * @param  mergeId A single `Id` of the `Merge_Job__c` record to query
     * @return        A `Merge_Job__c` record matching the provided mergeId
     */
    public Merge_Job__c getMergeJobById(Id mergeId) {
        return [SELECT Id, Name, Link__c, Status__c FROM Merge_Job__c WHERE Id = :mergeId];
    }

    /**
     * @description Returns a list of `Merge_Job__c` records
     * @param  mergeIds The list of `ID` of the `Merge_Job__c` records to query
     * @return        The list of matching `Merge_Job__c` records
     */
    public List<Merge_Job__c> getMergeJobsById(List<Id> mergeIds) {
        return [SELECT Id, Name, Status__c FROM Merge_Job__c WHERE Id IN :mergeIds];
    }

    /**
     * @description Returns the newest `Merge_Job__c` record based on created date
     * @return        The single `Merge_Job__c` record
     */
    public Merge_Job__c getNewestMergeJob() {
        List<Merge_Job__c> mergeJobs = [
            SELECT Id, CreatedDate, Name, Status__c
            FROM Merge_Job__c
            ORDER BY CreatedDate DESC
        ];

        if (mergeJobs == null || mergeJobs.isEmpty()) {
            return null;
        }

        return mergeJobs[0];
    }

    /**
     * @description Returns the `Id` of the newest `Merge_Job__c` record based on created date
     * @return        The Id of a single `Merge_Job__c` record
     */
    public Id getNewestMergeJobId() {
        List<Merge_Job__c> mergeJobs = [
            SELECT Id, CreatedDate, Name, Status__c
            FROM Merge_Job__c
            ORDER BY CreatedDate DESC
        ];

        if (mergeJobs == null || mergeJobs.isEmpty()) {
            return null;
        }

        return mergeJobs[0].Id;
    }

    /**
     * @description Returns a list of `Merge_Job__c` record based on created date
     * @return        The List of `Merge_Job__c` records
     */
    public List<Merge_Job__c> getAllMergeJobs() {
        List<Merge_Job__c> mergeJobs = [
            SELECT Id, CreatedDate, Name, Status__c
            FROM Merge_Job__c
            ORDER BY CreatedDate DESC
        ];

        if (mergeJobs == null || mergeJobs.isEmpty()) {
            return null;
        }

        return mergeJobs;
    }
}