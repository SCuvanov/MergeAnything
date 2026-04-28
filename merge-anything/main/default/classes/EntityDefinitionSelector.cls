public class EntityDefinitionSelector {
    private static EntityDefinitionSelector instance = new EntityDefinitionSelector();

    @SuppressWarnings('PMD.EmptyStatementBlock')
    @TestVisible
    private EntityDefinitionSelector() {
    }

    /**
     * @description The instance `EntityDefinitionSelector` used for any querying entity definitions
     * @return   The singleton instance of `EntityDefinitionSelector`
     */
    public static EntityDefinitionSelector getInstance() {
        return instance;
    }

    /**
     * @description Returns entity definitions whose labels match the search, limited to sObjects the running user
     *              can query, read, update, and delete (required for merge operations).
     */
    public List<EntityDefinition> getEntityDefinitionsByLabel(String label) {
        if (String.isBlank(label)) {
            return new List<EntityDefinition>();
        }

        String searchValue = '%' + label + '%';

        List<EntityDefinition> rows = [
            SELECT MasterLabel, QualifiedApiName, NamespacePrefix
            FROM EntityDefinition
            WHERE MasterLabel LIKE :searchValue
            ORDER BY QualifiedApiName
        ];
        return filterMergeableByUserCrud(rows);
    }

    /**
     * @description Returns all entity definitions limited to sObjects the running user can query, read, update, and
     *              delete (required for merge operations).
     */
    public List<EntityDefinition> getAllEntityDefinitions() {
        List<EntityDefinition> rows = [
            SELECT MasterLabel, QualifiedApiName, NamespacePrefix
            FROM EntityDefinition
            ORDER BY QualifiedApiName
        ];
        return filterMergeableByUserCrud(rows);
    }

    /**
     * @description Keeps {@link EntityDefinition} rows whose API name resolves to an sObject the current user can
     *              query ({@code isQueryable}), read ({@code isAccessible}), update ({@code isUpdateable}), and
     *              delete ({@code isDeletable}).
     */
    private List<EntityDefinition> filterMergeableByUserCrud(List<EntityDefinition> rows) {
        if (rows == null || rows.isEmpty()) {
            return rows == null ? new List<EntityDefinition>() : rows;
        }

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        List<EntityDefinition> filtered = new List<EntityDefinition>();

        for (EntityDefinition row : rows) {
            if (row == null || String.isBlank(row.QualifiedApiName)) {
                continue;
            }

            Schema.SObjectType sobType = globalDescribe.get(row.QualifiedApiName.toLowerCase());
            if (sobType == null) {
                continue;
            }

            Schema.DescribeSObjectResult dsr = sobType.getDescribe();
            if (
                dsr.isDeprecatedAndHidden() || !dsr.isAccessible() || !dsr.isQueryable() ||
                !dsr.isUpdateable() || !dsr.isDeletable()
            ) {
                continue;
            }

            filtered.add(row);
        }
        return filtered;
    }
}