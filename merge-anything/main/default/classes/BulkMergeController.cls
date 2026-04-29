public with sharing class BulkMergeController {
    private static final String MERGE_ACTION_KEEP = 'Merge_and_Keep';
    private static final String MERGE_ACTION_REPARENT_DELETE = 'Merge_Reparent_and_Delete';

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

    @AuraEnabled(cacheable=true)
    public static Integer getMergeItemCountByMergeJobId(Id mergeJobId) {
        if (mergeJobId == null) {
            return 0;
        }
        return [
            SELECT COUNT()
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Integer getCompletedMergeItemCountByMergeJobId(Id mergeJobId) {
        if (mergeJobId == null) {
            return 0;
        }
        return [
            SELECT COUNT()
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId AND Status__c = 'Completed'
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<MergeItemStatusCountRow> getMergeItemStatusCountsByMergeJobId(Id mergeJobId) {
        Map<String, Integer> countsByStatus = new Map<String, Integer>();
        if (mergeJobId != null) {
            for (AggregateResult ar : [
                SELECT Status__c, COUNT(Id)
                FROM Merge_Item__c
                WHERE Merge_Job__c = :mergeJobId
                WITH SECURITY_ENFORCED
                GROUP BY Status__c
            ]) {
                String st = (String) ar.get('Status__c');
                if (String.isBlank(st)) {
                    continue;
                }
                Decimal raw = (Decimal) ar.get('expr0');
                countsByStatus.put(st, raw == null ? 0 : raw.intValue());
            }
        }

        List<String> ordered = new List<String>{ 'Pending', 'In Progress', 'Completed', 'Failed' };
        List<MergeItemStatusCountRow> rows = new List<MergeItemStatusCountRow>();
        Set<String> seen = new Set<String>();
        for (String st : ordered) {
            MergeItemStatusCountRow row = new MergeItemStatusCountRow();
            row.status = st;
            row.itemCount = countsByStatus.containsKey(st) ? countsByStatus.get(st) : 0;
            rows.add(row);
            seen.add(st);
        }
        for (String st : countsByStatus.keySet()) {
            if (!seen.contains(st)) {
                MergeItemStatusCountRow row = new MergeItemStatusCountRow();
                row.status = st;
                row.itemCount = countsByStatus.get(st);
                rows.add(row);
            }
        }
        return rows;
    }

    @AuraEnabled
    public static void deleteMergeItem(Id mergeItemId) {
        if (mergeItemId == null) {
            throw new AuraHandledException('Merge Item Id is required.');
        }
        List<Merge_Item__c> rows = [
            SELECT Id, Status__c, Merge_Job__c
            FROM Merge_Item__c
            WHERE Id = :mergeItemId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw new AuraHandledException('Merge item was not found.');
        }
        Merge_Item__c item = rows[0];
        if ('Completed'.equals(item.Status__c)) {
            throw new AuraHandledException(
                'Completed merge items cannot be deleted. Roll back the item first if you need to remove it.'
            );
        }
        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :item.Merge_Job__c
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            throw new AuraHandledException('Merge job was not found.');
        }
        if ('In Progress'.equals(jobs[0].Status__c)) {
            throw new AuraHandledException('Cannot delete merge items while the merge job is in progress.');
        }
        if (!Merge_Item__c.SObjectType.getDescribe().isDeletable()) {
            throw new AuraHandledException('You do not have permission to delete merge items.');
        }
        delete item;
    }

    @AuraEnabled
    public static void deleteMergeJob(Id mergeJobId) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job Id is required.');
        }
        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            throw new AuraHandledException('Merge job was not found.');
        }
        if ('In Progress'.equals(jobs[0].Status__c)) {
            throw new AuraHandledException('Cannot delete a merge job while it is in progress.');
        }
        Integer completedCount = [
            SELECT COUNT()
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId AND Status__c = 'Completed'
            WITH SECURITY_ENFORCED
        ];
        if (completedCount > 0) {
            throw new AuraHandledException(
                'This merge job has completed merge items. Roll back the merge job before deleting it.'
            );
        }
        if (!Merge_Job__c.SObjectType.getDescribe().isDeletable()) {
            throw new AuraHandledException('You do not have permission to delete merge jobs.');
        }
        delete jobs[0];
    }

    @AuraEnabled
    public static MergeJob createMergeJob() {
        return new MergeJob().create();
    }

    /**
     * @param mergeJobId        Parent Merge Job (master-detail).
     * @param sObjectApiName    API name of the records being merged.
     * @param primaryRecordId   Surviving-record candidate / primary Id.
     * @param secondaryRecordId Duplicate / secondary Id.
     * @param fieldSelections   Per-field choice: {@code usePrimary == false} takes secondary value in merged JSON.
     * @param mergeAction      {@code Merge_and_Keep} or {@code Merge_Reparent_and_Delete} ({@code null} behaves as reparent/delete).
     */
    @AuraEnabled
    public static Merge_Item__c createMergeItem(
        Id mergeJobId,
        String sObjectApiName,
        Id primaryRecordId,
        Id secondaryRecordId,
        List<RecordSelector.MergeFieldSelection> fieldSelections,
        String mergeAction
    ) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job is required.');
        }
        Merge_Job__c parentJob = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (parentJob.Status__c == 'Completed') {
            throw new AuraHandledException('Cannot add merge items to a completed merge job.');
        }
        if (String.isBlank(sObjectApiName) || primaryRecordId == null || secondaryRecordId == null) {
            throw new AuraHandledException('Object and both records are required.');
        }

        assertNoCrossJobActiveConflicts(new Set<Id>{ primaryRecordId, secondaryRecordId }, mergeJobId);

        RecordSelector.MergeJsonBlob jsonPayload = RecordSelector.getInstance()
            .buildMergeItemJson(sObjectApiName, primaryRecordId, secondaryRecordId, fieldSelections);
        if (jsonPayload == null) {
            throw new AuraHandledException('Could not build merge data for the selected records.');
        }

        Map<String, Datetime> pairModified = queryLastModifiedForPair(primaryRecordId, secondaryRecordId);

        List<RecordSelector.MergeFieldSelection> selectionsToStore = fieldSelections != null
            ? fieldSelections
            : new List<RecordSelector.MergeFieldSelection>();

        Merge_Item__c item = new Merge_Item__c(
            Merge_Job__c = mergeJobId,
            Primary_Record_Id__c = primaryRecordId,
            Secondary_Record_Id__c = secondaryRecordId,
            Primary_Record_Name__c = jsonPayload.primaryRecordName,
            Secondary_Record_Name__c = jsonPayload.secondaryRecordName,
            Field_Selections_JSON__c = JSON.serialize(selectionsToStore),
            Primary_Record_JSON__c = jsonPayload.primaryJson,
            Secondary_Record_JSON__c = jsonPayload.secondaryJson,
            Merged_Record_JSON__c = jsonPayload.mergedJson,
            Primary_Source_Modified__c = pairModified.get(String.valueOf(primaryRecordId)),
            Secondary_Source_Modified__c = pairModified.get(String.valueOf(secondaryRecordId)),
            Record_Object__c = sObjectApiName,
            Merge_Action__c = normalizeMergeAction(mergeAction)
        );
        insert item;

        return [
            SELECT
                Id,
                Name,
                Link__c,
                Merge_Job__c,
                Primary_Record_Name__c,
                Secondary_Record_Name__c,
                Primary_Record_Link__c,
                Secondary_Record_Link__c,
                Merge_Action__c
            FROM Merge_Item__c
            WHERE Id = :item.Id
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<EntityDefinition> getEntityDefinitionsByLabel(String label) {
        return EntityDefinitionSelector.getInstance().getEntityDefinitionsByLabel(label);
    }

    @AuraEnabled(cacheable=true)
    public static List<EntityDefinition> getAllEntityDefinitions() {
        return EntityDefinitionSelector.getInstance().getAllEntityDefinitions();
    }

    /**
     * @param sObjectApiName Qualified API name of the sObject to query (e.g. Account, Custom__c)
     * @param name           Name search value used when the object supports Name filtering
     * @return Search options normalized to always return Id + Name
     */
    @AuraEnabled(cacheable=true)
    public static List<RecordSelector.RecordSearchOption> getRecordsWithEditableFields(String sObjectApiName, String name) {
        return RecordSelector.getInstance().getRecordSearchOptions(sObjectApiName, name, null);
    }

    /**
     * @description Editable field values for two records of the same object type, for the merge field picker UI.
     */
    @AuraEnabled
    public static List<RecordSelector.MergeFieldRow> getMergeFieldRows(String sObjectApiName, Id primaryId, Id secondaryId) {
        return RecordSelector.getInstance().getMergeFieldRows(sObjectApiName, primaryId, secondaryId);
    }

    /**
     * @description Read-only field diff per pending/failed merge item from stored JSON (does not refresh live records).
     */
    @AuraEnabled(cacheable=true)
    public static List<MergeJobItemPreviewSection> getMergeJobFieldPreview(Id mergeJobId) {
        List<MergeJobItemPreviewSection> sections = new List<MergeJobItemPreviewSection>();
        if (mergeJobId == null) {
            return sections;
        }

        List<Merge_Item__c> items = MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
        RecordSelector selector = RecordSelector.getInstance();

        for (Merge_Item__c item : items) {
            if ('Completed'.equals(item.Status__c)) {
                continue;
            }
            if (String.isBlank(item.Primary_Record_Id__c) || String.isBlank(item.Merged_Record_JSON__c)) {
                continue;
            }

            Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
            String objectApiName = primaryId.getSObjectType().getDescribe().getName();

            MergeJobItemPreviewSection section = new MergeJobItemPreviewSection();
            section.mergeItemId = item.Id;
            section.mergeItemName = item.Name;
            section.objectApiName = objectApiName;
            section.fieldRows = selector.buildMergePreviewFieldRowsFromJson(
                objectApiName,
                item.Primary_Record_JSON__c,
                item.Secondary_Record_JSON__c,
                item.Merged_Record_JSON__c
            );
            sections.add(section);
        }
        return sections;
    }

    /**
     * @description Validates pending/failed items: duplicate primary and cross-job concurrency, stale snapshots,
     *              and survivor update using savepoint + rollback (no persistent DML on merged data).
     */
    @AuraEnabled
    public static MergeJobValidationResult validateMergeJob(Id mergeJobId) {
        MergeJobValidationResult result = new MergeJobValidationResult();
        result.jobLevelErrors = new List<String>();
        result.items = new List<MergeItemValidationRow>();
        result.allItemsValid = true;

        if (mergeJobId == null) {
            result.jobLevelErrors.add('Merge Job Id is required.');
            result.allItemsValid = false;
            return result;
        }

        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            result.jobLevelErrors.add('Merge job was not found.');
            result.allItemsValid = false;
            return result;
        }
        if (jobs[0].Status__c == 'Completed') {
            result.jobLevelErrors.add('This merge job is already completed.');
            result.allItemsValid = false;
            return result;
        }

        List<Merge_Item__c> allItems = MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
        List<Merge_Item__c> workItems = new List<Merge_Item__c>();
        for (Merge_Item__c probe : allItems) {
            if (!'Completed'.equals(probe.Status__c)) {
                workItems.add(probe);
            }
        }
        if (workItems.isEmpty()) {
            result.jobLevelErrors.add('There are no pending or failed merge items to validate.');
            result.allItemsValid = false;
            return result;
        }

        result.jobLevelErrors.addAll(collectDuplicatePrimaryJobErrors(workItems));
        result.jobLevelErrors.addAll(collectCrossJobConflictErrors(workItems, mergeJobId));

        Map<String, Datetime> lastModifiedByIdKey = queryLastModifiedMapForWorkItems(workItems);
        RecordSelector selector = RecordSelector.getInstance();

        for (Merge_Item__c item : workItems) {
            MergeItemValidationRow row = new MergeItemValidationRow();
            row.mergeItemId = item.Id;
            row.mergeItemName = item.Name != null ? item.Name : String.valueOf(item.Id);
            row.errors = new List<String>();
            row.warnings = new List<String>();

            String staleLine = describeStaleItemIfChanged(item, lastModifiedByIdKey);
            if (staleLine != null) {
                row.errors.add(staleLine);
            }

            try {
                if (item.Primary_Record_Id__c == null || item.Secondary_Record_Id__c == null) {
                    throw new AuraHandledException('Merge Item is missing primary or secondary record Id.');
                }

                Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
                Id secondaryId = Id.valueOf(item.Secondary_Record_Id__c);
                if (primaryId == secondaryId) {
                    throw new AuraHandledException('Primary and secondary record Ids must be different.');
                }

                String primaryTypeName = primaryId.getSObjectType().getDescribe().getName();
                String secondaryTypeName = secondaryId.getSObjectType().getDescribe().getName();
                if (primaryTypeName != secondaryTypeName) {
                    throw new AuraHandledException('Primary and secondary records must be the same object type.');
                }

                List<RecordSelector.MergeFieldSelection> selections = selector.parseFieldSelectionsFromJson(
                    item.Field_Selections_JSON__c
                );
                if (selections.isEmpty()) {
                    selections = selector.inferFieldSelectionsFromStoredJson(
                        item.Primary_Record_JSON__c,
                        item.Secondary_Record_JSON__c,
                        item.Merged_Record_JSON__c
                    );
                }

                String mergedJson = selector.buildMergedRecordJson(primaryTypeName, primaryId, secondaryId, selections);
                if (String.isBlank(mergedJson)) {
                    throw new AuraHandledException(
                        'Could not rebuild merged JSON; verify both records still exist.'
                    );
                }

                SObject survivorRow = selector.buildSurvivorUpdateRowFromMergedJson(
                    primaryTypeName,
                    primaryId,
                    mergedJson
                );

                System.Savepoint sp = Database.setSavepoint();
                try {
                    update survivorRow;
                } catch (Exception updateEx) {
                    row.errors.add(mergeFailureMessage(updateEx));
                } finally {
                    Database.rollback(sp);
                }
            } catch (Exception ex) {
                row.errors.add(mergeFailureMessage(ex));
            }

            row.isValid = row.errors.isEmpty();
            if (!row.isValid) {
                result.allItemsValid = false;
            }
            result.items.add(row);
        }

        if (!result.jobLevelErrors.isEmpty()) {
            result.allItemsValid = false;
        }

        return result;
    }

    private static String normalizeMergeAction(String mergeActionRaw) {
        if (MERGE_ACTION_KEEP.equals(mergeActionRaw)) {
            return MERGE_ACTION_KEEP;
        }
        return MERGE_ACTION_REPARENT_DELETE;
    }

    private static Boolean mergeActionReparentsThenDeletes(String normalized) {
        return MERGE_ACTION_REPARENT_DELETE.equals(normalized);
    }

    private class MergeItemProcessResult {
        Boolean success;
        String secondaryTypeName;
        Id secondaryId;
        Boolean queueSecondaryDeletion;
        String errorLine;
    }

    /**
     * @description Shared row-level merge execution (savepoint per item). Used by synchronous job run and async chunks.
     */
    private static MergeItemProcessResult processMergeItemRow(Merge_Item__c item, RecordSelector selector) {
        MergeItemProcessResult res = new MergeItemProcessResult();
        res.success = false;
        res.queueSecondaryDeletion = false;
        String itemLabel = item.Name != null ? item.Name : String.valueOf(item.Id);
        try {
            if (item.Primary_Record_Id__c == null || item.Secondary_Record_Id__c == null) {
                throw new AuraHandledException('Merge Item is missing primary or secondary record Id.');
            }

            Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
            Id secondaryId = Id.valueOf(item.Secondary_Record_Id__c);

            if (primaryId == secondaryId) {
                throw new AuraHandledException('Primary and secondary record Ids must be different.');
            }

            String primaryTypeName = primaryId.getSObjectType().getDescribe().getName();
            String secondaryTypeName = secondaryId.getSObjectType().getDescribe().getName();
            if (primaryTypeName != secondaryTypeName) {
                throw new AuraHandledException('Primary and secondary records must be the same object type.');
            }

            String mergeActionNormalized = normalizeMergeAction(item.Merge_Action__c);

            List<RecordSelector.MergeFieldSelection> selections = selector.parseFieldSelectionsFromJson(
                item.Field_Selections_JSON__c
            );
            if (selections.isEmpty()) {
                selections = selector.inferFieldSelectionsFromStoredJson(
                    item.Primary_Record_JSON__c,
                    item.Secondary_Record_JSON__c,
                    item.Merged_Record_JSON__c
                );
            }

            String mergedJson = selector.buildMergedRecordJson(primaryTypeName, primaryId, secondaryId, selections);
            if (String.isBlank(mergedJson)) {
                throw new AuraHandledException(
                    'Could not rebuild merged JSON; verify both records still exist.'
                );
            }

            SObject survivorRow = selector.buildSurvivorUpdateRowFromMergedJson(
                primaryTypeName,
                primaryId,
                mergedJson
            );

            System.Savepoint sp = Database.setSavepoint();
            try {
                update survivorRow;

                if (mergeActionReparentsThenDeletes(mergeActionNormalized)) {
                    MergeRelationshipRepointer.reparentInboundLookups(primaryTypeName, secondaryId, primaryId);
                }

                Merge_Item__c itemSuccess = new Merge_Item__c(
                    Id = item.Id,
                    Merged_Record_JSON__c = mergedJson,
                    Merge_Error__c = null,
                    Status__c = 'Completed',
                    Attempt_Count__c = 0
                );
                update itemSuccess;

                res.success = true;
                res.secondaryTypeName = secondaryTypeName;
                res.secondaryId = secondaryId;
                res.queueSecondaryDeletion = mergeActionReparentsThenDeletes(mergeActionNormalized);
            } catch (Exception updateEx) {
                Database.rollback(sp);
                String errMsg = mergeFailureMessage(updateEx);
                failMergeItem(item.Id, errMsg);
                res.errorLine = itemLabel + ': ' + errMsg;
            }
        } catch (Exception ex) {
            String errMsg = mergeFailureMessage(ex);
            failMergeItem(item.Id, errMsg);
            res.errorLine = itemLabel + ': ' + errMsg;
        }
        return res;
    }

    /**
     * @description Sets the job to In Progress, then processes each non-Completed merge item: validates input, updates
     *              the surviving primary from merged JSON; when Merge Action is &quot;Merge, Reparent and Delete&quot;, reparents
     *              inbound lookups from the duplicate to the primary and deletes the duplicate; &quot;Merge and Keep&quot; updates the
     *              primary only. Record update failures are isolated with {@link Database#setSavepoint}: the failed item is set
     *              to Failed and {@code Merge_Error__c} stores the message; other items continue. Secondaries are deleted only
     *              for successful items that use &quot;Merge, Reparent and Delete&quot;. Job status is Completed when every processed
     *              item succeeds; otherwise Failed (including partial success).
     */
    @AuraEnabled
    public static MergeJobExecutionResult executeMergeJob(Id mergeJobId) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job Id is required.');
        }

        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            throw new AuraHandledException('Merge job was not found.');
        }
        if (jobs[0].Status__c == 'Completed') {
            throw new AuraHandledException('This merge job is already completed.');
        }
        if ('In Progress'.equals(jobs[0].Status__c)) {
            throw new AuraHandledException(
                'This merge job is already in progress. Wait for background processing to finish, then refresh.'
            );
        }

        List<Merge_Item__c> items = MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
        RecordSelector selector = RecordSelector.getInstance();

        List<Merge_Item__c> workItems = new List<Merge_Item__c>();
        for (Merge_Item__c workProbe : items) {
            if (!'Completed'.equals(workProbe.Status__c)) {
                workItems.add(workProbe);
            }
        }
        if (workItems.isEmpty()) {
            throw new AuraHandledException('There are no pending or failed merge items to process.');
        }

        List<String> preconditionErrors = new List<String>();
        preconditionErrors.addAll(collectDuplicatePrimaryJobErrors(workItems));
        preconditionErrors.addAll(collectCrossJobConflictErrors(workItems, mergeJobId));
        Map<String, Datetime> lastModifiedByIdKey = queryLastModifiedMapForWorkItems(workItems);
        for (Merge_Item__c wi : workItems) {
            String staleLine = describeStaleItemIfChanged(wi, lastModifiedByIdKey);
            if (staleLine != null) {
                preconditionErrors.add(staleLine);
            }
        }
        if (!preconditionErrors.isEmpty()) {
            throw new AuraHandledException(String.join(preconditionErrors, ' '));
        }

        update new Merge_Job__c(Id = mergeJobId, Status__c = 'In Progress');

        Integer successCount = 0;
        Integer failureCount = 0;
        List<String> errorLines = new List<String>();
        Map<String, Set<Id>> secondaryIdsByType = new Map<String, Set<Id>>();

        for (Merge_Item__c item : items) {
            if ('Completed'.equals(item.Status__c)) {
                continue;
            }

            MergeItemProcessResult rowResult = processMergeItemRow(item, selector);
            if (rowResult.success && rowResult.queueSecondaryDeletion) {
                if (!secondaryIdsByType.containsKey(rowResult.secondaryTypeName)) {
                    secondaryIdsByType.put(rowResult.secondaryTypeName, new Set<Id>());
                }
                secondaryIdsByType.get(rowResult.secondaryTypeName).add(rowResult.secondaryId);
                successCount++;
            } else if (rowResult.success) {
                successCount++;
            } else {
                failureCount++;
                errorLines.add(rowResult.errorLine);
            }
        }

        if (!secondaryIdsByType.isEmpty()) {
            deleteSecondaryRecordsForMerge(secondaryIdsByType);
        }

        String jobFinalStatus = failureCount == 0 ? 'Completed' : 'Failed';
        update new Merge_Job__c(Id = mergeJobId, Status__c = jobFinalStatus);

        MergeJobExecutionResult result = new MergeJobExecutionResult();
        result.jobStatus = jobFinalStatus;
        result.successCount = successCount;
        result.failureCount = failureCount;
        result.errors = errorLines;
        return result;
    }

    /**
     * @description Enqueues background merge processing (chunked queueables) for large jobs or long-running merges.
     */
    @AuraEnabled
    public static void startMergeJobInBackground(Id mergeJobId) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job Id is required.');
        }

        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            throw new AuraHandledException('Merge job was not found.');
        }
        if (jobs[0].Status__c == 'Completed') {
            throw new AuraHandledException('This merge job is already completed.');
        }
        if ('In Progress'.equals(jobs[0].Status__c)) {
            throw new AuraHandledException('This merge job is already in progress.');
        }

        System.enqueueJob(new MergeJobQueueable(mergeJobId, true));
    }

    /**
     * @description Invoked only from {@link MergeJobQueueable}.
     */
    public static void runAsyncMergeJobChunk(Id mergeJobId, Boolean firstRun) {
        Id notifyUserId = UserInfo.getUserId();
        try {
            List<Merge_Job__c> jobs = [
                SELECT Id, Status__c, CreatedById
                FROM Merge_Job__c
                WHERE Id = :mergeJobId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            if (jobs.isEmpty()) {
                return;
            }
            Merge_Job__c job = jobs[0];
            notifyUserId = job.CreatedById != null ? job.CreatedById : UserInfo.getUserId();

            if (job.Status__c == 'Completed') {
                return;
            }

            List<Merge_Item__c> allItems = MergeItemSelector.getInstance().getMergeItemsByMergeJobId(mergeJobId);
            List<Merge_Item__c> workItems = new List<Merge_Item__c>();
            for (Merge_Item__c w : allItems) {
                if (!'Completed'.equals(w.Status__c)) {
                    workItems.add(w);
                }
            }

            if (firstRun) {
                if (workItems.isEmpty()) {
                    update new Merge_Job__c(
                        Id = mergeJobId,
                        Async_Last_Error__c = truncateAsyncJobError(
                            'There are no pending or failed merge items to process.'
                        )
                    );
                    return;
                }

                List<String> preconditionErrors = new List<String>();
                preconditionErrors.addAll(collectDuplicatePrimaryJobErrors(workItems));
                preconditionErrors.addAll(collectCrossJobConflictErrors(workItems, mergeJobId));
                Map<String, Datetime> lastModifiedByIdKey = queryLastModifiedMapForWorkItems(workItems);
                for (Merge_Item__c wi : workItems) {
                    String staleLine = describeStaleItemIfChanged(wi, lastModifiedByIdKey);
                    if (staleLine != null) {
                        preconditionErrors.add(staleLine);
                    }
                }
                if (!preconditionErrors.isEmpty()) {
                    String msg = String.join(preconditionErrors, ' ');
                    update new Merge_Job__c(
                        Id = mergeJobId,
                        Status__c = 'Pending',
                        Async_Last_Error__c = truncateAsyncJobError(msg)
                    );
                    MergeJobNotificationService.notifyMergeJobPrecheckFailed(mergeJobId, notifyUserId, msg);
                    return;
                }

                update new Merge_Job__c(Id = mergeJobId, Status__c = 'In Progress', Async_Last_Error__c = null);
            }

            final Integer chunkSize = 15;
            List<Merge_Item__c> chunk = MergeItemSelector.getInstance()
                .getNonCompletedMergeItemsChunk(mergeJobId, chunkSize);
            if (chunk.isEmpty()) {
                finalizeAsyncMergeJob(mergeJobId, notifyUserId);
                return;
            }

            RecordSelector selector = RecordSelector.getInstance();
            Map<String, Set<Id>> secondaryIdsByType = new Map<String, Set<Id>>();
            for (Merge_Item__c item : chunk) {
                MergeItemProcessResult pr = processMergeItemRow(item, selector);
                if (
                    pr.success &&
                    pr.queueSecondaryDeletion &&
                    !String.isBlank(pr.secondaryTypeName) &&
                    pr.secondaryId != null
                ) {
                    if (!secondaryIdsByType.containsKey(pr.secondaryTypeName)) {
                        secondaryIdsByType.put(pr.secondaryTypeName, new Set<Id>());
                    }
                    secondaryIdsByType.get(pr.secondaryTypeName).add(pr.secondaryId);
                }
            }

            if (!secondaryIdsByType.isEmpty()) {
                deleteSecondaryRecordsForMerge(secondaryIdsByType);
            }

            Integer remaining = MergeItemSelector.getInstance().countNonCompletedMergeItems(mergeJobId);
            if (remaining > 0) {
                System.enqueueJob(new MergeJobQueueable(mergeJobId, false));
            } else {
                finalizeAsyncMergeJob(mergeJobId, notifyUserId);
            }
        } catch (Exception e) {
            try {
                update new Merge_Job__c(
                    Id = mergeJobId,
                    Status__c = 'Pending',
                    Async_Last_Error__c = truncateAsyncJobError(e.getMessage())
                );
            } catch (Exception ignored) {
                System.debug(LoggingLevel.ERROR, ignored.getMessage());
            }
            MergeJobNotificationService.notifyMergeJobPrecheckFailed(
                mergeJobId,
                notifyUserId,
                mergeFailureMessage(e)
            );
        }
    }

    private static void finalizeAsyncMergeJob(Id mergeJobId, Id notifyUserId) {
        Integer failed = [
            SELECT COUNT()
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId AND Status__c = 'Failed'
            WITH SECURITY_ENFORCED
        ];
        String jobFinalStatus = failed > 0 ? 'Failed' : 'Completed';
        update new Merge_Job__c(Id = mergeJobId, Status__c = jobFinalStatus, Async_Last_Error__c = null);
        MergeJobNotificationService.notifyMergeJobFinished(mergeJobId, notifyUserId, jobFinalStatus, failed);
    }

    private static String truncateAsyncJobError(String message) {
        if (String.isBlank(message)) {
            return null;
        }
        Integer maxLen = 2000;
        return message.length() > maxLen ? message.substring(0, maxLen) : message;
    }

    @TestVisible
    private static final Integer MERGE_ERROR_MAX_LENGTH = 131072;

    private static String mergeFailureMessage(Exception e) {
        if (e instanceof DmlException) {
            DmlException dmx = (DmlException) e;
            if (dmx.getNumDml() > 0) {
                return truncateMergeError(dmx.getDmlMessage(0));
            }
        }
        return truncateMergeError(e.getMessage());
    }

    private static String truncateMergeError(String message) {
        if (String.isBlank(message)) {
            return 'Unknown error.';
        }
        if (message.length() > MERGE_ERROR_MAX_LENGTH) {
            return message.substring(0, MERGE_ERROR_MAX_LENGTH);
        }
        return message;
    }

    private static void failMergeItem(Id mergeItemId, String errorMessage) {
        List<Merge_Item__c> rows = [
            SELECT Attempt_Count__c
            FROM Merge_Item__c
            WHERE Id = :mergeItemId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        Integer nextAttempt = 1;
        if (!rows.isEmpty() && rows[0].Attempt_Count__c != null) {
            nextAttempt = rows[0].Attempt_Count__c.intValue() + 1;
        }
        update new Merge_Item__c(
            Id = mergeItemId,
            Status__c = 'Failed',
            Merge_Error__c = errorMessage,
            Attempt_Count__c = nextAttempt
        );
    }

    /**
     * @description Deletes stub rows by Id per object type for successful merge items; enforces delete access via
     *              {@code Database.delete(..., USER_MODE)}. All deletes run in the current transaction (all or none).
     */
    private static void deleteSecondaryRecordsForMerge(Map<String, Set<Id>> secondaryIdsByType) {
        if (secondaryIdsByType == null || secondaryIdsByType.isEmpty()) {
            return;
        }

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

        for (String typeName : secondaryIdsByType.keySet()) {
            Schema.SObjectType sobType = globalDescribe.get(typeName);
            if (sobType == null) {
                throw new AuraHandledException('Unknown object type for secondary delete: ' + typeName);
            }

            Set<Id> idSet = secondaryIdsByType.get(typeName);
            if (idSet == null || idSet.isEmpty()) {
                continue;
            }

            Schema.DescribeSObjectResult dsr = sobType.getDescribe();
            if (!dsr.isDeletable()) {
                throw new AuraHandledException(
                    'Cannot delete secondary ' + dsr.getLabel() + ' records: delete permission is required.'
                );
            }

            List<SObject> toDelete = new List<SObject>();
            for (Id secId : idSet) {
                toDelete.add(sobType.newSObject(secId));
            }

            Database.delete(toDelete, true, AccessLevel.USER_MODE);
        }
    }

    private static List<String> collectDuplicatePrimaryJobErrors(List<Merge_Item__c> workItems) {
        List<String> errors = new List<String>();
        Map<String, Integer> primaryCount = new Map<String, Integer>();
        for (Merge_Item__c item : workItems) {
            if (String.isBlank(item.Primary_Record_Id__c)) {
                continue;
            }
            String p = item.Primary_Record_Id__c;
            Integer c = primaryCount.containsKey(p) ? primaryCount.get(p) + 1 : 1;
            primaryCount.put(p, c);
        }
        for (String p : primaryCount.keySet()) {
            if (primaryCount.get(p) > 1) {
                errors.add('Duplicate primary record ' + p + ' appears on more than one merge item in this job.');
            }
        }
        return errors;
    }

    private static List<String> collectCrossJobConflictErrors(List<Merge_Item__c> workItems, Id mergeJobId) {
        Set<Id> idSet = new Set<Id>();
        for (Merge_Item__c item : workItems) {
            if (!String.isBlank(item.Primary_Record_Id__c)) {
                idSet.add(Id.valueOf(item.Primary_Record_Id__c));
            }
            if (!String.isBlank(item.Secondary_Record_Id__c)) {
                idSet.add(Id.valueOf(item.Secondary_Record_Id__c));
            }
        }
        List<String> errors = new List<String>();
        if (idSet.isEmpty()) {
            return errors;
        }
        List<Merge_Item__c> conflicts = [
            SELECT Id, Name, Merge_Job__r.Name, Merge_Job__c
            FROM Merge_Item__c
            WHERE
                Merge_Job__c != :mergeJobId
                AND Status__c IN ('Pending', 'In Progress')
                AND (Primary_Record_Id__c IN :idSet OR Secondary_Record_Id__c IN :idSet)
            WITH SECURITY_ENFORCED
            LIMIT 25
        ];
        for (Merge_Item__c c : conflicts) {
            errors.add(
                'Concurrency: merge item "' +
                    c.Name +
                    '" on job "' +
                    c.Merge_Job__r.Name +
                    '" already uses one of these records (Pending or In Progress).'
            );
        }
        return errors;
    }

    private static void assertNoCrossJobActiveConflicts(Set<Id> recordIds, Id mergeJobId) {
        if (recordIds == null || recordIds.isEmpty()) {
            return;
        }
        List<Merge_Item__c> conflicts = [
            SELECT Id, Name, Merge_Job__r.Name
            FROM Merge_Item__c
            WHERE
                Merge_Job__c != :mergeJobId
                AND Status__c IN ('Pending', 'In Progress')
                AND (Primary_Record_Id__c IN :recordIds OR Secondary_Record_Id__c IN :recordIds)
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (conflicts.isEmpty()) {
            return;
        }
        Merge_Item__c c = conflicts[0];
        throw new AuraHandledException(
            'Another merge item ("' +
                c.Name +
                '" on job "' +
                c.Merge_Job__r.Name +
                '") already references one of these records. Finish or remove that item first.'
        );
    }

    private static Map<String, Datetime> queryLastModifiedMapForWorkItems(List<Merge_Item__c> workItems) {
        Map<String, Set<Id>> idsByType = new Map<String, Set<Id>>();
        for (Merge_Item__c item : workItems) {
            if (String.isBlank(item.Primary_Record_Id__c) || String.isBlank(item.Secondary_Record_Id__c)) {
                continue;
            }
            Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
            String typeName = primaryId.getSObjectType().getDescribe().getName();
            if (!idsByType.containsKey(typeName)) {
                idsByType.put(typeName, new Set<Id>());
            }
            idsByType.get(typeName).add(primaryId);
            idsByType.get(typeName).add(Id.valueOf(item.Secondary_Record_Id__c));
        }
        return queryLastModifiedByTypes(idsByType);
    }

    private static Map<String, Datetime> queryLastModifiedByTypes(Map<String, Set<Id>> idsByType) {
        Map<String, Datetime> out = new Map<String, Datetime>();
        if (idsByType == null || idsByType.isEmpty()) {
            return out;
        }
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        for (String typeName : idsByType.keySet()) {
            Set<Id> idSet = idsByType.get(typeName);
            if (idSet == null || idSet.isEmpty()) {
                continue;
            }
            Schema.SObjectType sobType = globalDescribe.get(typeName.toLowerCase());
            if (sobType == null) {
                continue;
            }
            String soql =
                'SELECT Id, LastModifiedDate FROM ' +
                typeName +
                ' WHERE Id IN :idSet WITH SECURITY_ENFORCED';
            for (SObject row : Database.query(soql)) {
                out.put(String.valueOf(row.get('Id')), (Datetime) row.get('LastModifiedDate'));
            }
        }
        return out;
    }

    private static Map<String, Datetime> queryLastModifiedForPair(Id primaryId, Id secondaryId) {
        Map<String, Set<Id>> m = new Map<String, Set<Id>>();
        String typeName = primaryId.getSObjectType().getDescribe().getName();
        m.put(typeName, new Set<Id>{ primaryId, secondaryId });
        return queryLastModifiedByTypes(m);
    }

    private static String describeStaleItemIfChanged(Merge_Item__c item, Map<String, Datetime> lmByIdKey) {
        if (item.Primary_Source_Modified__c == null && item.Secondary_Source_Modified__c == null) {
            return null;
        }
        if (String.isBlank(item.Primary_Record_Id__c) || String.isBlank(item.Secondary_Record_Id__c)) {
            return null;
        }
        Id pId = Id.valueOf(item.Primary_Record_Id__c);
        Id sId = Id.valueOf(item.Secondary_Record_Id__c);
        Datetime pLm = lmByIdKey.get(String.valueOf(pId));
        Datetime sLm = lmByIdKey.get(String.valueOf(sId));
        String itemLabel = item.Name != null ? item.Name : String.valueOf(item.Id);
        if (item.Primary_Source_Modified__c != null && pLm != null && pLm != item.Primary_Source_Modified__c) {
            return itemLabel +
                ': Primary record changed since this merge item was created; refresh field data before merging.';
        }
        if (item.Secondary_Source_Modified__c != null && sLm != null && sLm != item.Secondary_Source_Modified__c) {
            return itemLabel +
                ': Secondary record changed since this merge item was created; refresh field data before merging.';
        }
        return null;
    }

    /**
     * @description Rolls back every completed merge item on the job: restores primary records from
     *              {@code Primary_Record_JSON__c}, undeletes secondaries, sets items to Pending, and sets the job to
     *              Pending. All-or-none in a single transaction.
     */
    @AuraEnabled
    public static void rollbackMergeJob(Id mergeJobId) {
        if (mergeJobId == null) {
            throw new AuraHandledException('Merge Job Id is required.');
        }

        List<Merge_Job__c> jobs = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :mergeJobId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobs.isEmpty()) {
            throw new AuraHandledException('Merge job was not found.');
        }
        if (jobs[0].Status__c != 'Completed' && jobs[0].Status__c != 'Failed') {
            throw new AuraHandledException(
                'Roll back is only available when the merge job is completed or partially failed.'
            );
        }

        List<Merge_Item__c> completedItems = [
            SELECT
                Id,
                Name,
                Merge_Action__c,
                Primary_Record_Id__c,
                Primary_Record_JSON__c,
                Secondary_Record_Id__c,
                Status__c
            FROM Merge_Item__c
            WHERE Merge_Job__c = :mergeJobId AND Status__c = 'Completed'
            WITH SECURITY_ENFORCED
        ];

        if (completedItems.isEmpty()) {
            throw new AuraHandledException('There are no completed merge items to roll back.');
        }

        rollbackMergeItemsCore(completedItems);
        update new Merge_Job__c(Id = mergeJobId, Status__c = 'Pending');
    }

    /**
     * @description Rolls back one completed merge item when its parent job is still completed: restores the primary and
     *              undeletes the secondary; sets the item to Pending.
     */
    @AuraEnabled
    public static void rollbackMergeItem(Id mergeItemId) {
        if (mergeItemId == null) {
            throw new AuraHandledException('Merge Item Id is required.');
        }

        List<Merge_Item__c> rows = [
            SELECT Id, Name, Merge_Job__c, Merge_Action__c, Status__c, Primary_Record_Id__c, Primary_Record_JSON__c, Secondary_Record_Id__c
            FROM Merge_Item__c
            WHERE Id = :mergeItemId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw new AuraHandledException('Merge item was not found.');
        }

        Merge_Item__c item = rows[0];
        if (item.Status__c != 'Completed') {
            throw new AuraHandledException('Only completed merge items can be rolled back.');
        }

        List<Merge_Job__c> jobRows = [
            SELECT Id, Status__c
            FROM Merge_Job__c
            WHERE Id = :item.Merge_Job__c
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (jobRows.isEmpty() || (jobRows[0].Status__c != 'Completed' && jobRows[0].Status__c != 'Failed')) {
            throw new AuraHandledException(
                'Roll back is only available when the merge job is completed or partially failed.'
            );
        }

        rollbackMergeItemsCore(new List<Merge_Item__c>{ item });
    }

    private static void rollbackMergeItemsCore(List<Merge_Item__c> items) {
        RecordSelector selector = RecordSelector.getInstance();
        Map<String, Map<Id, SObject>> restoresByType = new Map<String, Map<Id, SObject>>();
        Set<Id> secondaryIdSet = new Set<Id>();

        for (Merge_Item__c item : items) {
            String itemLabel = item.Name != null ? item.Name : String.valueOf(item.Id);
            if (String.isBlank(item.Primary_Record_Id__c) || String.isBlank(item.Secondary_Record_Id__c)) {
                throw new AuraHandledException(itemLabel + ': Primary or secondary record Id is missing for roll back.');
            }
            if (String.isBlank(item.Primary_Record_JSON__c)) {
                throw new AuraHandledException(itemLabel + ': Primary record snapshot is missing; cannot roll back.');
            }

            Id primaryId = Id.valueOf(item.Primary_Record_Id__c);
            Id secondaryId = Id.valueOf(item.Secondary_Record_Id__c);

            if (primaryId == secondaryId) {
                throw new AuraHandledException(itemLabel + ': Primary and secondary record Ids must be different.');
            }

            String primaryTypeName = primaryId.getSObjectType().getDescribe().getName();
            String secondaryTypeName = secondaryId.getSObjectType().getDescribe().getName();
            if (primaryTypeName != secondaryTypeName) {
                throw new AuraHandledException(
                    itemLabel + ': Primary and secondary records must be the same object type.'
                );
            }

            SObject restoreRow = selector.buildSurvivorUpdateRowFromMergedJson(
                primaryTypeName,
                primaryId,
                item.Primary_Record_JSON__c
            );
            String restoreTypeName = restoreRow.getSObjectType().getDescribe().getName();
            if (!restoresByType.containsKey(restoreTypeName)) {
                restoresByType.put(restoreTypeName, new Map<Id, SObject>());
            }
            restoresByType.get(restoreTypeName).put(primaryId, restoreRow);
            if (mergeActionReparentsThenDeletes(normalizeMergeAction(item.Merge_Action__c))) {
                secondaryIdSet.add(secondaryId);
            }
        }

        for (String typeName : restoresByType.keySet()) {
            List<SObject> rowValues = restoresByType.get(typeName).values();
            if (!rowValues.isEmpty()) {
                update rowValues;
            }
        }

        if (!secondaryIdSet.isEmpty()) {
            List<Id> toUndelete = new List<Id>(secondaryIdSet);
            try {
                Database.undelete(toUndelete, true);
            } catch (Exception e) {
                throw new AuraHandledException('Could not undelete secondary records: ' + e.getMessage());
            }
        }

        Map<String, Datetime> freshLm = queryLastModifiedMapForWorkItems(items);
        List<Merge_Item__c> toPending = new List<Merge_Item__c>();
        for (Merge_Item__c pendingItem : items) {
            Id pId = Id.valueOf(pendingItem.Primary_Record_Id__c);
            Id sId = Id.valueOf(pendingItem.Secondary_Record_Id__c);
            toPending.add(
                new Merge_Item__c(
                    Id = pendingItem.Id,
                    Status__c = 'Pending',
                    Merge_Error__c = null,
                    Attempt_Count__c = 0,
                    Primary_Source_Modified__c = freshLm.get(String.valueOf(pId)),
                    Secondary_Source_Modified__c = freshLm.get(String.valueOf(sId))
                )
            );
        }
        update toPending;
    }

    public class MergeJobItemPreviewSection {
        @AuraEnabled
        public Id mergeItemId { get; set; }
        @AuraEnabled
        public String mergeItemName { get; set; }
        @AuraEnabled
        public String objectApiName { get; set; }
        @AuraEnabled
        public List<RecordSelector.MergePreviewFieldRow> fieldRows { get; set; }
    }

    public class MergeJobValidationResult {
        @AuraEnabled
        public List<String> jobLevelErrors { get; set; }
        @AuraEnabled
        public List<MergeItemValidationRow> items { get; set; }
        @AuraEnabled
        public Boolean allItemsValid { get; set; }
    }

    public class MergeItemValidationRow {
        @AuraEnabled
        public Id mergeItemId { get; set; }
        @AuraEnabled
        public String mergeItemName { get; set; }
        @AuraEnabled
        public Boolean isValid { get; set; }
        @AuraEnabled
        public List<String> errors { get; set; }
        @AuraEnabled
        public List<String> warnings { get; set; }
    }

    public class MergeJobExecutionResult {
        @AuraEnabled
        public String jobStatus { get; set; }
        @AuraEnabled
        public Integer successCount { get; set; }
        @AuraEnabled
        public Integer failureCount { get; set; }
        @AuraEnabled
        public List<String> errors { get; set; }
    }

    public class MergeItemStatusCountRow {
        @AuraEnabled
        public String status { get; set; }
        @AuraEnabled
        public Integer itemCount { get; set; }
    }
}