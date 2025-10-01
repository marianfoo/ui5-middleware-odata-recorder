import { ODataParser } from '../../src/utils/odataParser';

describe('ODataParser', () => {
  describe('V4 Response Normalization', () => {
    it('should normalize V4 collection response', () => {
      const response = {
        '@odata.context': '$metadata#Orders',
        value: [
          { ID: '1', Name: 'Order 1' },
          { ID: '2', Name: 'Order 2' }
        ]
      };

      const entities = ODataParser.normalizeResponse(response, 'v4');
      
      expect(entities).toHaveLength(2);
      expect(entities[0].ID).toBe('1');
      expect(entities[1].ID).toBe('2');
    });

    it('should normalize V4 single entity', () => {
      const response = {
        '@odata.context': '$metadata#Orders/$entity',
        ID: '1',
        Name: 'Order 1'
      };

      const entities = ODataParser.normalizeResponse(response, 'v4');
      
      expect(entities).toHaveLength(1);
      expect(entities[0].ID).toBe('1');
    });

    it('should treat object without value as single entity', () => {
      const response = {
        '@odata.context': '$metadata#Orders',
        ID: '1',
        Name: 'Test'
      };

      const entities = ODataParser.normalizeResponse(response, 'v4');
      
      expect(entities).toHaveLength(1);
      expect(entities[0].ID).toBe('1');
    });
  });

  describe('V2 Response Normalization', () => {
    it('should normalize V2 collection response', () => {
      const response = {
        d: {
          results: [
            { ID: '1', Name: 'Order 1' },
            { ID: '2', Name: 'Order 2' }
          ]
        }
      };

      const entities = ODataParser.normalizeResponse(response, 'v2');
      
      expect(entities).toHaveLength(2);
      expect(entities[0].ID).toBe('1');
      expect(entities[1].ID).toBe('2');
    });

    it('should normalize V2 single entity', () => {
      const response = {
        d: {
          ID: '1',
          Name: 'Order 1'
        }
      };

      const entities = ODataParser.normalizeResponse(response, 'v2');
      
      expect(entities).toHaveLength(1);
      expect(entities[0].ID).toBe('1');
    });

    it('should return empty array for invalid V2 response', () => {
      const response = {
        error: { message: 'Not Found' }
      };

      const entities = ODataParser.normalizeResponse(response, 'v2');
      
      expect(entities).toEqual([]);
    });
  });

  describe('Entity Set Extraction', () => {
    it('should extract entity set from V4 URL', () => {
      const url = '/odata/v4/orders/Orders?$expand=customer';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBe('Orders');
    });

    it('should extract entity set from V2 URL', () => {
      const url = '/odata/v2/orders/Orders?$expand=customer';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v2/orders/');
      
      expect(entitySet).toBe('Orders');
    });

    it('should extract entity set from URL with key predicate', () => {
      const url = '/odata/v4/orders/Orders(guid\'123\')';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBe('Orders');
    });

    it('should extract entity set from navigation path', () => {
      const url = '/odata/v4/orders/Orders(ID=guid\'123\')/Items';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBe('Orders');
    });

    it('should return null for invalid URL', () => {
      const url = '/odata/v4/orders/';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBeNull();
    });

    it('should handle URL without basePath prefix', () => {
      const url = 'Orders?$top=10';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBe('Orders');
    });
  });

  describe('JSON Batch Parsing (V4)', () => {
    it('should parse V4 JSON batch response', () => {
      const body = JSON.stringify({
        responses: [
          {
            id: '0',
            status: 200,
            body: { value: [{ ID: '1', Name: 'Order 1' }] }
          },
          {
            id: '1',
            status: 200,
            body: { value: [{ ID: '1', Name: 'Customer 1' }] }
          }
        ]
      });

      const items = ODataParser.parseBatchResponse(body, 'application/json', 'v4');
      
      expect(items).toHaveLength(2);
      expect(items[0].statusCode).toBe(200);
      expect(items[1].statusCode).toBe(200);
    });

    it('should handle empty JSON batch', () => {
      const body = JSON.stringify({ responses: [] });
      const items = ODataParser.parseBatchResponse(body, 'application/json', 'v4');
      
      expect(items).toEqual([]);
    });
  });

  describe('Batch Fallback', () => {
    it('should fallback to JSON batch when content-type is unknown', () => {
      const body = JSON.stringify({
        responses: [
          {
            id: '0',
            status: 200,
            body: { value: [{ ID: '1' }] }
          }
        ]
      });

      const items = ODataParser.parseBatchResponse(body, 'unknown/content-type', 'v4');
      
      expect(items).toHaveLength(1);
      expect(items[0].statusCode).toBe(200);
    });

    it('should return empty array when fallback fails', () => {
      const body = 'Not JSON and not multipart';
      const items = ODataParser.parseBatchResponse(body, 'text/plain', 'v4');
      
      expect(items).toEqual([]);
    });
  });

  describe('Multipart Batch Parsing (V2)', () => {
    it('should parse multipart/mixed batch with __metadata.uri', () => {
      const boundary = 'batch_123';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"d":{"results":[{"ID":"1","__metadata":{"uri":"http://localhost/v2/orders/Orders(guid'1')"}}]}}
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe('Orders');
      expect(items[0].statusCode).toBe(200);
    });

    it('should extract entity set from V2 __metadata.uri', () => {
      const boundary = 'batch_456';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"d":{"__metadata":{"uri":"/v2/orders/Customers(guid'123')"},"ID":"123","name":"Test"}}
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe('Customers');
    });

    it('should handle batch without metadata', () => {
      const boundary = 'batch_789';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"d":{"results":[{"ID":"1"}]}}
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe(''); // No URL extracted
    });

    it('should return empty array when no boundary in content-type', () => {
      const body = 'Some multipart content';
      const items = ODataParser.parseBatchResponse(body, 'multipart/mixed', 'v2');
      
      expect(items).toEqual([]);
    });

    it('should skip parts without HTTP status', () => {
      const boundary = 'batch_abc';
      const body = `--${boundary}
Content-Type: application/http

This is not a valid HTTP response

--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toEqual([]);
    });

    it('should skip parts without JSON body', () => {
      const boundary = 'batch_def';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: text/plain

This is plain text, not JSON
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toEqual([]);
    });

    it('should handle JSON parse errors in batch parts', () => {
      const boundary = 'batch_ghi';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{invalid json}
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v2');
      
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe(''); // Fallback when JSON parse fails
    });

    it('should extract entity set from V4 @odata.context', () => {
      const boundary = 'batch_v4';
      const body = `--${boundary}
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"@odata.context":"$metadata#Orders","value":[{"ID":"1"}]}
--${boundary}--`;

      const items = ODataParser.parseBatchResponse(body, `multipart/mixed; boundary=${boundary}`, 'v4');
      
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe('Orders');
    });
  });

  describe('Entity Set Extraction Edge Cases', () => {
    it('should handle URL with leading slash', () => {
      const url = '/Orders?$top=10';
      const entitySet = ODataParser.extractEntitySet(url, '/odata/v4/orders/');
      
      expect(entitySet).toBe('Orders');
    });
  });
});

