/**
 * UI5 OData Recorder Middleware
 * Records OData traffic and writes FE-mockserver-compatible datasets
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as http from 'http';
import * as https from 'https';
import { RecorderConfig, RecorderRuntime, BufferKey, ServiceConfig, ODataResponse } from '../types';
import { EdmxParser } from '../utils/edmxParser';
import { ODataParser } from '../utils/odataParser';
import { EntityMerger } from '../utils/entityMerger';
import { removeSelectFromRequest } from '../utils/urlUtils';

// Global debug from environment OR config
let DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function debug(...args: any[]) {
  if (DEBUG) console.log('[RECORDER DEBUG]', ...args);
}

/**
 * Main middleware factory function (UI5 custom middleware format)
 */
export default function createMiddleware({ options, middlewareUtil }: any): RequestHandler {
  debug('Raw options received by middleware:', JSON.stringify(options, null, 2));
  debug('typeof options:', typeof options);
  debug('options keys:', Object.keys(options || {}));
  
  // UI5 tooling wraps configuration in a 'configuration' key
  const rawConfig = options.configuration || options;
  debug('Using rawConfig:', JSON.stringify(rawConfig, null, 2));
  
  const config: RecorderConfig = {
    controlEndpoints: rawConfig.controlEndpoints ?? true,
    autoSave: rawConfig.autoSave ?? 'stream',
    writeMetadata: rawConfig.writeMetadata ?? true,
    defaultTenant: rawConfig.defaultTenant, // undefined if not specified
    autoStart: rawConfig.autoStart ?? false,
    removeSelectParams: rawConfig.removeSelectParams ?? true,
    expandedNavigationStrategy: rawConfig.expandedNavigationStrategy ?? 'auto',
    enrichForeignKeys: rawConfig.enrichForeignKeys ?? true,
    backendUrl: rawConfig.backendUrl, // undefined if not specified
    redact: rawConfig.redact ?? [],
    services: rawConfig.services ?? []
  };
  
  // Set debug mode from config if specified
  if (rawConfig.debug !== undefined) {
    DEBUG = rawConfig.debug;
  }
  
  debug('Processed config:', JSON.stringify(config, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('  UI5 OData Recorder Middleware Loaded ✓');
  console.log('='.repeat(60));
  console.log('  Control Endpoints:', config.controlEndpoints ? '✓ Enabled' : '✗ Disabled');
  console.log('  Auto Save Mode:', config.autoSave);
  console.log('  Auto Start:', config.autoStart ? '✓ Enabled' : '✗ Disabled');
  console.log('  Remove $select:', config.removeSelectParams ? '✓ Enabled (full entities)' : '✗ Disabled');
  console.log('  Expanded Nav Strategy:', config.expandedNavigationStrategy);
  console.log('  Enrich Foreign Keys:', config.enrichForeignKeys ? '✓ Enabled' : '✗ Disabled');
  console.log('  Backend URL:', config.backendUrl || 'None (no proactive metadata fetch)');
  console.log('  Default Recording ID:', config.defaultTenant || 'None (no suffix)');
  console.log('  Services:');
  config.services.forEach(s => {
    console.log(`    - ${s.alias}: ${s.basePath} (${s.version})`);
  });
  console.log('  Debug Mode:', DEBUG ? '✓ Enabled' : '✗ Disabled');
  console.log('='.repeat(60) + '\n');

  debug('Full config:', config);

  const runtime: RecorderRuntime = {
    active: config.autoStart, // Start recording immediately if autoStart is enabled
    tenant: config.defaultTenant,
    mode: config.autoSave,
    buffers: new Map(),
    entityKeys: new Map(),
    metadataCache: new Map()
  };

  // If auto-start is enabled, announce it and load metadata
  if (config.autoStart) {
    const recordingMsg = config.defaultTenant 
      ? `with recordingId: ${config.defaultTenant}` 
      : 'without recordingId suffix';
    console.log(`[OData Recorder] 🎬 Recording AUTO-STARTED ${recordingMsg}, mode: ${config.autoSave}`);
  }

  const parsers = new Map<string, EdmxParser>(); // alias -> parser

  // Proactively load metadata for all services if auto-start is enabled
  if (config.autoStart) {
    for (const service of config.services) {
      loadMetadataForService(service, runtime, parsers, config, config.backendUrl).catch(err => {
        debug(`[TRACE] Failed to load metadata for ${service.alias}:`, err);
      });
    }
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // Log EVERY request that comes through
    debug(`[TRACE] → Request: ${req.method} ${req.path} | Recording: ${runtime.active}`);
    
    // Handle control endpoints
    if (config.controlEndpoints && req.path.startsWith('/__recorder')) {
      debug('Control endpoint called:', req.path);
      return handleControlEndpoint(req, res, runtime, config, parsers);
    }

    // Check for auto-start flag or recordingId parameter
    const shouldAutoStart = req.query.__record === '1' || req.query.recordingId;
    if (shouldAutoStart && !runtime.active) {
      const recordingId = extractRecordingId(req, config);
      debug('Auto-start triggered from query param, recordingId:', recordingId);
      startRecording(runtime, recordingId, config.autoSave);
      const recordingMsg = recordingId ? `with recordingId: ${recordingId}` : 'without recordingId suffix';
      console.log(`[OData Recorder] Auto-started recording ${recordingMsg}`);
      
      // Proactively load metadata for all services
      for (const service of config.services) {
        loadMetadataForService(service, runtime, parsers, config, config.backendUrl).catch(err => {
          debug(`[TRACE] Failed to load metadata for ${service.alias}:`, err);
        });
      }
    }

    // If not recording, just pass through
    if (!runtime.active) {
      debug(`[TRACE] ✗ Not recording, skipping: ${req.path}`);
      return next();
    }

    // Check if this request matches any service
    debug(`[TRACE] Checking service match for: ${req.path}`);
    debug(`[TRACE] Available services:`, config.services.map(s => ({ alias: s.alias, basePath: s.basePath })));
    
    const service = findMatchingService(req.path, config.services);
    if (!service) {
      debug(`[TRACE] ✗ No matching service for path: ${req.path}`);
      return next();
    }

    console.log(`[OData Recorder] ✓ Intercepting ${req.method} ${req.path} for service ${service.alias}`);
    debug('[TRACE] Setting up response tap...');
    debug('Request details:', { method: req.method, path: req.path, query: req.query, contentType: req.headers['content-type'] });

    // Modify request to remove $select parameters if configured
    if (config.removeSelectParams) {
      const originalUrl = req.url;
      const contentType = req.headers['content-type'] as string;
      let body: string | undefined;
      
      // For batch requests, we need to modify the body
      if (req.body && typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && Buffer.isBuffer(req.body)) {
        body = req.body.toString('utf-8');
      }
      
      const modified = removeSelectFromRequest(req.url, body, contentType);
      
      if (modified.url !== originalUrl || modified.body !== body) {
        debug(`[TRACE] Modified request - Original: ${originalUrl}`);
        debug(`[TRACE] Modified request - New: ${modified.url}`);
        
        // Update the request URL - Express will automatically update req.path
        req.url = modified.url;
        
        // Parse new query parameters
        const urlObj = new URL(modified.url, 'http://localhost');
        const newQuery: any = {};
        for (const [key, value] of urlObj.searchParams.entries()) {
          newQuery[key] = value;
        }
        req.query = newQuery;
        
        // Update body if it was modified (for batch requests)
        if (modified.body !== body) {
          req.body = modified.body;
          debug(`[TRACE] Modified batch body (${body?.length || 0} -> ${modified.body?.length || 0} chars)`);
        }
        
        console.log(`[OData Recorder] 🔧 Removed $select parameters from request to get full entities`);
      }
    }

    // Remove caching headers from metadata requests to force fresh responses (prevents 304 Not Modified)
    if (req.path.includes('$metadata')) {
      const removedHeaders: string[] = [];
      
      // Remove ETag-related headers that cause 304 responses
      if (req.headers['if-none-match']) {
        delete req.headers['if-none-match'];
        removedHeaders.push('If-None-Match');
      }
      
      if (req.headers['if-modified-since']) {
        delete req.headers['if-modified-since'];
        removedHeaders.push('If-Modified-Since');
      }
      
      // Also remove other caching headers that might cause 304
      if (req.headers['cache-control']) {
        delete req.headers['cache-control'];
        removedHeaders.push('Cache-Control');
      }
      
      if (removedHeaders.length > 0) {
        console.log(`[OData Recorder] 🔄 Removed caching headers [${removedHeaders.join(', ')}] from metadata request to ensure fresh response`);
        debug(`[TRACE] Removed headers to prevent 304: ${removedHeaders.join(', ')}`);
      }
    }

    // Tap the response
    tapResponse(req, res, next, service, runtime, config, parsers);
  };
}

/**
 * Handle control endpoints
 */
async function handleControlEndpoint(
  req: Request,
  res: Response,
  runtime: RecorderRuntime,
  config: RecorderConfig,
  parsers: Map<string, EdmxParser>
): Promise<void> {
  const action = req.path.replace('/__recorder/', '');
  debug('Control endpoint action:', action, 'Query:', req.query);

  switch (action) {
    case 'start':
      const recordingId = extractRecordingId(req, config);
      const mode = (req.query.mode as 'onStop' | 'stream') || config.autoSave;
      startRecording(runtime, recordingId, mode);
      
      // Proactively load metadata for all services
      for (const service of config.services) {
        loadMetadataForService(service, runtime, parsers, config, config.backendUrl).catch(err => {
          debug(`[TRACE] Failed to load metadata for ${service.alias}:`, err);
        });
      }
      
      res.json({ status: 'started', recordingId, mode });
      break;

    case 'stop':
      const itemsWritten = await flushAllBuffers(runtime, config, parsers);
      runtime.active = false;
      res.json({ status: 'stopped', itemsWritten });
      break;

    case 'status':
      res.json({
        active: runtime.active,
        tenant: runtime.tenant,
        mode: runtime.mode,
        bufferedKeys: Array.from(runtime.buffers.keys())
      });
      break;

    case 'flush':
      const count = await flushAllBuffers(runtime, config, parsers);
      res.json({ status: 'flushed', itemsWritten: count });
      break;

    default:
      res.status(404).json({ error: 'Unknown command' });
  }
}

/**
 * Start recording
 */
/**
 * Proactively fetch and parse metadata for a service
 * This ensures navigation property mappings are available before data requests arrive
 */
async function loadMetadataForService(
  service: ServiceConfig,
  runtime: RecorderRuntime,
  parsers: Map<string, EdmxParser>,
  config: RecorderConfig,
  backendUrl?: string
): Promise<void> {
  // Skip if already loaded
  if (parsers.has(service.alias)) {
    debug(`[TRACE] Metadata already loaded for ${service.alias}`);
    return;
  }

  // Skip if no backend URL configured
  if (!backendUrl) {
    debug(`[TRACE] No backendUrl configured, skipping proactive metadata fetch for ${service.alias}`);
    console.log(`[OData Recorder] ℹ️ Skipping proactive metadata fetch for ${service.alias} - no backendUrl configured`);
    return;
  }

  // Construct metadata URL
  const metadataPath = `${service.basePath}$metadata`;
  const metadataUrl = `${backendUrl}${metadataPath}`;
  
  debug(`[TRACE] Proactively fetching metadata from: ${metadataUrl}`);
  
  try {
    const protocol = metadataUrl.startsWith('https') ? https : http;
    const xmlData = await new Promise<string>((resolve, reject) => {
      protocol.get(metadataUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Metadata fetch failed with status ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    // Parse and cache
    const parser = new EdmxParser();
    await parser.parse(xmlData);
    parsers.set(service.alias, parser);
    runtime.metadataCache.set(service.alias, xmlData);
    
    // Write metadata to disk if configured
    if (config.writeMetadata) {
      await writeMetadata(service.alias, xmlData, config);
    }
    
    console.log(`[OData Recorder] ✓ Proactively loaded metadata for ${service.alias}`);
    debug(`[TRACE] Metadata parsed successfully for ${service.alias}`);
  } catch (error) {
    console.warn(`[OData Recorder] ⚠️ Failed to proactively load metadata for ${service.alias}:`, error instanceof Error ? error.message : error);
    debug(`[TRACE] Metadata fetch error:`, error);
    // Don't throw - metadata will be loaded on first $metadata request
  }
}

function startRecording(runtime: RecorderRuntime, recordingId: string | undefined, mode: 'onStop' | 'stream'): void {
  debug('startRecording called:', { recordingId, mode });
  runtime.active = true;
  runtime.tenant = recordingId; // Keep using tenant property internally for backward compatibility
  runtime.mode = mode;
  runtime.buffers.clear();
  const recordingMsg = recordingId ? `with recordingId: ${recordingId}` : 'without recordingId suffix';
  console.log(`[OData Recorder] 🎬 Recording ACTIVE ${recordingMsg}, mode: ${mode}`);
}

/**
 * Find service that matches the request path
 */
function findMatchingService(requestPath: string, services: ServiceConfig[]): ServiceConfig | null {
  return services.find(s => requestPath.startsWith(s.basePath)) || null;
}

/**
 * Extract recording ID from request
 */
export function extractRecordingId(req: Request, config: RecorderConfig): string | undefined {
  // URL parameter takes precedence over config
  const recordingId = req.query['recordingId'] as string;
  if (recordingId && recordingId.trim() !== '') {
    return recordingId;
  }
  
  // Fall back to default from config
  return config.defaultTenant; // undefined if not specified in config
}

/**
 * Create entity filename with or without recording ID suffix
 */
export function createEntityFileName(entitySet: string, recordingId?: string): string {
  return recordingId ? `${entitySet}-${recordingId}.json` : `${entitySet}.json`;
}

/**
 * Create buffer key for entity storage
 */
export function createBufferKey(alias: string, recordingId: string | undefined, entitySet: string): string {
  return `${alias}|${recordingId || ''}|${entitySet}`;
}

/**
 * Tap into response stream
 */
function tapResponse(
  req: Request,
  res: Response,
  next: NextFunction,
  service: ServiceConfig,
  runtime: RecorderRuntime,
  config: RecorderConfig,
  parsers: Map<string, EdmxParser>
): void {
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const chunks: Buffer[] = [];

  debug(`[TRACE] ✓ Response tap installed for: ${req.path}`);

  // Intercept write
  res.write = function(chunk: any, ...args: any[]): boolean {
    debug(`[TRACE] res.write called for ${req.path}, chunk size: ${chunk ? chunk.length : 0}`);
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return originalWrite(chunk, ...args);
  };

  // Intercept end
  res.end = function(chunk: any, ...args: any[]): any {
    debug(`[TRACE] res.end called for ${req.path}, chunk size: ${chunk ? chunk.length : 0}, total chunks: ${chunks.length}`);
    
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    // Check status code first - skip recording for error responses
    const statusCode = res.statusCode;
    if (statusCode >= 400) {
      // Skip recording for client errors (4xx) and server errors (5xx)
      if (statusCode === 401 || statusCode === 403) {
        debug(`[TRACE] ⚠️ Skipping recording for authentication error (${statusCode}): ${req.path}`);
        console.log(`[OData Recorder] ⚠️ Skipping recording due to authentication error (${statusCode}) - please authenticate first`);
      } else {
        debug(`[TRACE] ⚠️ Skipping recording for error response (${statusCode}): ${req.path}`);
        console.log(`[OData Recorder] ⚠️ Skipping recording due to error response (${statusCode}): ${req.path}`);
      }
      return originalEnd(chunk, ...args);
    }

    const rawBuffer = Buffer.concat(chunks);
    const encoding = res.getHeader('content-encoding');
    
    // Decompress if needed BEFORE converting to string
    let decompressedBuffer: Buffer = rawBuffer;
    if (encoding === 'gzip' || encoding === 'br') {
      try {
        const result = encoding === 'gzip' 
          ? zlib.gunzipSync(rawBuffer)
          : zlib.brotliDecompressSync(rawBuffer);
        decompressedBuffer = Buffer.from(result);
        debug(`[TRACE] Decompressed ${encoding}: ${rawBuffer.length} → ${decompressedBuffer.length} bytes`);
      } catch (e) {
        console.error(`[OData Recorder] Decompression failed for ${req.path}:`, e);
        
        // If metadata decompression fails, provide guidance
        if (req.path.includes('$metadata') && config.writeMetadata) {
          console.error(`[OData Recorder] ❌ Metadata decompression failed - this may indicate a server error`);
          console.error(`[OData Recorder] 💡 Try refreshing the page or check if the backend is returning valid metadata`);
        }
        
        return originalEnd(chunk, ...args);
      }
    }
    
    const responseData: ODataResponse = {
      statusCode: res.statusCode,
      headers: res.getHeaders() as Record<string, string | string[] | undefined>,
      body: decompressedBuffer.toString('utf-8'),
      isMetadata: req.path.includes('$metadata'),
      isBatch: req.path.includes('$batch')
    };

    debug(`[TRACE] Response data captured:`, {
      path: req.path,
      statusCode: responseData.statusCode,
      bodyLength: responseData.body.length,
      encoding: encoding || 'none',
      isMetadata: responseData.isMetadata,
      isBatch: responseData.isBatch
    });

    // Process async but don't block response
    processResponse(req, responseData, service, runtime, config, parsers).catch(err => {
      console.error('[OData Recorder] Error processing response:', err);
    });

    return originalEnd(chunk, ...args);
  };

  debug(`[TRACE] Calling next() to continue middleware chain...`);
  next();
}

/**
 * Process captured response
 */
async function processResponse(
  req: Request,
  response: ODataResponse,
  service: ServiceConfig,
  runtime: RecorderRuntime,
  config: RecorderConfig,
  parsers: Map<string, EdmxParser>
): Promise<void> {
  debug(`[TRACE] 📥 processResponse called for: ${req.path}`);
  debug(`[TRACE] Status: ${response.statusCode}, Body length: ${response.body.length}, Is Metadata: ${response.isMetadata}, Is Batch: ${response.isBatch}`);
  
  // Body is already decompressed in tapResponse
  const body = response.body;

  // Handle metadata - only write if valid XML
  if (response.isMetadata && config.writeMetadata) {
    // Handle 304 Not Modified (should be rare now due to ETag removal)
    if (response.statusCode === 304) {
      console.warn(`[OData Recorder] ⚠️ Received 304 for metadata despite ETag removal - check if caching headers were properly removed`);
      debug(`[TRACE] Unexpected 304 response for metadata request`);
      return;
    }
    
    // Skip empty responses
    if (!body || body.trim().length === 0) {
      debug(`[TRACE] Skipping metadata - empty body (status: ${response.statusCode})`);
      return;
    }
    
    // Validate it's actually XML (not an error response)
    if (!body.includes('<?xml') && !body.includes('<edmx:Edmx')) {
      console.warn(`[OData Recorder] Skipping invalid metadata for ${service.alias} - not valid XML`);
      debug(`[TRACE] Invalid body (first 200 chars): ${body.substring(0, 200)}`);
      return;
    }
    
    debug(`[TRACE] Writing valid metadata for ${service.alias} (${body.length} bytes)...`);
    await writeMetadata(service.alias, body, config);
    
    // Parse and cache for key extraction
    try {
      const parser = new EdmxParser();
      await parser.parse(body);
      parsers.set(service.alias, parser);
      runtime.metadataCache.set(service.alias, body);
      console.log(`[OData Recorder] ✓ Metadata updated for ${service.alias}`);
    } catch (e) {
      console.error(`[OData Recorder] Failed to parse metadata for ${service.alias}:`, e);
    }
    return;
  }

  // Handle $batch
  if (response.isBatch) {
    debug(`[TRACE] Processing batch response...`);
    const contentType = (response.headers['content-type'] as string) || '';
    debug(`[TRACE] Batch content-type: ${contentType}`);
    
    const batchItems = ODataParser.parseBatchResponse(body, contentType, service.version);
    debug(`[TRACE] Batch items parsed: ${batchItems.length} items`);
    
    for (const item of batchItems) {
      debug(`[TRACE] Processing batch item: ${item.url}`);
      await processSingleResponse(item.url, item.body, service, runtime, config, parsers);
    }
    console.log(`[OData Recorder] Processed ${batchItems.length} batch items`);
    return;
  }

  // Handle regular JSON response
  const contentType = (response.headers['content-type'] as string) || '';
  if (contentType.includes('application/json')) {
    await processSingleResponse(req.path, body, service, runtime, config, parsers);
  }
}

/**
 * Process a single OData response (not batch)
 */
async function processSingleResponse(
  url: string,
  jsonBody: string,
  service: ServiceConfig,
  runtime: RecorderRuntime,
  config: RecorderConfig,
  parsers: Map<string, EdmxParser>
): Promise<void> {
  debug(`[TRACE] processSingleResponse: URL=${url}, bodyLength=${jsonBody.length}`);
  
  let parsed: any;
  try {
    parsed = JSON.parse(jsonBody);
  } catch (e) {
    debug(`[TRACE] ✗ JSON parse failed for ${url}`);
    return; // Not JSON
  }

  debug(`[TRACE] JSON parsed successfully`);

  // Extract entity set
  const entitySet = ODataParser.extractEntitySet(url, service.basePath);
  debug(`[TRACE] Extracted entity set: ${entitySet || 'NONE'} from URL: ${url}`);
  if (!entitySet) return;

  // Normalize to entity array
  const entities = ODataParser.normalizeResponse(parsed, service.version);
  debug(`[TRACE] Normalized ${entities.length} entities from ${entitySet}`);
  if (entities.length === 0) return;

  // Get navigation mappings for this entity set
  const parser = parsers.get(service.alias);
  const navigationTargets = parser?.getNavigationTargets(entitySet) || new Map();
  debug(`[TRACE] Navigation targets for ${entitySet}:`, Array.from(navigationTargets.entries()));

  // Process expanded navigations for each entity
  const allExpandedNavigations: Map<string, any[]> = new Map();
  const strategy = config.expandedNavigationStrategy || 'auto';
  
  for (const entity of entities) {
    // Extract all expanded navigations from the entity (this modifies the entity, removing expanded data)
    const expansions = ODataParser.extractExpandedNavigations(entity, service.version);
    debug(`[TRACE] Found ${expansions.length} expanded navigations in entity`);
    
    for (const expansion of expansions) {
      debug(`[TRACE] Analyzing expanded navigation: ${expansion.navProperty} with ${expansion.entities.length} entities`);
      
      // Look up target EntitySet for this navigation property
      const targetEntitySet = navigationTargets.get(expansion.navProperty);
      
      if (!targetEntitySet) {
        debug(`[TRACE] ⚠️ No EntitySet mapping found for navigation property: ${expansion.navProperty}`);
        console.log(`[OData Recorder] ⚠️ Skipping expanded navigation '${expansion.navProperty}' - no EntitySet mapping found in metadata`);
        continue;
      }
      
      // Decide whether to extract based on strategy
      let shouldExtract = false;
      
      if (strategy === 'always-inline') {
        shouldExtract = false;
        debug(`[TRACE] Strategy 'always-inline': keeping ${expansion.navProperty} inline`);
      } else if (strategy === 'always-separate') {
        shouldExtract = true;
        debug(`[TRACE] Strategy 'always-separate': extracting ${expansion.navProperty}`);
      } else {
        // Auto mode: check for referential constraints
        const hasConstraints = parser?.hasReferentialConstraints(entitySet, expansion.navProperty) || false;
        
        if (hasConstraints) {
          shouldExtract = true;
          debug(`[TRACE] Auto mode: ${expansion.navProperty} has referential constraints -> extracting`);
        } else {
          shouldExtract = false;
          debug(`[TRACE] Auto mode: ${expansion.navProperty} has NO referential constraints -> keeping inline`);
          console.log(`[OData Recorder] ⚠️ Navigation '${expansion.navProperty}' in '${entitySet}' has no referential constraints - keeping inline data`);
          console.log(`[OData Recorder] 💡 To enable separate file extraction, add referential constraints to your metadata`);
        }
      }
      
      if (shouldExtract) {
        debug(`[TRACE] Extracting ${expansion.navProperty} -> EntitySet ${targetEntitySet}`);
        
        // Optionally enrich foreign keys
        if (config.enrichForeignKeys && parser) {
          const constraints = parser.getReferentialConstraints(entitySet, expansion.navProperty);
          if (constraints.length > 0) {
            // For each constraint, we need to ensure the foreign key exists
            // The constraint maps: parent.sourceProperty -> child.targetProperty
            // But we also need to ensure parent.sourceProperty exists (for V2 expanded navigations)
            for (const constraint of constraints) {
              // If parent is missing the source property (foreign key), inject it from the first child
              if (!(constraint.sourceProperty in entity) && expansion.entities.length > 0) {
                const firstChild = expansion.entities[0];
                if (constraint.targetProperty in firstChild) {
                  entity[constraint.sourceProperty] = firstChild[constraint.targetProperty];
                  debug(`[TRACE] Enriched parent FK: ${constraint.sourceProperty} = ${firstChild[constraint.targetProperty]}`);
                }
              }
              
              // Also enrich children if they're missing the target property
              for (const childEntity of expansion.entities) {
                if (!(constraint.targetProperty in childEntity) && constraint.sourceProperty in entity) {
                  childEntity[constraint.targetProperty] = entity[constraint.sourceProperty];
                  debug(`[TRACE] Enriched child FK: ${constraint.targetProperty} = ${entity[constraint.sourceProperty]}`);
                }
              }
            }
          }
        }
        
        // Accumulate entities for this target EntitySet
        const existing = allExpandedNavigations.get(targetEntitySet) || [];
        allExpandedNavigations.set(targetEntitySet, [...existing, ...expansion.entities]);
      } else {
        // Keep inline - need to put the data back into the entity
        debug(`[TRACE] Keeping ${expansion.navProperty} inline in ${entitySet}`);
        // Put the expanded data back
        if (expansion.entities.length === 1 && !Array.isArray(entity[expansion.navProperty])) {
          // Single entity navigation
          entity[expansion.navProperty] = expansion.entities[0];
        } else {
          // Collection navigation
          entity[expansion.navProperty] = expansion.entities;
        }
      }
    }
  }

  // Get keys for the main entity set
  const keys = parser?.getKeysForEntitySet(entitySet) || [];

  // Redact sensitive fields from main entities
  const redacted = entities.map(e => EntityMerger.redact(e, config.redact || []));

  // Save main entities
  const bufferKey: BufferKey = createBufferKey(service.alias, runtime.tenant, entitySet);
  
  if (runtime.mode === 'stream') {
    // Immediately write to file
    await writeEntities(service, entitySet, runtime.tenant, redacted, keys, parsers);
  } else {
    // Buffer for later
    const existing = runtime.buffers.get(bufferKey) || [];
    const merged = EntityMerger.merge(existing, redacted, keys);
    runtime.buffers.set(bufferKey, merged);
  }

  console.log(`[OData Recorder] Captured ${entities.length} entities for ${entitySet}${runtime.tenant ? ` (recordingId: ${runtime.tenant})` : ''}`);

  // Process and save expanded navigation entities
  for (const [targetEntitySet, expandedEntities] of allExpandedNavigations.entries()) {
    debug(`[TRACE] Processing ${expandedEntities.length} expanded entities for ${targetEntitySet}`);
    
    // Get keys for the target entity set
    const targetKeys = parser?.getKeysForEntitySet(targetEntitySet) || [];
    
    // Recursively process expanded entities (they may have their own expansions)
    for (const expandedEntity of expandedEntities) {
      const nestedExpansions = ODataParser.extractExpandedNavigations(expandedEntity, service.version);
      
      if (nestedExpansions.length > 0) {
        debug(`[TRACE] Found ${nestedExpansions.length} nested expansions in ${targetEntitySet}`);
        
        // Get navigation targets for the expanded entity set
        const nestedNavTargets = parser?.getNavigationTargets(targetEntitySet) || new Map();
        
        for (const nestedExpansion of nestedExpansions) {
          const nestedTargetEntitySet = nestedNavTargets.get(nestedExpansion.navProperty);
          
          if (nestedTargetEntitySet) {
            debug(`[TRACE] Processing nested navigation: ${nestedExpansion.navProperty} -> ${nestedTargetEntitySet}`);
            
            // Accumulate nested entities
            const nestedExisting = allExpandedNavigations.get(nestedTargetEntitySet) || [];
            allExpandedNavigations.set(nestedTargetEntitySet, [...nestedExisting, ...nestedExpansion.entities]);
          }
        }
      }
    }
    
    // Redact sensitive fields from expanded entities
    const redactedExpanded = expandedEntities.map(e => EntityMerger.redact(e, config.redact || []));
    
    // Save expanded entities
    const expandedBufferKey: BufferKey = createBufferKey(service.alias, runtime.tenant, targetEntitySet);
    
    if (runtime.mode === 'stream') {
      // Immediately write to file
      await writeEntities(service, targetEntitySet, runtime.tenant, redactedExpanded, targetKeys, parsers);
    } else {
      // Buffer for later
      const existingExpanded = runtime.buffers.get(expandedBufferKey) || [];
      const mergedExpanded = EntityMerger.merge(existingExpanded, redactedExpanded, targetKeys);
      runtime.buffers.set(expandedBufferKey, mergedExpanded);
    }
    
    console.log(`[OData Recorder] Captured ${expandedEntities.length} expanded entities for ${targetEntitySet}${runtime.tenant ? ` (recordingId: ${runtime.tenant})` : ''}`);
  }
}

/**
 * Check if file content is identical to new content (prevents unnecessary writes)
 */
async function isFileContentIdentical(filePath: string, newContent: string): Promise<boolean> {
  try {
    if (!fs.existsSync(filePath)) {
      return false; // File doesn't exist, content is different
    }
    
    const existingContent = await fs.promises.readFile(filePath, 'utf-8');
    return existingContent === newContent;
  } catch (e) {
    debug(`[TRACE] Error checking file content for ${filePath}:`, e);
    return false; // On error, assume content is different
  }
}

/**
 * Write metadata.xml file (only if content changed)
 */
async function writeMetadata(alias: string, xml: string, config: RecorderConfig): Promise<void> {
  const service = config.services.find(s => s.alias === alias);
  if (!service) return;

  // Metadata path: targetDir should be .../localService/<ALIAS>/data
  // We want .../localService/<ALIAS>/metadata.xml
  const metadataPath = path.join(path.dirname(service.targetDir), 'metadata.xml');
  
  await ensureDir(path.dirname(metadataPath));
  
  // Check if content is identical to avoid unnecessary writes (prevents auto-reload loops)
  if (await isFileContentIdentical(metadataPath, xml)) {
    debug(`[TRACE] Skipping metadata write - content unchanged: ${metadataPath}`);
    return;
  }
  
  // Content is different, write the file
  await fs.promises.writeFile(metadataPath, xml, 'utf-8');
  console.log(`[OData Recorder] 📝 Updated metadata: ${alias}/metadata.xml`);
  debug(`[TRACE] Metadata file written: ${metadataPath} (${xml.length} bytes)`);
}

/**
 * Write entities to file (only if content changed)
 */
async function writeEntities(
  service: ServiceConfig,
  entitySet: string,
  recordingId: string | undefined,
  entities: any[],
  keys: string[],
  parsers: Map<string, EdmxParser>
): Promise<void> {
  // Create filename: with recording ID suffix only if recording ID is specified
  const fileName = createEntityFileName(entitySet, recordingId);
  const filePath = path.join(service.targetDir, fileName);
  await ensureDir(service.targetDir);

  // Read existing file if present and merge
  let existing: any[] = [];
  if (fs.existsSync(filePath)) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    try {
      existing = JSON.parse(content);
    } catch (e) {
      console.warn(`[OData Recorder] Could not parse existing ${filePath}, overwriting`);
    }
  }

  const merged = EntityMerger.merge(existing, entities, keys);
  const newContent = JSON.stringify(merged, null, 2);
  
  // Check if content is identical to avoid unnecessary writes (prevents auto-reload loops)
  if (await isFileContentIdentical(filePath, newContent)) {
    debug(`[TRACE] Skipping entity write - content unchanged: ${fileName}`);
    return;
  }
  
  // Content is different, write the file
  await fs.promises.writeFile(filePath, newContent, 'utf-8');
  console.log(`[OData Recorder] 📝 Updated entities: ${fileName} (${merged.length} entities)`);
}

/**
 * Flush all buffers to disk
 */
async function flushAllBuffers(
  runtime: RecorderRuntime,
  config: RecorderConfig,
  parsers: Map<string, EdmxParser>
): Promise<number> {
  let count = 0;
  const writes: Promise<void>[] = [];

  console.log(`[OData Recorder] Flushing ${runtime.buffers.size} buffered entity sets...`);

  for (const [bufferKey, entities] of runtime.buffers.entries()) {
    const [alias, tenantStr, entitySet] = bufferKey.split('|');
    const tenant = tenantStr || undefined; // convert empty string back to undefined
    const service = config.services.find(s => s.alias === alias);
    
    if (service) {
      const parser = parsers.get(alias);
      const keys = parser?.getKeysForEntitySet(entitySet) || [];
      
      console.log(`[OData Recorder] Processing ${entities.length} entities for ${entitySet}${tenant ? ` (recordingId: ${tenant})` : ''}`);
      
      const writePromise = writeEntities(service, entitySet, tenant, entities, keys, parsers)
        .catch(err => {
          console.error(`[OData Recorder] ✗ Error processing ${bufferKey}:`, err);
        });
      
      writes.push(writePromise);
      count++;
    }
  }

  // Wait for all writes to complete
  await Promise.all(writes);
  
  runtime.buffers.clear();
  console.log(`[OData Recorder] Flush complete: ${count} entity sets written`);
  return count;
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}
