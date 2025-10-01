/**
 * Type definitions for the OData recorder middleware
 */

// Middleware service config
export type ServiceConfig = {
  alias: string;                 // e.g., "ODATA_HU_SRV"
  version: "v2" | "v4";
  basePath: string;              // e.g., "/sap/opu/odata/tgw/ODATA_HU_SRV/"
  targetDir: string;             // "webapp/localService/<ALIAS>/data"
};

export type RecorderConfig = {
  controlEndpoints: boolean;
  autoSave: "onStop" | "stream";
  writeMetadata: boolean;
  defaultTenant: string;
  redact?: string[];
  services: ServiceConfig[];
};

// Middleware runtime state
export type BufferKey = `${string}|${string}|${string}`; // alias|tenant|entitySet

export interface RecorderRuntime {
  active: boolean;
  tenant: string;
  mode: "onStop" | "stream";
  buffers: Map<BufferKey, any[]>;
  entityKeys: Map<string, string[]>; // `${alias}:${entityType}` -> ["ID", ...]
  metadataCache: Map<string, string>; // alias -> metadata XML
}

export interface EntitySetInfo {
  alias: string;
  tenant: string;
  entitySet: string;
  entityType?: string;
}

export interface ODataResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  isMetadata: boolean;
  isBatch: boolean;
}

export interface BatchItem {
  url: string;
  body: string;
  statusCode: number;
}
