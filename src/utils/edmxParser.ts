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

export interface ReferentialConstraint {
  sourceProperty: string;
  targetProperty: string;
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

  /**
   * Get navigation property to EntitySet mappings for a given EntitySet
   * Returns a Map of navigation property names to target EntitySet names
   * 
   * For OData V4: Uses NavigationPropertyBinding elements
   * For OData V2: Uses Association and AssociationSet definitions
   */
  getNavigationTargets(entitySetName: string): Map<string, string> {
    const targets = new Map<string, string>();
    
    if (!this.parsed) return targets;
    
    // Find the entity set
    const entitySet = this.parsed.schema.entitySets.find(
      es => es.name === entitySetName
    );
    
    if (!entitySet) return targets;
    
    // Check if this is V4 (navigationPropertyBinding is a record/object)
    if (entitySet.navigationPropertyBinding && typeof entitySet.navigationPropertyBinding === 'object') {
      // V4: navigationPropertyBinding is a Record<string, string>
      // Path -> Target EntitySet name
      for (const [path, target] of Object.entries(entitySet.navigationPropertyBinding)) {
        // Path might be just "Items" or could be complex like "Items/SubItems"
        // For now, we only handle simple paths (single segment)
        if (!path.includes('/')) {
          // Target may contain EntityContainer prefix like "EntityContainer/Customers"
          let targetEntitySetName = target;
          
          // Remove EntityContainer/ prefix if present
          if (targetEntitySetName.includes('/')) {
            targetEntitySetName = targetEntitySetName.split('/').pop()!;
          }
          
          // Remove namespace prefix if present
          if (targetEntitySetName.includes('.')) {
            targetEntitySetName = targetEntitySetName.split('.').pop()!;
          }
          
          targets.set(path, targetEntitySetName);
        }
      }
    }
    
    // V2: Use AssociationSets and Associations
    // Get entity type to find navigation properties
    const entityTypeName = entitySet.entityTypeName.includes('.')
      ? entitySet.entityTypeName.split('.').pop()!
      : entitySet.entityTypeName;
    
    const entityType = this.parsed.schema.entityTypes.find(
      et => et.name === entityTypeName
    );
    
    if (!entityType || !entityType.navigationProperties) return targets;
    
    // Process navigation properties for V2
    for (const navProp of entityType.navigationProperties) {
      // Check if this is V2 navigation property (has relationship property)
      if ('relationship' in navProp && navProp.relationship) {
        // Find the association - try multiple name formats
        const relationshipName = navProp.relationship;
        
        // DEBUG: Log what we're looking for
        console.log(`[EdmxParser] Looking for association: ${relationshipName}`);
        console.log(`[EdmxParser] Available associations:`, this.parsed.schema.associations.map(a => ({ name: a.name, fqn: a.fullyQualifiedName })));
        
        const association = this.parsed.schema.associations.find(
          a => a.fullyQualifiedName === relationshipName || 
               a.name === relationshipName ||
               // Try without namespace prefix
               (relationshipName.includes('.') && a.name === relationshipName.split('.').pop())
        );
        
        if (!association) {
          console.warn(`[EdmxParser] ⚠️ Could not find association for relationship: ${relationshipName}`);
          continue;
        }
        
        console.log(`[EdmxParser] ✓ Found association: ${association.name}`);
        
        // Find the association set that references this association
        console.log(`[EdmxParser] Looking for association set for: ${association.name} (fqn: ${association.fullyQualifiedName})`);
        console.log(`[EdmxParser] Available association sets:`, this.parsed.schema.associationSets.map(as => ({ association: as.association, ends: as.associationEnd })));
        
        const associationSet = this.parsed.schema.associationSets.find(
          as => as.association === association.fullyQualifiedName || 
               as.association === association.name ||
               // Try with namespace prefix
               (association.fullyQualifiedName && this.parsed && as.association === `${this.parsed.schema.namespace}.${association.name}`)
        );
        
        if (!associationSet) {
          console.warn(`[EdmxParser] ⚠️ Could not find association set for association: ${association.name}`);
          continue;
        }
        
        console.log(`[EdmxParser] ✓ Found association set, looking for ToRole: ${navProp.toRole}`);
        
        // Find the target EntitySet using the ToRole
        const toRole = navProp.toRole;
        const targetEnd = associationSet.associationEnd.find(
          end => end.role === toRole
        );
        
        if (targetEnd) {
          // Extract EntitySet name from the target
          // May contain EntityContainer prefix like "EntityContainer/Customers"
          let targetEntitySetName = targetEnd.entitySet;
          
          // Remove EntityContainer/ prefix if present
          if (targetEntitySetName.includes('/')) {
            targetEntitySetName = targetEntitySetName.split('/').pop()!;
          }
          
          // Remove namespace prefix if present
          if (targetEntitySetName.includes('.')) {
            targetEntitySetName = targetEntitySetName.split('.').pop()!;
          }
          
          targets.set(navProp.name, targetEntitySetName);
        }
      }
    }
    
    return targets;
  }

  /**
   * Get referential constraints for a navigation property
   * Returns the source->target property mappings that define foreign key relationships
   * 
   * For OData V4: Reads from NavigationProperty.referentialConstraint
   * For OData V2: Reads from Association.referentialConstraints (Principal/Dependent)
   */
  getReferentialConstraints(entitySetName: string, navPropName: string): ReferentialConstraint[] {
    if (!this.parsed) return [];
    
    // Find the entity set
    const entitySet = this.parsed.schema.entitySets.find(
      es => es.name === entitySetName
    );
    if (!entitySet) return [];
    
    // Get entity type
    const entityTypeName = entitySet.entityTypeName.includes('.')
      ? entitySet.entityTypeName.split('.').pop()!
      : entitySet.entityTypeName;
    
    const entityType = this.parsed.schema.entityTypes.find(
      et => et.name === entityTypeName
    );
    if (!entityType || !entityType.navigationProperties) return [];
    
    // Find the navigation property
    const navProp = entityType.navigationProperties.find(
      np => np.name === navPropName
    );
    if (!navProp) return [];
    
    // V4: Check for referentialConstraint array directly on navigation property
    if ('referentialConstraint' in navProp && navProp.referentialConstraint) {
      const constraints = navProp.referentialConstraint as any[];
      if (constraints && constraints.length > 0) {
        return constraints.map(rc => ({
          sourceProperty: rc.sourceProperty || rc.property,
          targetProperty: rc.targetProperty || rc.referencedProperty
        }));
      }
    }
    
    // V4: If no direct constraints, check partner navigation
    // For collection navigations like Orders.Items, the constraint is on the partner (Items.up_)
    if ('partner' in navProp && navProp.partner) {
      const targetTypeName = (navProp as any).targetTypeName;
      if (targetTypeName) {
        const cleanTargetType = targetTypeName.replace('Collection(', '').replace(')', '');
        const targetType = cleanTargetType.includes('.')
          ? cleanTargetType.split('.').pop()!
          : cleanTargetType;
        
        const targetEntityType = this.parsed.schema.entityTypes.find(
          et => et.name === targetType || et.fullyQualifiedName === cleanTargetType
        );
        
        if (targetEntityType && targetEntityType.navigationProperties) {
          const partnerNav = targetEntityType.navigationProperties.find(
            np => np.name === navProp.partner
          );
          
          if (partnerNav && 'referentialConstraint' in partnerNav && partnerNav.referentialConstraint) {
            const partnerConstraints = partnerNav.referentialConstraint as any[];
            if (partnerConstraints && partnerConstraints.length > 0) {
              // Reverse the constraint: partner's constraint is child->parent, we need parent->child
              return partnerConstraints.map(rc => ({
                sourceProperty: rc.targetProperty || rc.referencedProperty, // reversed
                targetProperty: rc.sourceProperty || rc.property // reversed
              }));
            }
          }
        }
      }
    }
    
    // V2: Navigate through relationship -> association -> referentialConstraints
    if ('relationship' in navProp && navProp.relationship) {
      const association = this.parsed.schema.associations.find(
        a => a.fullyQualifiedName === navProp.relationship || a.name === navProp.relationship
      );
      
      if (association && association.referentialConstraints) {
        // V2 has Principal/Dependent structure
        // We need to map based on the navigation direction (FromRole -> ToRole)
        const constraints: ReferentialConstraint[] = [];
        
        for (const rc of association.referentialConstraints) {
          // Determine if we're going from principal to dependent or vice versa
          // The navigation's FromRole tells us which end we're starting from
          const fromRole = navProp.fromRole;
          const toRole = navProp.toRole;
          
          // Check which role is the Principal
          const principalEnd = association.associationEnd.find(
            end => end.role === (rc as any).sourceTypeName || 
                   (rc.sourceProperty && end.type === rc.sourceTypeName)
          );
          
          // If navigating from Principal to Dependent (most common)
          // sourceProperty is on the current entity (principal)
          // targetProperty is on the child entity (dependent)
          constraints.push({
            sourceProperty: rc.sourceProperty,
            targetProperty: rc.targetProperty
          });
        }
        
        return constraints;
      }
    }
    
    return [];
  }

  /**
   * Check if a navigation property has referential constraints defined
   * This indicates whether the recorder can safely extract entities to separate files
   * 
   * Returns false if:
   * - Navigation property not found
   * - No referential constraints defined (either direct or on partner)
   * - containsTarget is true (V4 containment - should keep inline)
   */
  hasReferentialConstraints(entitySetName: string, navPropName: string): boolean {
    if (!this.parsed) return false;
    
    // Find the entity set
    const entitySet = this.parsed.schema.entitySets.find(
      es => es.name === entitySetName
    );
    if (!entitySet) return false;
    
    // Get entity type
    const entityTypeName = entitySet.entityTypeName.includes('.')
      ? entitySet.entityTypeName.split('.').pop()!
      : entitySet.entityTypeName;
    
    const entityType = this.parsed.schema.entityTypes.find(
      et => et.name === entityTypeName
    );
    if (!entityType || !entityType.navigationProperties) return false;
    
    // Find the navigation property
    const navProp = entityType.navigationProperties.find(
      np => np.name === navPropName
    );
    if (!navProp) return false;
    
    // V4: Check for containsTarget - if true, should NOT extract
    if ('containsTarget' in navProp && navProp.containsTarget === true) {
      return false;
    }
    
    // Try to get constraints directly
    const constraints = this.getReferentialConstraints(entitySetName, navPropName);
    if (constraints.length > 0) {
      return true;
    }
    
    // V4: If no direct constraints, check partner navigation
    // For collection navigations like Orders.Items, the constraint is on the partner (Items.up_)
    if ('partner' in navProp && navProp.partner) {
      // Get the target entity type
      const targetTypeName = (navProp as any).targetTypeName;
      if (targetTypeName) {
        // Extract just the type name
        const cleanTargetType = targetTypeName.replace('Collection(', '').replace(')', '');
        const targetType = cleanTargetType.includes('.')
          ? cleanTargetType.split('.').pop()!
          : cleanTargetType;
        
        // Find the target entity type
        const targetEntityType = this.parsed.schema.entityTypes.find(
          et => et.name === targetType || et.fullyQualifiedName === cleanTargetType
        );
        
        if (targetEntityType && targetEntityType.navigationProperties) {
          // Find the partner navigation
          const partnerNav = targetEntityType.navigationProperties.find(
            np => np.name === navProp.partner
          );
          
          if (partnerNav && 'referentialConstraint' in partnerNav && partnerNav.referentialConstraint) {
            const partnerConstraints = partnerNav.referentialConstraint as any[];
            return partnerConstraints && partnerConstraints.length > 0;
          }
        }
      }
    }
    
    return false;
  }
}
