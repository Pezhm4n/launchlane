import { providerObjectId } from "./provision.ts";

export type DatabaseAccountScope = Readonly<{ accountId: string; teamId: string }>;
export type DatabaseResourceIdentity = DatabaseAccountScope & Readonly<{ databaseId: string }>;
export type DatabaseInventoryResource = Readonly<{
  id: string;
  hostname: string;
  type: string;
  scale: number | null;
  status: string | null;
  planId: string | null;
  bundleId: string | null;
  createdAt: string | null;
  // Create arguments do not establish the shape or truth of inventory readback.
  version: null;
  networkId: null;
  publicNetwork: null;
  dataAccess: "unverified";
}>;
export type DatabaseInventoryCoverage = Readonly<{
  pagination: "undocumented";
  completeness: "unknown";
  observedCount: number;
  limit: 1000;
}>;
export type DatabaseInventory = DatabaseAccountScope & Readonly<{
  contract: "liara-database-inventory-v1";
  observedAt: number;
  databases: readonly DatabaseInventoryResource[];
  coverage: DatabaseInventoryCoverage;
}>;
export type DatabaseLookup = DatabaseAccountScope & Readonly<{
  observedAt: number;
  outcome: "observed" | "not_observed";
  resource: DatabaseInventoryResource | null;
  coverage: DatabaseInventoryCoverage;
}>;
export type DatabaseCapabilities = DatabaseAccountScope & Readonly<{
  contract: "liara-database-capabilities-v1";
  observedAt: number;
  catalog: "observed" | "unsupported";
  engines: readonly Readonly<{ type: string; versions: readonly string[] }>[];
  plans: readonly Readonly<{ id: string; available: boolean; supports: readonly string[] }>[];
  operations: Readonly<{
    inventory: "read_only";
    credentials: "unsupported";
    provision: "not_implemented";
    migrate: "not_implemented";
    connectivity: "unverified";
  }>;
}>;

export function databaseAccountScope(value: DatabaseAccountScope): DatabaseAccountScope {
  return { accountId: providerObjectId(value.accountId), teamId: providerObjectId(value.teamId) };
}
