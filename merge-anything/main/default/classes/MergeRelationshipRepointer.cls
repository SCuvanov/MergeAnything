/**
 * Reparents inbound lookup fields from a duplicate Id to its surviving merge primary Id using child-relationship discovery.
 */
public with sharing class MergeRelationshipRepointer {
    /**
     * @description Queries each child-of-parent relationship where {@code FK = secondaryId} and updates those rows to {@code FK = primaryId}.
     */
    public static void reparentInboundLookups(String mergeObjectApiName, Id secondaryId, Id primaryId) {
        if (String.isBlank(mergeObjectApiName) || secondaryId == null || primaryId == null) {
            throw new IllegalArgumentException('Merge relationship reparent requires object type and both record Ids.');
        }
        if (secondaryId == primaryId) {
            throw new IllegalArgumentException('Primary and secondary Ids cannot be the same.');
        }

        Schema.SObjectType mergeType = resolveMergeType(mergeObjectApiName.trim());
        if (mergeType == null) {
            throw new IllegalArgumentException('Unknown merge object type: ' + mergeObjectApiName);
        }

        Schema.DescribeSObjectResult mergeDescribe = mergeType.getDescribe();
        Set<String> seenChildFieldPairs = new Set<String>();

        for (Schema.ChildRelationship cr : mergeDescribe.getChildRelationships()) {
            if (cr.getChildSObject() == null || cr.getField() == null) {
                continue;
            }

            Schema.DescribeFieldResult fieldDescribe = cr.getField().getDescribe();
            Schema.SObjectType childType = cr.getChildSObject();
            Schema.DescribeSObjectResult childDescribe = childType == null ? null : childType.getDescribe();
            if (childDescribe == null) {
                continue;
            }

            if (fieldDescribe.getType() != Schema.DisplayType.REFERENCE || !fieldDescribe.isUpdateable()) {
                continue;
            }
            Boolean targetsMergeObject = false;
            for (Schema.SObjectType refTo : fieldDescribe.getReferenceTo()) {
                if (refTo == mergeType) {
                    targetsMergeObject = true;
                    break;
                }
            }
            if (!targetsMergeObject) {
                continue;
            }

            String dedupe = childDescribe.getName() + '|' + fieldDescribe.getName();
            if (seenChildFieldPairs.contains(dedupe)) {
                continue;
            }
            seenChildFieldPairs.add(dedupe);

            if (!childDescribe.isQueryable() || !childDescribe.isUpdateable()) {
                continue;
            }

            String childApi = childDescribe.getName();
            String fieldApi = fieldDescribe.getName();

            reparentOneRelationship(childApi, fieldApi, secondaryId, primaryId);
        }
    }

    private static Schema.SObjectType resolveMergeType(String apiName) {
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        if (globalDescribe.containsKey(apiName)) {
            return globalDescribe.get(apiName);
        }
        return null;
    }

    private static void reparentOneRelationship(
        String childObjectApiName,
        String foreignKeyFieldApiName,
        Id secondaryId,
        Id primaryId
    ) {
        Id sid = secondaryId;
        String soql =
            'SELECT Id FROM ' +
            childObjectApiName +
            ' WHERE ' +
            foreignKeyFieldApiName +
            ' = :sid WITH SECURITY_ENFORCED';
        List<SObject> rows;
        try {
            rows = Database.query(soql);
        } catch (Exception qe) {
            throw new IllegalArgumentException(
                'Could not query related ' +
                    childObjectApiName +
                    ' for relationship reparent: ' +
                    qe.getMessage()
            );
        }

        if (rows.isEmpty()) {
            return;
        }

        List<SObject> toUpdate = new List<SObject>();
        for (SObject row : rows) {
            SObject upd = row.getSObjectType().newSObject(row.Id);
            upd.put(foreignKeyFieldApiName, primaryId);
            toUpdate.add(upd);
        }

        for (Integer offset = 0; offset < toUpdate.size(); offset += 200) {
            Integer chunkEnd = Math.min(offset + 200, toUpdate.size());
            List<SObject> chunk = new List<SObject>();
            for (Integer i = offset; i < chunkEnd; i++) {
                chunk.add(toUpdate[i]);
            }

            SObjectAccessDecision stripDecision = Security.stripInaccessible(AccessType.UPDATABLE, chunk);
            List<SObject> safeChunk = stripDecision.getRecords();
            if (safeChunk.isEmpty()) {
                throw new IllegalArgumentException(
                    'Could not update related ' +
                        childObjectApiName +
                        ' rows after applying field security.'
                );
            }
            Database.SaveResult[] saveResults = Database.update(safeChunk, false, AccessLevel.USER_MODE);
            for (Integer r = 0; r < saveResults.size(); r++) {
                Database.SaveResult sr = saveResults[r];
                if (!sr.isSuccess()) {
                    Database.Error err = sr.getErrors()[0];
                    throw new IllegalArgumentException(
                        'Failed to reparent ' +
                            childObjectApiName +
                            ' lookups (row ' +
                            safeChunk[r].Id +
                            '): ' +
                            err.getMessage()
                    );
                }
            }
        }
    }

    @TestVisible
    private static void invokeReparentOneRelationship(
        String childObjectApiName,
        String foreignKeyFieldApiName,
        Id secondaryId,
        Id primaryId
    ) {
        reparentOneRelationship(childObjectApiName, foreignKeyFieldApiName, secondaryId, primaryId);
    }
}