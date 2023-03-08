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
     * @description Returns a list of `EntityDefinition` records by the given label
     * @return        The List of `EntityDefinition` records
     */
    public List<EntityDefinition> getEntityDefinitionsByLabel(String label) {
        if (String.isBlank(label))
            return new List<EntityDefinition>();

        String searchValue = '%' + label + '%';

        return [
            SELECT MasterLabel, QualifiedApiName, NamespacePrefix
            FROM EntityDefinition
            WHERE MasterLabel LIKE :searchValue
            ORDER BY QualifiedApiName
        ];
    }

    /**
     * @description Returns a list of all `EntityDefinition` records
     * @return        The List of `EntityDefinition` records
     */
    public List<EntityDefinition> getAllEntityDefinitions() {
        return [
            SELECT MasterLabel, QualifiedApiName, NamespacePrefix
            FROM EntityDefinition
            ORDER BY QualifiedApiName
        ];
    }
}
