/**
 * Tests for URL parameter manipulation utilities
 */
import { removeSelectFromUrl, removeSelectFromBatchBody, removeSelectFromRequest } from '../../src/utils/urlUtils';

describe('URL Utils - Select Parameter Removal', () => {
  
  describe('removeSelectFromUrl', () => {
    
    it('should remove $select parameter from simple URL', () => {
      const url = '/Books?$select=ID,title,author';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books');
    });

    it('should remove $select parameter from URL with other parameters', () => {
      const url = '/Books?$filter=price gt 10&$select=ID,title&$top=10';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books?$filter=price gt 10&$top=10');
    });

    it('should handle case-insensitive $select parameter', () => {
      const url = '/Books?$Select=ID,title,author';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books');
    });

    it('should remove $select from complex OData URL', () => {
      const url = '/Books?$count=true&$select=HasActiveEntity,HasDraftEntity,ID,IsActiveEntity,author,currency_code,price,stock,title&$expand=DraftAdministrativeData($select=DraftUUID,InProcessByUser)&$filter=(IsActiveEntity%20eq%20false%20or%20SiblingEntity/IsActiveEntity%20eq%20null)&$skip=0&$top=30';
      const result = removeSelectFromUrl(url);
      // Should keep all other parameters but remove $select
      expect(result).toContain('$count=true');
      expect(result).toContain('$expand=DraftAdministrativeData');
      expect(result).toContain('$filter=');
      expect(result).toContain('$skip=0');
      expect(result).toContain('$top=30');
      expect(result).not.toContain('$select=HasActiveEntity');
    });

    it('should handle URL without query parameters', () => {
      const url = '/Books';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books');
    });

    it('should handle URL with only $select parameter', () => {
      const url = '/Books?$select=ID,title';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books');
    });

    it('should handle navigation property URLs', () => {
      const url = '/Books(ID=guid\'123\',IsActiveEntity=true)/chapters?$select=ID,title,pageNumber';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books(ID=guid\'123\',IsActiveEntity=true)/chapters');
    });

    it('should preserve URL encoding', () => {
      const url = '/Books?$filter=title%20eq%20\'test\'&$select=ID,title';
      const result = removeSelectFromUrl(url);
      expect(result).toContain('$filter=title eq \'test\'');
      expect(result).not.toContain('$select');
    });

    it('should handle malformed URLs gracefully', () => {
      const url = 'not-a-valid-url';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('not-a-valid-url'); // Returns original on error
    });

  });

  describe('removeSelectFromBatchBody', () => {
    
    it('should remove $select from GET request in batch body', () => {
      const batchBody = `--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

GET Books?$select=ID,title,author HTTP/1.1
Accept:application/json

--batch_id-123--`;

      const result = removeSelectFromBatchBody(batchBody);
      expect(result).toContain('GET Books HTTP/1.1');
      expect(result).not.toContain('$select=ID,title,author');
    });

    it('should remove $select from multiple requests in batch', () => {
      const batchBody = `--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

GET Books?$select=ID,title HTTP/1.1
Accept:application/json

--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

GET Books(ID=guid'123',IsActiveEntity=true)/chapters?$count=true&$select=ID,title,pageNumber&$skip=0&$top=10 HTTP/1.1
Accept:application/json

--batch_id-123--`;

      const result = removeSelectFromBatchBody(batchBody);
      expect(result).toContain('GET Books HTTP/1.1');
      expect(result).toContain('GET Books(ID=guid\'123\',IsActiveEntity=true)/chapters?$count=true&$skip=0&$top=10 HTTP/1.1');
      expect(result).not.toContain('$select=ID,title');
      expect(result).not.toContain('$select=ID,title,pageNumber');
    });

    it('should preserve non-GET requests', () => {
      const batchBody = `--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

POST Books HTTP/1.1
Content-Type:application/json

{"title": "New Book"}

--batch_id-123--`;

      const result = removeSelectFromBatchBody(batchBody);
      expect(result).toContain('POST Books HTTP/1.1');
      expect(result).toContain('{"title": "New Book"}');
    });

    it('should handle PUT and PATCH requests with $select in URL', () => {
      const batchBody = `--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

PUT Books(ID=guid'123')?$select=ID,title HTTP/1.1
Content-Type:application/json

{"title": "Updated Book"}

--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

PATCH Books(ID=guid'456')?$select=author&$if-match=* HTTP/1.1
Content-Type:application/json

{"author": "New Author"}

--batch_id-123--`;

      const result = removeSelectFromBatchBody(batchBody);
      expect(result).toContain('PUT Books(ID=guid\'123\') HTTP/1.1');
      expect(result).toContain('PATCH Books(ID=guid\'456\')?$if-match=* HTTP/1.1');
      expect(result).not.toContain('$select=ID,title');
      expect(result).not.toContain('$select=author');
    });

    it('should handle empty or malformed batch body gracefully', () => {
      const batchBody = 'malformed batch content';
      const result = removeSelectFromBatchBody(batchBody);
      expect(result).toBe('malformed batch content'); // Returns original on error
    });

  });

  describe('removeSelectFromRequest', () => {
    
    it('should modify URL for non-batch requests', () => {
      const url = '/Books?$select=ID,title&$top=10';
      const body = undefined;
      const contentType = 'application/json';
      
      const result = removeSelectFromRequest(url, body, contentType);
      
      expect(result.url).toBe('/Books?$top=10');
      expect(result.body).toBeUndefined();
    });

    it('should modify both URL and body for batch requests', () => {
      const url = '/bookshop/$batch?$select=ID';
      const body = `--batch_id-123
Content-Type:application/http
Content-Transfer-Encoding:binary

GET Books?$select=ID,title HTTP/1.1
Accept:application/json

--batch_id-123--`;
      const contentType = 'multipart/mixed; boundary=batch_id-123';
      
      const result = removeSelectFromRequest(url, body, contentType);
      
      expect(result.url).toBe('/bookshop/$batch');
      expect(result.body).toContain('GET Books HTTP/1.1');
      expect(result.body).not.toContain('$select=ID,title');
    });

    it('should handle non-batch requests with JSON content type', () => {
      const url = '/Books?$select=ID,title';
      const body = '{"title": "Test Book"}';
      const contentType = 'application/json';
      
      const result = removeSelectFromRequest(url, body, contentType);
      
      expect(result.url).toBe('/Books');
      expect(result.body).toBe('{"title": "Test Book"}'); // Body unchanged for non-batch
    });

    it('should detect batch requests by content type containing multipart/mixed', () => {
      const url = '/api/$batch';
      const body = 'batch content';
      const contentType = 'multipart/mixed; boundary=test';
      
      const result = removeSelectFromRequest(url, body, contentType);
      
      expect(result.body).toBe('batch content'); // Body processed for batch
    });

  });

  describe('Edge Cases', () => {
    
    it('should handle URLs with fragment identifiers', () => {
      const url = '/Books?$select=ID,title#section1';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('/Books#section1');
    });

    it('should handle URLs with port numbers', () => {
      const url = 'http://localhost:8080/Books?$select=ID,title';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('Books');
    });

    it('should handle relative URLs correctly', () => {
      const url = 'Books?$select=ID,title&$top=5';
      const result = removeSelectFromUrl(url);
      expect(result).toBe('Books?$top=5');
    });

    it('should handle $expand with nested $select', () => {
      const url = '/Books?$expand=chapters($select=title,pageNumber)&$select=ID,title';
      const result = removeSelectFromUrl(url);
      // Should only remove top-level $select, not nested ones in $expand
      expect(result).toContain('$expand=chapters($select=title,pageNumber)');
      expect(result).not.toContain('&$select=ID,title');
    });

  });

});
