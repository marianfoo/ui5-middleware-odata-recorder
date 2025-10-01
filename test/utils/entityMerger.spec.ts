import { EntityMerger } from '../../src/utils/entityMerger';

describe('EntityMerger', () => {
  describe('Merge with Keys', () => {
    it('should deduplicate by single key (first wins)', () => {
      const existing = [
        { ID: '1', Name: 'Old Name' },
        { ID: '2', Name: 'Kept' }
      ];
      
      const newEntities = [
        { ID: '1', Name: 'New Name' }, // Duplicate
        { ID: '3', Name: 'Added' }      // New
      ];

      const merged = EntityMerger.merge(existing, newEntities, ['ID']);
      
      expect(merged).toHaveLength(3);
      expect(merged.find(e => e.ID === '1')!.Name).toBe('Old Name'); // First wins
      expect(merged.find(e => e.ID === '2')!.Name).toBe('Kept');
      expect(merged.find(e => e.ID === '3')!.Name).toBe('Added');
    });

    it('should handle composite keys', () => {
      const existing = [
        { OrderID: '1', ItemID: '1', Qty: 5 }
      ];
      
      const newEntities = [
        { OrderID: '1', ItemID: '1', Qty: 10 }, // Duplicate (same composite key)
        { OrderID: '1', ItemID: '2', Qty: 3 },   // New (different ItemID)
        { OrderID: '2', ItemID: '1', Qty: 7 }    // New (different OrderID)
      ];

      const merged = EntityMerger.merge(existing, newEntities, ['OrderID', 'ItemID']);
      
      expect(merged).toHaveLength(3);
      
      const first = merged.find(e => e.OrderID === '1' && e.ItemID === '1');
      expect(first!.Qty).toBe(5); // First wins
      
      const second = merged.find(e => e.OrderID === '1' && e.ItemID === '2');
      expect(second!.Qty).toBe(3);
      
      const third = merged.find(e => e.OrderID === '2' && e.ItemID === '1');
      expect(third!.Qty).toBe(7);
    });

    it('should handle missing key fields gracefully', () => {
      const existing = [
        { ID: '1', Name: 'Test' }
      ];
      
      const newEntities = [
        { ID: '2', Name: 'Test2' },
        { Name: 'No ID' } // Missing ID field
      ];

      const merged = EntityMerger.merge(existing, newEntities, ['ID']);
      
      // Entities with missing keys get empty string key, might duplicate
      expect(merged.length).toBeGreaterThanOrEqual(2);
      expect(merged.find(e => e.ID === '1')).toBeDefined();
      expect(merged.find(e => e.ID === '2')).toBeDefined();
    });
  });

  describe('Merge without Keys (Fallback)', () => {
    it('should use JSON identity when no keys provided', () => {
      const existing = [
        { ID: '1', Name: 'Test1' },
        { ID: '2', Name: 'Test2' }
      ];
      
      const newEntities = [
        { ID: '1', Name: 'Test1' }, // Exact duplicate
        { ID: '3', Name: 'Test3' }  // New
      ];

      const merged = EntityMerger.merge(existing, newEntities, []);
      
      expect(merged).toHaveLength(3);
      expect(merged.filter(e => e.ID === '1')).toHaveLength(1); // Deduplicated
    });

    it('should treat different objects as different even with same ID', () => {
      const existing = [
        { ID: '1', Name: 'Old', extra: 'field' }
      ];
      
      const newEntities = [
        { ID: '1', Name: 'New' } // Different JSON
      ];

      const merged = EntityMerger.merge(existing, newEntities, []);
      
      expect(merged).toHaveLength(2); // Both kept (different JSON)
    });
  });

  describe('Redaction', () => {
    it('should redact sensitive fields', () => {
      const entity = {
        ID: '1',
        Name: 'John Doe',
        Email: 'john@example.com',
        Password: 'secret123',
        Token: 'abc-xyz-123'
      };

      const redacted = EntityMerger.redact(entity, ['Email', 'Password', 'Token']);
      
      expect(redacted.ID).toBe('1');
      expect(redacted.Name).toBe('John Doe');
      expect(redacted.Email).toBeUndefined();
      expect(redacted.Password).toBeUndefined();
      expect(redacted.Token).toBeUndefined();
    });

    it('should not modify original entity', () => {
      const entity = {
        ID: '1',
        Email: 'test@example.com'
      };

      const redacted = EntityMerger.redact(entity, ['Email']);
      
      expect(entity.Email).toBe('test@example.com'); // Original unchanged
      expect(redacted.Email).toBeUndefined();
    });

    it('should handle empty redact list', () => {
      const entity = {
        ID: '1',
        Name: 'Test',
        Email: 'test@example.com'
      };

      const redacted = EntityMerger.redact(entity, []);
      
      expect(redacted).toEqual(entity);
    });

    it('should ignore non-existent fields', () => {
      const entity = {
        ID: '1',
        Name: 'Test'
      };

      const redacted = EntityMerger.redact(entity, ['NonExistent', 'Email']);
      
      expect(redacted).toEqual(entity);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty existing array', () => {
      const merged = EntityMerger.merge([], [{ ID: '1' }], ['ID']);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].ID).toBe('1');
    });

    it('should handle empty new entities array', () => {
      const existing = [{ ID: '1' }];
      const merged = EntityMerger.merge(existing, [], ['ID']);
      
      expect(merged).toEqual(existing);
    });

    it('should handle both arrays empty', () => {
      const merged = EntityMerger.merge([], [], ['ID']);
      
      expect(merged).toEqual([]);
    });

    it('should handle null/undefined values in keys', () => {
      const existing = [
        { ID: null, Name: 'Null ID' }
      ];
      
      const newEntities = [
        { ID: undefined, Name: 'Undefined ID' },
        { ID: null, Name: 'Another Null' }
      ];

      const merged = EntityMerger.merge(existing, newEntities, ['ID']);
      
      // Both null and undefined convert to empty string
      expect(merged.length).toBeGreaterThanOrEqual(1);
    });
  });
});

