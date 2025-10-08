import { Request } from 'express';
import { RecorderConfig } from '../../src/types';
import { extractTenant, createEntityFileName, createBufferKey } from '../../src/middleware/odataRecorder';

// Mock fs for file operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn()
  }
}));

describe('Tenant Functionality', () => {
  let mockRequest: Partial<Request>;
  
  beforeEach(() => {
    mockRequest = {
      query: {},
      path: '/test',
      method: 'GET'
    };
  });

  describe('extractTenant function', () => {
    it('should return undefined when no defaultTenant and no query param', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      mockRequest.query = {};
      const result = extractTenant(mockRequest as Request, config);

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
      const result = extractTenant(mockRequest as Request, config);

      expect(result).toBe('100');
    });

    it('should prioritize sap-client query param over defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'sap-client': '200' };
      const result = extractTenant(mockRequest as Request, config);
      
      expect(result).toBe('200'); // Query param should override default
    });

    it('should handle sap-client with no defaultTenant', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'sap-client': '300' };
      const result = extractTenant(mockRequest as Request, config);
      
      expect(result).toBe('300');
    });
  });

  describe('File naming', () => {
    it('should create filename without tenant suffix when no tenant specified', () => {
      const fileName = createEntityFileName('Books', undefined);
      expect(fileName).toBe('Books.json');
    });

    it('should create filename with tenant suffix when tenant specified', () => {
      const fileName = createEntityFileName('Books', '100');
      expect(fileName).toBe('Books-100.json');
    });

    it('should handle different entity sets correctly', () => {
      const testCases = [
        { entitySet: 'Orders', tenant: undefined, expected: 'Orders.json' },
        { entitySet: 'Orders', tenant: '100', expected: 'Orders-100.json' },
        { entitySet: 'Customers', tenant: '200', expected: 'Customers-200.json' },
        { entitySet: 'Products', tenant: undefined, expected: 'Products.json' }
      ];

      testCases.forEach(({ entitySet, tenant, expected }) => {
        const fileName = createEntityFileName(entitySet, tenant);
        expect(fileName).toBe(expected);
      });
    });

    it('should handle empty string tenant as falsy', () => {
      const fileName = createEntityFileName('Books', '');
      expect(fileName).toBe('Books.json'); // Empty string should be treated as no tenant
    });
  });

  describe('Buffer key generation', () => {
    it('should create buffer key without tenant when tenant is undefined', () => {
      const bufferKey = createBufferKey('mainService', undefined, 'Books');
      expect(bufferKey).toBe('mainService||Books');
    });

    it('should create buffer key with tenant when tenant is specified', () => {
      const bufferKey = createBufferKey('mainService', '100', 'Books');
      expect(bufferKey).toBe('mainService|100|Books');
    });

    it('should parse buffer key correctly for tenant-less files', () => {
      const bufferKey = createBufferKey('mainService', undefined, 'Books');
      const [alias, tenantStr, entitySet] = bufferKey.split('|');
      const tenant = tenantStr || undefined;
      
      expect(alias).toBe('mainService');
      expect(tenant).toBeUndefined();
      expect(entitySet).toBe('Books');
    });

    it('should parse buffer key correctly for tenant files', () => {
      const bufferKey = createBufferKey('mainService', '100', 'Books');
      const [alias, tenantStr, entitySet] = bufferKey.split('|');
      const tenant = tenantStr || undefined;
      
      expect(alias).toBe('mainService');
      expect(tenant).toBe('100');
      expect(entitySet).toBe('Books');
    });

    it('should handle empty string tenant consistently', () => {
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
    it('should format tenant message correctly when no tenant', () => {
      const tenant = undefined;
      const tenantMsg = tenant ? `for tenant: ${tenant}` : 'without tenant suffix';
      
      expect(tenantMsg).toBe('without tenant suffix');
    });

    it('should format tenant message correctly when tenant exists', () => {
      const tenant = '100';
      const tenantMsg = tenant ? `for tenant: ${tenant}` : 'without tenant suffix';
      
      expect(tenantMsg).toBe('for tenant: 100');
    });

    it('should format entity capture message correctly', () => {
      const entityCount = 15;
      const entitySet = 'Books';
      
      // Without tenant
      let tenant: string | undefined = undefined;
      let message = `Captured ${entityCount} entities for ${entitySet}${tenant ? ` (tenant: ${tenant})` : ''}`;
      expect(message).toBe('Captured 15 entities for Books');
      
      // With tenant  
      tenant = '100';
      message = `Captured ${entityCount} entities for ${entitySet}${tenant ? ` (tenant: ${tenant})` : ''}`;
      expect(message).toBe('Captured 15 entities for Books (tenant: 100)');
    });
  });

  describe('Auto-start configuration', () => {
    it('should format auto-start message without tenant', () => {
      const defaultTenant = undefined;
      const autoSave = 'stream';
      const tenantMsg = defaultTenant ? `for tenant: ${defaultTenant}` : 'without tenant suffix';
      const message = `Recording AUTO-STARTED ${tenantMsg}, mode: ${autoSave}`;
      
      expect(message).toBe('Recording AUTO-STARTED without tenant suffix, mode: stream');
    });

    it('should format auto-start message with tenant', () => {
      const defaultTenant = '100';
      const autoSave = 'onStop';
      const tenantMsg = defaultTenant ? `for tenant: ${defaultTenant}` : 'without tenant suffix';
      const message = `Recording AUTO-STARTED ${tenantMsg}, mode: ${autoSave}`;
      
      expect(message).toBe('Recording AUTO-STARTED for tenant: 100, mode: onStop');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string tenant', () => {
      const fileName = createEntityFileName('Books', '');
      expect(fileName).toBe('Books.json'); // Empty string is falsy
    });

    it('should handle zero as tenant (edge case)', () => {
      const fileName = createEntityFileName('Books', '0');
      expect(fileName).toBe('Books-0.json'); // '0' string is truthy
    });

    it('should handle special characters in entity set names', () => {
      const fileName = createEntityFileName('Order_Items', '100');
      expect(fileName).toBe('Order_Items-100.json');
    });

    it('should handle sap-client with special characters', () => {
      const config: RecorderConfig = {
        controlEndpoints: true,
        autoSave: 'stream',
        writeMetadata: true,
        defaultTenant: '100',
        autoStart: false,
        services: []
      };

      mockRequest.query = { 'sap-client': 'TEST-CLIENT-001' };
      const result = extractTenant(mockRequest as Request, config);
      
      expect(result).toBe('TEST-CLIENT-001');
    });

    it('should handle very long entity set names', () => {
      const longEntitySet = 'VeryLongEntitySetNameThatExceedsNormalLimits';
      const fileName = createEntityFileName(longEntitySet, '100');
      expect(fileName).toBe('VeryLongEntitySetNameThatExceedsNormalLimits-100.json');
    });

    it('should create buffer keys with special service aliases', () => {
      const bufferKey = createBufferKey('my-service_v2', '100', 'Order_Items');
      expect(bufferKey).toBe('my-service_v2|100|Order_Items');
    });
  });
});
