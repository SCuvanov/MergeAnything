public with sharing class RecordSelector {
    private static final Integer DEFAULT_ROW_LIMIT = 200;
    private static final Integer MAX_ROW_LIMIT = 2000;

    private static RecordSelector instance = new RecordSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private RecordSelector() {
    }

    /**
     * @description Singleton accessor for record queries
     * @return The singleton instance of `RecordSelector`
     */
    public static RecordSelector getInstance() {
        return instance;
    }

    public class RecordSearchOption {
        @AuraEnabled
        public Id Id { get; set; }
        @AuraEnabled
        public String Name { get; set; }

        public RecordSearchOption(Id recordId, String recordName) {
            this.Id = recordId;
            this.Name = recordName;
        }
    }

    /**
     * @description Queries up to {@link #DEFAULT_ROW_LIMIT} rows for the given object, selecting Id and all
     *              accessible, updateable (non-compound) fields as determined at runtime from describe metadata.
     * @param sObjectApiName Qualified API name of the sObject (e.g. Account, Custom_Object__c)
     * @return List of generic sObject rows; empty if the type is unknown or no selectable fields exist
     */
    public List<SObject> getRecordsWithEditableFields(String sObjectApiName) {
        return getRecordsWithEditableFields(sObjectApiName, null, DEFAULT_ROW_LIMIT);
    }

    /**
     * @description Queries rows for the given object, selecting Id and all accessible, updateable fields.
     * @param sObjectApiName Qualified API name of the sObject
     * @param rowLimit Maximum rows to return (clamped between 1 and {@link #MAX_ROW_LIMIT})
     * @return List of generic sObject rows
     */
    public List<SObject> getRecordsWithEditableFields(String sObjectApiName, Integer rowLimit) {
        return getRecordsWithEditableFields(sObjectApiName, null, rowLimit);
    }

    /**
     * @description Queries rows for the given object, selecting Id and all accessible, updateable fields.
     *              If name is provided and the object has an accessible Name field, records are filtered by it.
     * @param sObjectApiName Qualified API name of the sObject
     * @param name Name search value used in a LIKE filter (when applicable)
     * @param rowLimit Maximum rows to return (clamped between 1 and {@link #MAX_ROW_LIMIT})
     * @return List of generic sObject rows
     */
    public List<SObject> getRecordsWithEditableFields(String sObjectApiName, String name, Integer rowLimit) {
        if (String.isBlank(sObjectApiName)) {
            return new List<SObject>();
        }

        Schema.SObjectType sObjectType = resolveSObjectType(sObjectApiName);
        if (sObjectType == null) {
            return new List<SObject>();
        }

        String searchFieldApiName = resolveSearchFieldApiName(sObjectType);
        Set<String> requiredFields = new Set<String>{ 'Id' };
        if (!String.isBlank(searchFieldApiName)) {
            requiredFields.add(searchFieldApiName);
        }

        List<String> fieldApiNames = buildEditableFieldSelectList(sObjectType, requiredFields);
        if (fieldApiNames.isEmpty()) {
            return new List<SObject>();
        }

        Integer safeLimit = normalizeRowLimit(rowLimit);
        String objectApiName = sObjectType.getDescribe().getName();
        String namePattern = '%' + name + '%';
        Boolean canFilterByName = !String.isBlank(searchFieldApiName) && !String.isBlank(name);
        String soql =
            'SELECT ' +
            String.join(fieldApiNames, ', ') +
            ' FROM ' +
            objectApiName +
            (canFilterByName ? ' WHERE ' + searchFieldApiName + ' LIKE :namePattern' : '') +
            ' WITH SECURITY_ENFORCED LIMIT ' +
            safeLimit;

        return Database.query(soql);
    }

    /**
     * @description Returns normalized records for search UIs where `Name` must always be present in the response
     *              regardless of the object's underlying name field API name.
     */
    public List<RecordSearchOption> getRecordSearchOptions(String sObjectApiName, String name, Integer rowLimit) {
        List<SObject> records = getRecordsWithEditableFields(sObjectApiName, name, rowLimit);
        if (records.isEmpty()) {
            return new List<RecordSearchOption>();
        }

        Schema.SObjectType sObjectType = resolveSObjectType(sObjectApiName);
        if (sObjectType == null) {
            return new List<RecordSearchOption>();
        }

        String searchFieldApiName = resolveSearchFieldApiName(sObjectType);
        List<RecordSearchOption> options = new List<RecordSearchOption>();

        for (SObject record : records) {
            Id recordId = (Id)record.get('Id');
            String recordName = null;
            if (!String.isBlank(searchFieldApiName)) {
                Object rawNameValue = record.get(searchFieldApiName);
                if (rawNameValue != null) {
                    recordName = String.valueOf(rawNameValue);
                }
            }

            if (String.isBlank(recordName)) {
                recordName = String.valueOf(recordId);
            }

            options.add(new RecordSearchOption(recordId, recordName));
        }

        return options;
    }

    private static Schema.SObjectType resolveSObjectType(String sObjectApiName) {
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        if (globalDescribe.containsKey(sObjectApiName)) {
            return globalDescribe.get(sObjectApiName);
        }

        String lowerKey = sObjectApiName.toLowerCase();
        for (String token : globalDescribe.keySet()) {
            if (token != null && token.toLowerCase() == lowerKey) {
                return globalDescribe.get(token);
            }
        }

        return null;
    }

    private static List<String> buildEditableFieldSelectList(Schema.SObjectType sObjectType, Set<String> requiredFields) {
        Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
        Set<String> selected = new Set<String>();

        for (Schema.SObjectField fieldToken : fieldMap.values()) {
            Schema.DescribeFieldResult dfr = fieldToken.getDescribe();

            if (dfr.isDeprecatedAndHidden()) {
                continue;
            }
            if (!dfr.isAccessible()) {
                continue;
            }
            if (isCompoundParentField(dfr)) {
                continue;
            }
            if (!dfr.isUpdateable() && !requiredFields.contains(dfr.getName())) {
                continue;
            }

            selected.add(dfr.getName());
        }

        List<String> ordered = new List<String>(selected);
        ordered.sort();
        return ordered;
    }

    /**
     * @description Skips compound parent columns that are not supported as a single SOQL projection; component
     *              fields (for example BillingStreet) remain in the field map and are included when updateable.
     */
    private static Boolean isCompoundParentField(Schema.DescribeFieldResult dfr) {
        Schema.DisplayType fieldType = dfr.getType();
        return fieldType == Schema.DisplayType.ADDRESS || fieldType == Schema.DisplayType.LOCATION;
    }

    private static String resolveSearchFieldApiName(Schema.SObjectType sObjectType) {
        Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
        Schema.DescribeFieldResult fallbackNameDfr;
        for (Schema.SObjectField fieldToken : fieldMap.values()) {
            Schema.DescribeFieldResult dfr = fieldToken.getDescribe();
            if (dfr.isDeprecatedAndHidden() || !dfr.isAccessible()) {
                continue;
            }

            if (dfr.isNameField()) {
                return dfr.getName();
            }

            if (dfr.getName() == 'Name') {
                fallbackNameDfr = dfr;
            }
        }

        if (fallbackNameDfr != null) {
            return fallbackNameDfr.getName();
        }

        return null;
    }

    private static Integer normalizeRowLimit(Integer rowLimit) {
        if (rowLimit == null || rowLimit < 1) {
            return DEFAULT_ROW_LIMIT;
        }
        return Math.min(rowLimit, MAX_ROW_LIMIT);
    }
}
