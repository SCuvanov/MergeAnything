public class MergeItemSelector {
    private static MergeItemSelector instance = new MergeItemSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private MergeItemSelector() {
    }

    /**
     * @description The instance `MergeItemSelector` used for any querying specific to merge items
     * @return   The singleton instance of `MergeItemSelector`
     */
    public static MergeItemSelector getInstance() {
        return instance;
    }

    /**
     * @description Returns a list of `Merge_Item__c` records
     * @param  mergeItemIds The list of `ID` of the `Merge_Item__c` records to query
     * @return        The list of matching `Merge_Item__c` records
     */
    public List<Merge_Item__c> getMergeItemsById(List<Id> mergeItemIds) {
        return [
            SELECT
                Id,
                CreatedDate,
                Name,
                Merge_Job__c,
                Merged_Record_JSON__c,
                Primary_Record_Id__c,
                Primary_Record_JSON__c,
                Secondary_Record_Id__c,
                Secondary_Record_JSON__c,
                Status__c
            FROM Merge_Item__c
            WHERE Id IN :mergeItemIds
        ];
    }

    /**
     * @description Returns a list of `Merge_Item__c` records
     * @param  mergeJobId The single `Merge_Job__c` Id of the `Merge_Item__c` records to query
     * @return        The list of matching `Merge_Item__c` records
     */
    public List<Merge_Item__c> getMergeItemsByMergeJobId(Id mergeJobId) {
        return [
            SELECT
                Id,
                CreatedDate,
                Name,
                Merge_Job__c,
                Merged_Record_JSON__c,
                Primary_Record_Id__c,
                Primary_Record_JSON__c,
                Secondary_Record_Id__c,
                Secondary_Record_JSON__c,
                Status__c
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId
        ];
    }
}