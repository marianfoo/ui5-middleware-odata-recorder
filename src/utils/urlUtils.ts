/**
 * Utilities for URL parameter manipulation during OData request processing
 */

/**
 * Removes $select parameters from an OData URL to capture full entity data
 * @param url - The original URL with potential $select parameters
 * @returns URL with $select parameters removed
 */
export function removeSelectFromUrl(url: string): string {
  try {
    // Handle fragment separately since URL constructor processes it
    let fragment = '';
    let urlWithoutFragment = url;
    const fragmentIndex = url.indexOf('#');
    if (fragmentIndex !== -1) {
      fragment = url.substring(fragmentIndex);
      urlWithoutFragment = url.substring(0, fragmentIndex);
    }
    
    const urlObj = new URL(urlWithoutFragment, 'http://localhost'); // Base URL for relative URLs
    const searchParams = urlObj.searchParams;
    
    // Remove $select parameter (case-insensitive)
    for (const [key] of searchParams.entries()) {
      if (key.toLowerCase() === '$select') {
        searchParams.delete(key);
      }
    }
    
    // Build result with proper path and decoded query string
    let result = urlObj.pathname;
    if (urlObj.search) {
      // Manually build query string to avoid over-encoding
      const params: string[] = [];
      for (const [key, value] of searchParams.entries()) {
        params.push(`${key}=${value}`);
      }
      if (params.length > 0) {
        result += '?' + params.join('&');
      }
    }
    
    // Add fragment back if it existed
    result += fragment;
    
    // Preserve original leading slash behavior
    if (!url.startsWith('/') && result.startsWith('/')) {
      result = result.substring(1);
    } else if (url.startsWith('/') && !result.startsWith('/')) {
      result = '/' + result;
    }
    
    return result;
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('[OData Recorder] Failed to parse URL for $select removal:', url, error);
    return url;
  }
}

/**
 * Helper function to remove $select from URL path in batch requests
 * This is similar to removeSelectFromUrl but handles batch-specific URL formats
 */
function removeSelectFromBatchUrl(urlPath: string): string {
  try {
    // Extract query string if present
    const [path, queryString] = urlPath.split('?');
    
    if (!queryString) {
      return urlPath; // No query parameters to process
    }
    
    // Parse query parameters manually to avoid encoding issues
    const params = queryString.split('&');
    const filteredParams: string[] = [];
    
    for (const param of params) {
      const [key] = param.split('=');
      // Remove $select parameters (case-insensitive)
      if (key.toLowerCase() !== '$select') {
        filteredParams.push(param);
      }
    }
    
    // Rebuild URL
    return filteredParams.length > 0 ? `${path}?${filteredParams.join('&')}` : path;
  } catch (error) {
    console.warn('[OData Recorder] Failed to process batch URL:', urlPath, error);
    return urlPath;
  }
}

/**
 * Removes $select parameters from batch request body
 * @param batchBody - The multipart batch request body
 * @returns Modified batch body with $select parameters removed
 */
export function removeSelectFromBatchBody(batchBody: string): string {
  try {
    // Detect line ending type and split accordingly
    const hasCarriageReturn = batchBody.includes('\r\n');
    const lineEnding = hasCarriageReturn ? '\r\n' : '\n';
    const lines = batchBody.split(lineEnding);
    const modifiedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for HTTP request lines (GET, POST, etc.)
      const httpRequestMatch = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)\s+HTTP\/1\.1$/);
      
      if (httpRequestMatch) {
        const method = httpRequestMatch[1];
        const urlPath = httpRequestMatch[2];
        
        // Remove $select from the URL path using batch-specific processing
        const cleanedUrl = removeSelectFromBatchUrl(urlPath);
        
        // Reconstruct the HTTP request line
        modifiedLines.push(`${method} ${cleanedUrl} HTTP/1.1`);
      } else {
        // Keep other lines unchanged
        modifiedLines.push(line);
      }
    }
    
    return modifiedLines.join(lineEnding);
  } catch (error) {
    console.warn('[OData Recorder] Failed to process batch body for $select removal:', error);
    return batchBody;
  }
}

/**
 * Removes $select parameters from request URL and body if applicable
 * @param url - Request URL
 * @param body - Request body (for batch requests)
 * @param contentType - Content type header
 * @returns Object with modified url and body
 */
export function removeSelectFromRequest(
  url: string, 
  body: string | undefined, 
  contentType: string | undefined
): { url: string; body: string | undefined } {
  // Always clean the URL
  const cleanedUrl = removeSelectFromUrl(url);
  
  // If it's a batch request, also clean the body
  if (body && contentType?.includes('multipart/mixed')) {
    const cleanedBody = removeSelectFromBatchBody(body);
    return { url: cleanedUrl, body: cleanedBody };
  }
  
  return { url: cleanedUrl, body };
}
