import { EdmxParser } from '../../src/utils/edmxParser';
import * as fs from 'fs';
import * as path from 'path';

describe('EdmxParser', () => {
  let parser: EdmxParser;

  beforeEach(() => {
    parser = new EdmxParser();
  });

  describe('V4 metadata', () => {
    it('should extract single key from V4 metadata', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v4.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const keys = parser.getKeysForEntitySet('Orders');
      expect(keys).toEqual(['ID']);
    });

    it('should extract composite keys from V4 metadata', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v4.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const keys = parser.getKeysForEntitySet('OrderItems');
      expect(keys).toContain('OrderID');
      expect(keys).toContain('ItemID');
      expect(keys.length).toBe(2);
    });

    it('should get entity type name for entity set', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v4.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const entityType = parser.getEntityType('Orders');
      expect(entityType).toBe('Orders');
    });

    it('should return empty array for unknown entity set', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v4.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const keys = parser.getKeysForEntitySet('UnknownSet');
      expect(keys).toEqual([]);
    });
  });

  describe('V2 metadata', () => {
    it('should extract single key from V2 metadata', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v2.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const keys = parser.getKeysForEntitySet('Customers');
      expect(keys).toEqual(['ID']);
    });

    it('should extract composite keys from V2 metadata', async () => {
      const metadata = fs.readFileSync(
        path.join(__dirname, '../fixtures/metadata-v2.xml'),
        'utf-8'
      );
      
      await parser.parse(metadata);
      
      const keys = parser.getKeysForEntitySet('OrderItems');
      expect(keys).toContain('OrderID');
      expect(keys).toContain('ItemID');
      expect(keys.length).toBe(2);
    });
  });

  it('should return empty arrays before parsing', () => {
    const keys = parser.getKeysForEntitySet('Orders');
    expect(keys).toEqual([]);
    
    const entityType = parser.getEntityType('Orders');
    expect(entityType).toBeUndefined();
  });

  it('should throw error for invalid XML', async () => {
    const invalidXml = 'This is not valid XML <unclosed>';
    
    await expect(parser.parse(invalidXml)).rejects.toThrow('Failed to parse EDMX metadata');
  });
});

