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
     * @description One mergeable field with primary vs secondary display values for the merge UI.
     */
    public class MergeFieldRow {
        @AuraEnabled
        public String apiName { get; set; }
        @AuraEnabled
        public String label { get; set; }
        @AuraEnabled
        public String primaryValue { get; set; }
        @AuraEnabled
        public String secondaryValue { get; set; }
    }

    /**
     * @description Field-level choice when persisting a merge (use primary vs secondary value).
     */
    public class MergeFieldSelection {
        @AuraEnabled
        public String fieldApiName { get; set; }
        @AuraEnabled
        public Boolean usePrimary { get; set; }
    }

    /**
     * @description JSON snapshots for primary, secondary, and merged field maps.
     */
    public class MergeJsonBlob {
        public String primaryJson { get; set; }
        public String secondaryJson { get; set; }
        public String mergedJson { get; set; }
        /** Resolved from the object’s name field (or Id fallback) for list and link labels. */
        public String primaryRecordName { get; set; }
        public String secondaryRecordName { get; set; }
    }

    private class MergePairContext {
        SObject primaryRow;
        SObject secondaryRow;
        List<String> fieldApiNames;
        Schema.SObjectType sObjectType;
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

    /**
     * @description Loads two records by Id with the same editable field projection used for search, and returns
     *              side-by-side values for merge (excluding `Id`).
     */
    public List<MergeFieldRow> getMergeFieldRows(String sObjectApiName, Id primaryId, Id secondaryId) {
        List<MergeFieldRow> rows = new List<MergeFieldRow>();

        MergePairContext ctx = loadMergePair(sObjectApiName, primaryId, secondaryId);
        if (ctx == null) {
            return rows;
        }

        Map<String, Schema.SObjectField> fieldMap = ctx.sObjectType.getDescribe().fields.getMap();

        for (String fieldName : ctx.fieldApiNames) {
            if (fieldName == 'Id') {
                continue;
            }

            Schema.SObjectField fieldToken = fieldMap.get(fieldName);
            if (fieldToken == null) {
                continue;
            }

            Schema.DescribeFieldResult dfr = fieldToken.getDescribe();
            String primaryValue = formatFieldValueForDisplay(ctx.primaryRow.get(fieldName), dfr);
            String secondaryValue = formatFieldValueForDisplay(ctx.secondaryRow.get(fieldName), dfr);
            if (String.isBlank(primaryValue) && String.isBlank(secondaryValue)) {
                continue;
            }

            MergeFieldRow mergeRow = new MergeFieldRow();
            mergeRow.apiName = fieldName;
            mergeRow.label = dfr.getLabel();
            mergeRow.primaryValue = primaryValue;
            mergeRow.secondaryValue = secondaryValue;
            rows.add(mergeRow);
        }

        return rows;
    }

    /**
     * @description Builds JSON strings of field API name to typed values for primary, secondary, and merged (primary
     *              with secondary overlays per {@code fieldSelections}).
     */
    public MergeJsonBlob buildMergeItemJson(
        String sObjectApiName,
        Id primaryId,
        Id secondaryId,
        List<MergeFieldSelection> fieldSelections
    ) {
        MergePairContext ctx = loadMergePair(sObjectApiName, primaryId, secondaryId);
        if (ctx == null) {
            return null;
        }

        Map<String, Object> primaryMap = toFieldValueMap(ctx.primaryRow, ctx.fieldApiNames);
        Map<String, Object> secondaryMap = toFieldValueMap(ctx.secondaryRow, ctx.fieldApiNames);

        Map<String, Object> merged = new Map<String, Object>(primaryMap);
        applyMergeFieldSelections(ctx, merged, fieldSelections);

        MergeJsonBlob jsonPayload = new MergeJsonBlob();
        jsonPayload.primaryJson = JSON.serialize(primaryMap);
        jsonPayload.secondaryJson = JSON.serialize(secondaryMap);
        jsonPayload.mergedJson = JSON.serialize(merged);

        String searchFieldApiName = resolveSearchFieldApiName(ctx.sObjectType);
        String primaryName = '';
        String secondaryName = '';
        if (!String.isBlank(searchFieldApiName)) {
            Object pObj = ctx.primaryRow.get(searchFieldApiName);
            Object sObj = ctx.secondaryRow.get(searchFieldApiName);
            if (pObj != null) {
                primaryName = String.valueOf(pObj);
            }
            if (sObj != null) {
                secondaryName = String.valueOf(sObj);
            }
        }
        if (String.isBlank(primaryName)) {
            primaryName = String.valueOf(primaryId);
        }
        if (String.isBlank(secondaryName)) {
            secondaryName = String.valueOf(secondaryId);
        }
        jsonPayload.primaryRecordName = trimForTextField(primaryName, 255);
        jsonPayload.secondaryRecordName = trimForTextField(secondaryName, 255);
        return jsonPayload;
    }

    /**
     * @description Serializes the merged field map only: current primary values with secondary substitutions from
     *              {@code fieldSelections}. Used when executing a merge job without refreshing primary/secondary JSON.
     */
    public String buildMergedRecordJson(
        String sObjectApiName,
        Id primaryId,
        Id secondaryId,
        List<MergeFieldSelection> fieldSelections
    ) {
        MergePairContext ctx = loadMergePair(sObjectApiName, primaryId, secondaryId);
        if (ctx == null) {
            return null;
        }

        Map<String, Object> merged = new Map<String, Object>(toFieldValueMap(ctx.primaryRow, ctx.fieldApiNames));
        applyMergeFieldSelections(ctx, merged, fieldSelections);
        return JSON.serialize(merged);
    }

    private void applyMergeFieldSelections(
        MergePairContext ctx,
        Map<String, Object> merged,
        List<MergeFieldSelection> fieldSelections
    ) {
        if (fieldSelections == null) {
            return;
        }
        for (MergeFieldSelection sel : fieldSelections) {
            if (sel == null || String.isBlank(sel.fieldApiName)) {
                continue;
            }
            if (sel.usePrimary != null && sel.usePrimary == false) {
                merged.put(sel.fieldApiName, ctx.secondaryRow.get(sel.fieldApiName));
            }
        }
    }

    private MergePairContext loadMergePair(String sObjectApiName, Id primaryId, Id secondaryId) {
        if (String.isBlank(sObjectApiName) || primaryId == null || secondaryId == null) {
            return null;
        }
        if (primaryId == secondaryId) {
            return null;
        }

        Schema.SObjectType sObjectType = resolveSObjectType(sObjectApiName);
        if (sObjectType == null) {
            return null;
        }

        String searchFieldApiName = resolveSearchFieldApiName(sObjectType);
        Set<String> requiredFields = new Set<String>{ 'Id' };
        if (!String.isBlank(searchFieldApiName)) {
            requiredFields.add(searchFieldApiName);
        }

        List<String> fieldApiNames = buildEditableFieldSelectList(sObjectType, requiredFields);
        if (fieldApiNames.isEmpty()) {
            return null;
        }

        String objectApiName = sObjectType.getDescribe().getName();
        Set<Id> idSet = new Set<Id>{ primaryId, secondaryId };
        String soql =
            'SELECT ' +
            String.join(fieldApiNames, ', ') +
            ' FROM ' +
            objectApiName +
            ' WHERE Id IN :idSet WITH SECURITY_ENFORCED';

        List<SObject> queried = Database.query(soql);

        if (queried.size() != 2) {
            return null;
        }

        SObject primaryRow;
        SObject secondaryRow;
        for (SObject row : queried) {
            if (row.Id == primaryId) {
                primaryRow = row;
            } else if (row.Id == secondaryId) {
                secondaryRow = row;
            }
        }

        if (primaryRow == null || secondaryRow == null) {
            return null;
        }

        MergePairContext ctx = new MergePairContext();
        ctx.primaryRow = primaryRow;
        ctx.secondaryRow = secondaryRow;
        ctx.fieldApiNames = fieldApiNames;
        ctx.sObjectType = sObjectType;
        return ctx;
    }

    private static Map<String, Object> toFieldValueMap(SObject row, List<String> fieldApiNames) {
        Map<String, Object> m = new Map<String, Object>();
        for (String fieldName : fieldApiNames) {
            m.put(fieldName, row.get(fieldName));
        }
        return m;
    }

    private static String formatFieldValueForDisplay(Object raw, Schema.DescribeFieldResult dfr) {
        if (raw == null) {
            return '';
        }

        Schema.DisplayType displayType = dfr.getType();

        if (displayType == Schema.DisplayType.DATE) {
            return ((Date) raw).format();
        }
        if (displayType == Schema.DisplayType.DATETIME) {
            return ((Datetime) raw).format();
        }
        return String.valueOf(raw);
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

    private static String trimForTextField(String value, Integer maxLen) {
        if (String.isBlank(value) || maxLen == null || maxLen < 1) {
            return value;
        }
        return value.length() > maxLen ? value.substring(0, maxLen) : value;
    }

    /**
     * @description Deserializes {@code Field_Selections_JSON__c} (JSON array of {@code MergeFieldSelection}). Returns
     *              empty list if blank or invalid JSON.
     */
    public List<MergeFieldSelection> parseFieldSelectionsFromJson(String selectionsJson) {
        List<MergeFieldSelection> result = new List<MergeFieldSelection>();
        if (String.isBlank(selectionsJson)) {
            return result;
        }
        try {
            List<Object> raw = (List<Object>) JSON.deserializeUntyped(selectionsJson);
            if (raw == null) {
                return result;
            }
            for (Object o : raw) {
                if (o == null) {
                    continue;
                }
                Map<String, Object> m = (Map<String, Object>) o;
                MergeFieldSelection sel = new MergeFieldSelection();
                sel.fieldApiName = (String) m.get('fieldApiName');
                Object up = m.get('usePrimary');
                if (up instanceof Boolean) {
                    sel.usePrimary = (Boolean) up;
                } else {
                    sel.usePrimary = true;
                }
                result.add(sel);
            }
        } catch (Exception e) {
            return new List<MergeFieldSelection>();
        }
        return result;
    }

    /**
     * @description Legacy fallback: reconstructs which fields used secondary values by comparing stored primary,
     *              secondary, and merged JSON snapshots when {@code Field_Selections_JSON__c} is absent.
     */
    public List<MergeFieldSelection> inferFieldSelectionsFromStoredJson(
        String primaryJson,
        String secondaryJson,
        String mergedJson
    ) {
        List<MergeFieldSelection> selections = new List<MergeFieldSelection>();

        if (String.isBlank(primaryJson) || String.isBlank(secondaryJson) || String.isBlank(mergedJson)) {
            return selections;
        }

        Map<String, Object> primaryMap = (Map<String, Object>) JSON.deserializeUntyped(primaryJson);
        Map<String, Object> secondaryMap = (Map<String, Object>) JSON.deserializeUntyped(secondaryJson);
        Map<String, Object> mergedMap = (Map<String, Object>) JSON.deserializeUntyped(mergedJson);

        for (String fieldName : mergedMap.keySet()) {
            if (fieldName == null || fieldName.equalsIgnoreCase('Id')) {
                continue;
            }

            Object mVal = mergedMap.get(fieldName);
            Object pVal = primaryMap.get(fieldName);
            Object sVal = secondaryMap.get(fieldName);

            if (jsonSnapshotValuesEqual(mVal, pVal)) {
                continue;
            }
            if (jsonSnapshotValuesEqual(mVal, sVal)) {
                MergeFieldSelection sel = new MergeFieldSelection();
                sel.fieldApiName = fieldName;
                sel.usePrimary = false;
                selections.add(sel);
            }
        }

        return selections;
    }

    /**
     * @description Applies merged field values to the surviving (primary) record Id.
     */
    public void updateSurvivorFromMergedJson(String sObjectApiName, Id survivorId, String mergedJson) {
        if (String.isBlank(mergedJson) || survivorId == null) {
            throw new AuraHandledException('Cannot apply merge: missing merged data.');
        }

        Schema.SObjectType sObjectType = resolveSObjectType(sObjectApiName);
        if (sObjectType == null) {
            throw new AuraHandledException('Unknown object type.');
        }

        Map<String, Object> valueMap = (Map<String, Object>) JSON.deserializeUntyped(mergedJson);
        Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
        SObject row = sObjectType.newSObject(survivorId);

        for (String fieldName : valueMap.keySet()) {
            if (fieldName == null || fieldName.equalsIgnoreCase('Id')) {
                continue;
            }

            Schema.SObjectField fieldToken = fieldMap.get(fieldName);
            if (fieldToken == null) {
                continue;
            }

            Schema.DescribeFieldResult dfr = fieldToken.getDescribe();
            if (!dfr.isUpdateable() || dfr.isCalculated()) {
                continue;
            }

            Object coerced = coerceMergeValueForUpdate(valueMap.get(fieldName), dfr);
            row.put(fieldName, coerced);
        }

        List<SObject> rows = new List<SObject>{ row };
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, rows);
        List<SObject> safeRows = decision.getRecords();
        if (safeRows.isEmpty()) {
            throw new AuraHandledException('Could not update record after field security checks.');
        }
        update safeRows[0];
    }

    private static Time parseTimeFromSerializedValue(String s) {
        if (String.isBlank(s)) {
            return null;
        }
        String normalized = s.trim();
        List<String> withMs = normalized.split('\\.');
        List<String> hmsParts = withMs[0].split(':');
        if (hmsParts.size() < 3) {
            throw new AuraHandledException('Unrecognized time value: ' + s);
        }
        Integer hh = Integer.valueOf(hmsParts[0].trim());
        Integer mm = Integer.valueOf(hmsParts[1].trim());
        String secDigits = hmsParts[2].replaceAll('[^0-9]', '');
        Integer ss = secDigits.length() >= 2
            ? Integer.valueOf(secDigits.substring(0, 2))
            : Integer.valueOf(secDigits);
        Integer ms = 0;
        if (withMs.size() > 1) {
            String frac = withMs[1].replaceAll('[^0-9]', '');
            if (frac.length() > 3) {
                frac = frac.substring(0, 3);
            }
            while (frac.length() < 3) {
                frac = frac + '0';
            }
            ms = Integer.valueOf(frac);
        }
        return Time.newInstance(hh, mm, ss, ms);
    }

    private static Boolean jsonSnapshotValuesEqual(Object a, Object b) {
        if (a == null && b == null) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        return JSON.serialize(a) == JSON.serialize(b);
    }

    private static Object coerceMergeValueForUpdate(Object raw, Schema.DescribeFieldResult dfr) {
        if (raw == null) {
            return null;
        }

        Schema.DisplayType displayType = dfr.getType();

        if (displayType == Schema.DisplayType.BOOLEAN) {
            if (raw instanceof Boolean) {
                return raw;
            }
            return Boolean.valueOf(String.valueOf(raw));
        }

        if (displayType == Schema.DisplayType.INTEGER) {
            Decimal asDec =
                raw instanceof Decimal
                    ? (Decimal) raw
                    : raw instanceof Integer
                        ? Decimal.valueOf((Integer) raw)
                        : Decimal.valueOf(String.valueOf(raw));
            return asDec.intValue();
        }

        if (
            displayType == Schema.DisplayType.CURRENCY ||
            displayType == Schema.DisplayType.DOUBLE ||
            displayType == Schema.DisplayType.PERCENT
        ) {
            return raw instanceof Decimal
                ? (Decimal) raw
                : Decimal.valueOf(String.valueOf(raw));
        }

        if (displayType == Schema.DisplayType.DATE) {
            if (raw instanceof Date) {
                return raw;
            }
            return Date.valueOf(String.valueOf(raw));
        }

        if (displayType == Schema.DisplayType.DATETIME) {
            if (raw instanceof Datetime) {
                return raw;
            }
            String s = String.valueOf(raw).replace('T', ' ');
            if (s.length() > 19) {
                Integer dot = s.indexOf('.');
                if (dot > 0) {
                    s = s.substring(0, dot);
                } else {
                    s = s.substring(0, 19);
                }
            }
            return Datetime.valueOf(s);
        }

        if (displayType == Schema.DisplayType.TIME) {
            if (raw instanceof Time) {
                return raw;
            }
            return parseTimeFromSerializedValue(String.valueOf(raw));
        }

        if (displayType == Schema.DisplayType.ID || displayType == Schema.DisplayType.REFERENCE) {
            if (raw instanceof Id) {
                return raw;
            }
            String s = String.valueOf(raw);
            return String.isBlank(s) ? null : Id.valueOf(s);
        }

        if (displayType == Schema.DisplayType.BASE64) {
            if (raw instanceof Blob) {
                return raw;
            }
            return EncodingUtil.base64Decode(String.valueOf(raw));
        }

        return raw instanceof String ? (String) raw : String.valueOf(raw);
    }
}