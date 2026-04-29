/**
 * Validates inbound lookup reparenting for Merge, Reparent and Delete merge actions.
 */
@IsTest
private class MergeRelationshipRepointer_Test {
    @IsTest
    static void rejectsMissingArgumentsSameIdAndUnknownObject() {
        Account a = new Account(Name = 'A');
        insert a;

        try {
            MergeRelationshipRepointer.reparentInboundLookups('', a.Id, a.Id);
            System.assert(false, 'Expected exception for blank object type');
        } catch (Exception ex) {
            assertMessageContainsOneOf(
                ex,
                new List<String>{ 'Merge relationship reparent', 'object type', 'record Ids' }
            );
        }

        try {
            MergeRelationshipRepointer.reparentInboundLookups('Account', null, a.Id);
            System.assert(false, 'Expected exception for null secondary Id');
        } catch (Exception ex) {
            assertMessageContainsOneOf(
                ex,
                new List<String>{ 'Merge relationship reparent', 'object type', 'record Ids' }
            );
        }

        try {
            MergeRelationshipRepointer.reparentInboundLookups('Account', a.Id, a.Id);
            System.assert(false, 'Expected exception for same primary and secondary');
        } catch (Exception ex) {
            assertMessageContainsOneOf(ex, new List<String>{ 'cannot be the same' });
        }

        Account other = new Account(Name = 'Other');
        insert other;

        try {
            MergeRelationshipRepointer.reparentInboundLookups(
                'NotARealMergeType__XYZ123ZZZ__c',
                a.Id,
                other.Id
            );
            System.assert(false, 'Expected exception for unknown object type');
        } catch (Exception ex) {
            assertMessageContainsOneOf(ex, new List<String>{ 'Unknown merge object' });
        }
    }

    @IsTest
    static void noRowsToReparentCompletesQuietly() {
        Account primaryAcc = new Account(Name = 'No Kids Pri');
        Account secondaryAcc = new Account(Name = 'No Kids Sec');
        insert new List<Account>{ primaryAcc, secondaryAcc };

        Test.startTest();
        MergeRelationshipRepointer.reparentInboundLookups('Account', secondaryAcc.Id, primaryAcc.Id);
        Test.stopTest();
    }

    @IsTest
    static void contactAccountLookupMovesToPrimary() {
        Account primaryAcc = new Account(Name = 'Primary Merge Reparent');
        Account secondaryAcc = new Account(Name = 'Secondary Merge Reparent');
        insert new List<Account>{ primaryAcc, secondaryAcc };

        Contact dependent = new Contact(LastName = 'Child Lookup', AccountId = secondaryAcc.Id);
        insert dependent;

        Test.startTest();
        MergeRelationshipRepointer.reparentInboundLookups(
            'Account',
            secondaryAcc.Id,
            primaryAcc.Id
        );
        Test.stopTest();

        Contact after = [
            SELECT AccountId
            FROM Contact
            WHERE Id = :dependent.Id
            WITH SECURITY_ENFORCED
        ];
        System.assertEquals(
            primaryAcc.Id,
            after.AccountId,
            'Inbound Account lookup should point at the surviving primary record.'
        );
    }

    @IsTest
    static void chunkedUpdateWhenRelatedRowsExceedTwoHundred() {
        Account primaryAcc = new Account(Name = 'Chunk Pri');
        Account secondaryAcc = new Account(Name = 'Chunk Sec');
        insert new List<Account>{ primaryAcc, secondaryAcc };

        List<Contact> kids = new List<Contact>();
        for (Integer i = 0; i < 201; i++) {
            kids.add(new Contact(LastName = 'C' + i, AccountId = secondaryAcc.Id));
        }
        insert kids;

        Test.startTest();
        MergeRelationshipRepointer.reparentInboundLookups('Account', secondaryAcc.Id, primaryAcc.Id);
        Test.stopTest();

        AggregateResult ar = [
            SELECT COUNT(Id) rowCount
            FROM Contact
            WHERE AccountId = :primaryAcc.Id AND Id IN :kids
            WITH SECURITY_ENFORCED
        ];
        System.assertEquals(
            201,
            (Decimal) ar.get('rowCount'),
            'All related contacts should batch-reparent onto the primary in multiple update chunks.'
        );
    }

    @IsTest
    static void invalidChildRelationshipQueryMapsToFriendlyError() {
        Account primaryAcc = new Account(Name = 'Query Err Pri');
        Account secondaryAcc = new Account(Name = 'Query Err Sec');
        insert new List<Account>{ primaryAcc, secondaryAcc };

        Boolean threw = false;
        try {
            MergeRelationshipRepointer.invokeReparentOneRelationship(
                'bogusObjectNameXXXXXXXX',
                'AccountId',
                secondaryAcc.Id,
                primaryAcc.Id
            );
            System.assert(false, 'Expected exception for invalid dynamic SOQL');
        } catch (Exception expected) {
            threw = true;
            assertMessageContainsOneOf(
                expected,
                new List<String>{
                    'Could not query related',
                    'relationship reparent',
                    'bogusObjectNameXXXXXXXX'
                }
            );
        }
        System.assert(threw, 'Dynamic SOQL failure should be wrapped.');
    }

    /**
     * @description Message matching for wrapped exceptions whose base type differs by context.
     */
    private static void assertMessageContainsOneOf(Exception ex, List<String> substrings) {
        String msg = ex.getMessage() != null ? ex.getMessage() : '';
        for (String needle : substrings) {
            if (msg.contains(needle)) {
                return;
            }
        }
        System.assert(false, 'Message did not contain any expected fragment. Actual: "' + msg + '"');
    }
}