/**
 * EDMX parser to extract EntitySet → EntityType mappings and key fields
 * Uses SAP UX edmx-parser for robust parsing across all OData metadata formats
 */
import { parse } from '@sap-ux/edmx-parser';
import type { RawMetadata } from '@sap-ux/vocabularies-types';

export interface EntityTypeInfo {
  name: string;
  keys: string[];
}

export interface EntitySetMapping {
  entitySet: string;
  entityType: string;
}

export class EdmxParser {
  private parsed: RawMetadata | null = null;

  /**
   * Parse EDMX metadata XML using SAP UX parser
   */
  async parse(metadataXml: string): Promise<void> {
    try {
      this.parsed = parse(metadataXml);
    } catch (error) {
      throw new Error(`Failed to parse EDMX metadata: ${error}`);
    }
  }

  /**
   * Get key fields for an EntitySet
   */
  getKeysForEntitySet(entitySetName: string): string[] {
    if (!this.parsed) return [];
    
    // Find entity set
    const entitySet = this.parsed.schema.entitySets.find(
      es => es.name === entitySetName
    );
    if (!entitySet) return [];
    
    // Get entity type name (handle fully qualified names like "Namespace.TypeName")
    const entityTypeName = entitySet.entityTypeName.includes('.')
      ? entitySet.entityTypeName.split('.').pop()!
      : entitySet.entityTypeName;
    
    // Find entity type and extract key names
    const entityType = this.parsed.schema.entityTypes.find(
      et => et.name === entityTypeName
    );
    
    return entityType?.keys.map(k => k.name) || [];
  }

  /**
   * Get EntityType name for an EntitySet
   */
  getEntityType(entitySetName: string): string | undefined {
    if (!this.parsed) return undefined;
    
    const entitySet = this.parsed.schema.entitySets.find(
      es => es.name === entitySetName
    );
    
    if (!entitySet) return undefined;
    
    // Return just the type name without namespace
    return entitySet.entityTypeName.includes('.')
      ? entitySet.entityTypeName.split('.').pop()!
      : entitySet.entityTypeName;
  }
}
