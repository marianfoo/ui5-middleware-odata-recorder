/**
 * OData response parser for V2 and V4
 */
import { BatchItem } from '../types';

export class ODataParser {
  /**
   * Normalize OData response to array of entities
   */
  static normalizeResponse(jsonBody: any, version: 'v2' | 'v4'): any[] {
    if (version === 'v2') {
      // V2 list format: { d: { results: [...] } }
      if (jsonBody.d) {
        if (Array.isArray(jsonBody.d.results)) {
          return jsonBody.d.results;
        } else if (typeof jsonBody.d === 'object') {
          // Single entity: { d: {...} }
          return [jsonBody.d];
        }
      }
    } else {
      // V4 list format: { value: [...] }
      if (Array.isArray(jsonBody.value)) {
        return jsonBody.value;
      } else if (typeof jsonBody === 'object' && !jsonBody.value) {
        // Single entity
        return [jsonBody];
      }
    }
    
    return [];
  }

  /**
   * Parse $batch response (multipart/mixed or JSON)
   * Note: OData V4 supports BOTH multipart/mixed AND JSON formats!
   */
  static parseBatchResponse(body: string, contentType: string, version: 'v2' | 'v4'): BatchItem[] {
    // Detect format by content-type, not by OData version
    if (contentType.includes('multipart/mixed')) {
      // Use multipart parser for both V2 and V4
      return this.parseMultipartBatch(body, contentType);
    } else if (contentType.includes('application/json')) {
      // JSON format (modern V4)
      return this.parseJsonBatch(body);
    } else {
      // Fallback: try JSON first, then multipart
      const jsonItems = this.parseJsonBatch(body);
      if (jsonItems.length > 0) return jsonItems;
      return this.parseMultipartBatch(body, contentType);
    }
  }

  /**
   * Parse multipart/mixed batch (used by both V2 and V4)
   */
  private static parseMultipartBatch(body: string, contentType: string): BatchItem[] {
    const items: BatchItem[] = [];
    
    // Extract boundary from Content-Type header
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      console.error('[OData Parser] No boundary found in content-type:', contentType);
      return items;
    }
    
    const boundary = boundaryMatch[1].trim();
    console.log(`[OData Parser] Parsing multipart batch with boundary: ${boundary}`);
    console.log(`[OData Parser] Full batch body (first 500 chars):`, body.substring(0, 500));
    
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    console.log(`[OData Parser] Split into ${parts.length} parts`);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part.trim() || part.trim() === '--') {
        console.log(`[OData Parser] Part ${i}: skipped (empty or terminator)`);
        continue;
      }
      
      console.log(`[OData Parser] Part ${i}: ${part.substring(0, 200)}...`);
      
      // Look for HTTP response inside the part
      const httpMatch = part.match(/HTTP\/\d\.\d\s+(\d+)/);
      if (!httpMatch) {
        console.log(`[OData Parser] Part ${i}: No HTTP status found`);
        continue;
      }
      
      const statusCode = parseInt(httpMatch[1], 10);
      console.log(`[OData Parser] Part ${i}: HTTP status ${statusCode}`);
      
      // Extract JSON body (after headers, separated by blank line)
      const bodyMatch = part.match(/\r?\n\r?\n({[\s\S]*})\r?\n?/);
      if (!bodyMatch) {
        console.log(`[OData Parser] Part ${i}: No JSON body found`);
        continue;
      }
      
      const jsonBody = bodyMatch[1].trim();
      console.log(`[OData Parser] Part ${i}: JSON body found (${jsonBody.length} chars)`);
      
      // Extract URL/EntitySet from @odata.context (V4) or __metadata.uri (V2)
      let url = '';
      try {
        const json = JSON.parse(jsonBody);
        
        // Try V4 format first: @odata.context
        if (json['@odata.context']) {
          const contextMatch = json['@odata.context'].match(/#([^(]+)/);
          if (contextMatch) {
            url = contextMatch[1]; // E.g., "Orders"
            console.log(`[OData Parser] Part ${i}: EntitySet from @odata.context: "${url}"`);
          }
        }
        
        // Try V2 format: extract from __metadata.uri or first entity's __metadata
        if (!url) {
          // For V2 responses with d.results array
          let metadata = json.d?.results?.[0]?.__metadata || json.d?.__metadata;
          
          if (metadata && metadata.uri) {
            // URI format: "http://host/service/EntitySet(...)" or "/service/EntitySet(...)"
            const uriMatch = metadata.uri.match(/\/([^(\/]+)(?:\(|$)/);
            if (uriMatch) {
              url = uriMatch[1]; // E.g., "Orders" or "Customers"
              console.log(`[OData Parser] Part ${i}: EntitySet from V2 __metadata.uri: "${url}"`);
            }
          }
        }
      } catch (e) {
        console.log(`[OData Parser] Part ${i}: JSON parse failed, trying fallback`);
      }
      
      // Final fallback: try to extract from request line or Content-ID
      if (!url) {
        const urlMatch = part.match(/(?:GET|POST)\s+([^\s]+)\s+HTTP/) || 
                         part.match(/Content-ID:\s*([^\r\n]+)/);
        url = urlMatch ? urlMatch[1].trim() : '';
        console.log(`[OData Parser] Part ${i}: URL from fallback: "${url}"`);
      }
      
      items.push({
        url,
        body: jsonBody,
        statusCode
      });
    }
    
    console.log(`[OData Parser] Parsed ${items.length} items from multipart batch`);
    return items;
  }

  /**
   * Parse JSON batch (modern OData V4 format)
   */
  private static parseJsonBatch(body: string): BatchItem[] {
    const items: BatchItem[] = [];
    
    try {
      const batchResponse = JSON.parse(body);
      
      if (batchResponse.responses && Array.isArray(batchResponse.responses)) {
        for (const response of batchResponse.responses) {
          items.push({
            url: response.id || '',
            body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
            statusCode: response.status || 200
          });
        }
      }
    } catch (e) {
      // Invalid JSON, return empty
    }
    
    return items;
  }

  /**
   * Extract EntitySet name from URL
   */
  static extractEntitySet(url: string, basePath: string): string | null {
    // Remove basePath prefix
    let path = url;
    if (path.startsWith(basePath)) {
      path = path.substring(basePath.length);
    }
    
    // Remove leading slash
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // Remove query string
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }
    
    // Take first segment and remove key predicates
    const firstSegment = path.split('/')[0];
    if (!firstSegment) return null;
    
    // Remove (key) part: "Products(1)" -> "Products"
    const parenIndex = firstSegment.indexOf('(');
    return parenIndex !== -1 ? firstSegment.substring(0, parenIndex) : firstSegment;
  }
}
