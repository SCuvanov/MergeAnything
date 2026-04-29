public with sharing class MergeFieldTemplateSelector {
    private static MergeFieldTemplateSelector instance = new MergeFieldTemplateSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private MergeFieldTemplateSelector() {
    }

    public static MergeFieldTemplateSelector getInstance() {
        return instance;
    }

    public List<Merge_Field_Template__c> getTemplatesForObject(String targetObjectApiName) {
        if (String.isBlank(targetObjectApiName)) {
            return new List<Merge_Field_Template__c>();
        }
        return [
            SELECT Id, Name, Target_Object__c, Field_Selections_JSON__c, Description__c
            FROM Merge_Field_Template__c
            WHERE Target_Object__c = :targetObjectApiName
            WITH SECURITY_ENFORCED
            ORDER BY CreatedDate DESC
        ];
    }
}
