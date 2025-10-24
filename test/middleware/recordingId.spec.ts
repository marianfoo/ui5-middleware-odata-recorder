import { Request } from 'express';
import { RecorderConfig } from '../../src/types';
import { extractRecordingId, createEntityFileName, createBufferKey } from '../../src/middleware/odataRecorder';

// Mock fs for file operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn()
  }
}));

describe('Recording ID Functionality', () => {
  let mockRequest: Partial<Request>;
  
  beforeEach(() => {
    mockRequest = {
      query: {},
      path: '/test',
      method: 'GET'
    };
  });

  describe('extractRecordingId function', () => {
    it('should return undefined when no defaultTenant and no query param', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      mockRequest.query = {};
      const result = extractRecordingId(mockRequest as Request, config);

      expect(result).toBeUndefined();
    });

    it('should return defaultTenant when specified in config and no query param', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream', 
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = {};
      const result = extractRecordingId(mockRequest as Request, config);

      expect(result).toBe('100');
    });

    it('should prioritize recordingId query param over defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'recordingId': '200' };
      const result = extractRecordingId(mockRequest as Request, config);
      
      expect(result).toBe('200'); // Query param should override default
    });

    it('should handle recordingId with no defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'recordingId': '300' };
      const result = extractRecordingId(mockRequest as Request, config);
      
      expect(result).toBe('300');
    });

    it('should return undefined when recordingId is empty string', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'recordingId': '' };
      const result = extractRecordingId(mockRequest as Request, config);

      expect(result).toBe('100'); // Falls back to default
    });

    it('should return undefined when recordingId is whitespace', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'recordingId': '   ' };
      const result = extractRecordingId(mockRequest as Request, config);

      expect(result).toBeUndefined(); // Whitespace is trimmed and considered empty
    });

    it('should handle various recordingId values', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream', 
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      const testCases = [
        { input: '100', expected: '100' },
        { input: '001', expected: '001' },
        { input: 'dev', expected: 'dev' },
        { input: 'demo', expected: 'demo' },
        { input: 'test-scenario', expected: 'test-scenario' },
        { input: '0', expected: '0' }
      ];

      testCases.forEach(({ input, expected }) => {
        mockRequest.query = { 'recordingId': input };
        const result = extractRecordingId(mockRequest as Request, config);
        expect(result).toBe(expected);
      });
    });
  });

  describe('File naming', () => {
    it('should create filename without recordingId suffix when no recordingId specified', () => {
      const fileName = createEntityFileName('Books', undefined);
      expect(fileName).toBe('Books.json');
    });

    it('should create filename with recordingId suffix when recordingId specified', () => {
      const fileName = createEntityFileName('Books', '100');
      expect(fileName).toBe('Books-100.json');
    });

    it('should handle different entity sets correctly', () => {
      const testCases = [
        { entitySet: 'Orders', recordingId: undefined, expected: 'Orders.json' },
        { entitySet: 'Orders', recordingId: '100', expected: 'Orders-100.json' },
        { entitySet: 'Customers', recordingId: 'demo', expected: 'Customers-demo.json' },
        { entitySet: 'Products', recordingId: undefined, expected: 'Products.json' }
      ];

      testCases.forEach(({ entitySet, recordingId, expected }) => {
        const fileName = createEntityFileName(entitySet, recordingId);
        expect(fileName).toBe(expected);
      });
    });

    it('should handle empty string recordingId as falsy', () => {
      const fileName = createEntityFileName('Books', '');
      expect(fileName).toBe('Books.json'); // Empty string should be treated as no recordingId
    });
  });

  describe('Buffer key generation', () => {
    it('should create buffer key without recordingId when recordingId is undefined', () => {
      const bufferKey = createBufferKey('mainService', undefined, 'Books');
      expect(bufferKey).toBe('mainService||Books');
    });

    it('should create buffer key with recordingId when recordingId is specified', () => {
      const bufferKey = createBufferKey('mainService', '100', 'Books');
      expect(bufferKey).toBe('mainService|100|Books');
    });

    it('should parse buffer key correctly for recordingId-less files', () => {
      const bufferKey = createBufferKey('mainService', undefined, 'Books');
      const [alias, recordingIdStr, entitySet] = bufferKey.split('|');
      const recordingId = recordingIdStr || undefined;
      
      expect(alias).toBe('mainService');
      expect(recordingId).toBeUndefined();
      expect(entitySet).toBe('Books');
    });

    it('should parse buffer key correctly for recordingId files', () => {
      const bufferKey = createBufferKey('mainService', 'demo', 'Books');
      const [alias, recordingIdStr, entitySet] = bufferKey.split('|');
      const recordingId = recordingIdStr || undefined;
      
      expect(alias).toBe('mainService');
      expect(recordingId).toBe('demo');
      expect(entitySet).toBe('Books');
    });

    it('should handle empty string recordingId consistently', () => {
      const bufferKey = createBufferKey('mainService', '', 'Books');
      expect(bufferKey).toBe('mainService||Books'); // Empty string becomes empty in buffer key
    });
  });

  describe('Configuration validation', () => {
    it('should accept config without defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: true,
        services: [{
          alias: 'mainService',
          version: 'v4',
          basePath: '/odata/v4/',
          targetDir: 'webapp/localService/mainService/data'
        }]
      };

      expect(config.defaultTenant).toBeUndefined();
      expect(config.autoStart).toBe(true);
      expect(config.services).toHaveLength(1);
    });

    it('should accept config with defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'onStop',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: [{
          alias: 'mainService',
          version: 'v4',
          basePath: '/odata/v4/',
          targetDir: 'webapp/localService/mainService/data'
        }]
      };

      expect(config.defaultTenant).toBe('100');
      expect(config.autoStart).toBe(false);
      expect(config.services).toHaveLength(1);
    });
  });

  describe('Logging messages', () => {
    it('should format recordingId message correctly when no recordingId', () => {
      const recordingId = undefined;
      const recordingMsg = recordingId ? `with recordingId: ${recordingId}` : 'without recordingId suffix';
      
      expect(recordingMsg).toBe('without recordingId suffix');
    });

    it('should format recordingId message correctly when recordingId exists', () => {
      const recordingId = '100';
      const recordingMsg = recordingId ? `with recordingId: ${recordingId}` : 'without recordingId suffix';
      
      expect(recordingMsg).toBe('with recordingId: 100');
    });

    it('should format entity capture message correctly', () => {
      const entityCount = 15;
      const entitySet = 'Books';
      
      // Without recordingId
      let recordingId: string | undefined = undefined;
      let message = `Captured ${entityCount} entities for ${entitySet}${recordingId ? ` (recordingId: ${recordingId})` : ''}`;
      expect(message).toBe('Captured 15 entities for Books');
      
      // With recordingId  
      recordingId = 'demo';
      message = `Captured ${entityCount} entities for ${entitySet}${recordingId ? ` (recordingId: ${recordingId})` : ''}`;
      expect(message).toBe('Captured 15 entities for Books (recordingId: demo)');
    });
  });

  describe('Auto-start configuration', () => {
    it('should format auto-start message without recordingId', () => {
      const defaultTenant = undefined;
      const autoSave = 'stream';
      const recordingMsg = defaultTenant ? `with recordingId: ${defaultTenant}` : 'without recordingId suffix';
      const message = `Recording AUTO-STARTED ${recordingMsg}, mode: ${autoSave}`;
      
      expect(message).toBe('Recording AUTO-STARTED without recordingId suffix, mode: stream');
    });

    it('should format auto-start message with recordingId', () => {
      const defaultTenant = '100';
      const autoSave = 'onStop';
      const recordingMsg = defaultTenant ? `with recordingId: ${defaultTenant}` : 'without recordingId suffix';
      const message = `Recording AUTO-STARTED ${recordingMsg}, mode: ${autoSave}`;
      
      expect(message).toBe('Recording AUTO-STARTED with recordingId: 100, mode: onStop');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string recordingId', () => {
      const fileName = createEntityFileName('Books', '');
      expect(fileName).toBe('Books.json'); // Empty string is falsy
    });

    it('should handle zero as recordingId (edge case)', () => {
      const fileName = createEntityFileName('Books', '0');
      expect(fileName).toBe('Books-0.json'); // '0' string is truthy
    });

    it('should handle special characters in entity set names', () => {
      const fileName = createEntityFileName('Order_Items', '100');
      expect(fileName).toBe('Order_Items-100.json');
    });

    it('should handle recordingId with special characters', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'recordingId': 'test-scenario-001' };
      const result = extractRecordingId(mockRequest as Request, config);
      
      expect(result).toBe('test-scenario-001');
    });

    it('should handle very long entity set names', () => {
      const longEntitySet = 'VeryLongEntitySetNameThatExceedsNormalLimits';
      const fileName = createEntityFileName(longEntitySet, 'demo');
      expect(fileName).toBe('VeryLongEntitySetNameThatExceedsNormalLimits-demo.json');
    });

    it('should create buffer keys with special service aliases', () => {
      const bufferKey = createBufferKey('my-service_v2', 'test-data', 'Order_Items');
      expect(bufferKey).toBe('my-service_v2|test-data|Order_Items');
    });

    it('should handle alphanumeric recordingId values', () => {
      const testCases = [
        'alpha123',
        'test-data-v1',
        'scenario_001',
        'DEV',
        'prod2024'
      ];

      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      testCases.forEach((recordingId) => {
        mockRequest.query = { 'recordingId': recordingId };
        const result = extractRecordingId(mockRequest as Request, config);
        expect(result).toBe(recordingId);
        
        const fileName = createEntityFileName('Books', recordingId);
        expect(fileName).toBe(`Books-${recordingId}.json`);
      });
    });
  });
});
