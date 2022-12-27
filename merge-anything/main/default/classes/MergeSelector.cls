public class MergeSelector {

    private static MergeSelector instance = new MergeSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private MergeSelector() {}

    /**
     * @description The instance `MergeSelector` used for any querying specific to merges
     * @return   The singleton instance of `MergeSelector`
     */
    public static MergeSelector getInstance() {
        return instance;
    }

    /**
     * @description Returns a list of `Merge__c` records
     * @param  mergeIds The list of `ID` of the `Merge__c` records to query
     * @return        The list of matching `Merge__c` records
     */
    public List<Merge__c> getMergesById(List<Id> mergeIds) {
        return [SELECT Id, Name, Status__c FROM Merge__c WHERE Id IN :mergeIds];
    }

    /**
     * @description Returns the newest `Merge__c` record based on created date
     * @return        The list of matching `Merge__c` records
     */
    public Merge__c getNewestMerge() {
        List<Merge__c> merges = [SELECT Id, Name, Status__c FROM Merge__c ORDER BY CreatedDate DESC];
        
        if(merges == null || merges.isEmpty()) {
            return null;
        }

        return merges[0];
    }
}
