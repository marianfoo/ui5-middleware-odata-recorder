/**
 * Entity merger with key-based deduplication
 */

export class EntityMerger {
  /**
   * Merge new entities into existing array, deduplicating by keys
   */
  static merge(existing: any[], newEntities: any[], keys: string[]): any[] {
    if (keys.length === 0) {
      // No keys available, fallback to JSON-based dedup
      return this.mergeByIdentity(existing, newEntities);
    }
    
    const merged = [...existing];
    const existingKeys = new Set(
      existing.map(e => this.buildKeyString(e, keys))
    );
    
    for (const entity of newEntities) {
      const keyStr = this.buildKeyString(entity, keys);
      if (!existingKeys.has(keyStr)) {
        merged.push(entity);
        existingKeys.add(keyStr);
      }
    }
    
    return merged;
  }

  /**
   * Build composite key string for an entity
   */
  private static buildKeyString(entity: any, keys: string[]): string {
    return keys.map(k => String(entity[k] ?? '')).join('|');
  }

  /**
   * Fallback: merge by JSON identity
   */
  private static mergeByIdentity(existing: any[], newEntities: any[]): any[] {
    const merged = [...existing];
    const existingSet = new Set(existing.map(e => JSON.stringify(e)));
    
    for (const entity of newEntities) {
      const jsonStr = JSON.stringify(entity);
      if (!existingSet.has(jsonStr)) {
        merged.push(entity);
        existingSet.add(jsonStr);
      }
    }
    
    return merged;
  }

  /**
   * Redact sensitive fields from entity
   */
  static redact(entity: any, redactFields: string[]): any {
    if (redactFields.length === 0) return entity;
    
    const redacted = { ...entity };
    for (const field of redactFields) {
      if (field in redacted) {
        delete redacted[field];
      }
    }
    
    return redacted;
  }
}
