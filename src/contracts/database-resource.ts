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
export type DatabasePlanOffer = Readonly<{
  id: string;
  available: boolean;
  supports: readonly string[];
  hourlyToman: number | null;
  monthlyDisplayToman: number | null;
  ramAmount: number | null;
  cpuAmount: number | null;
  volumeAmount: number | null;
}>;
export type DatabaseBundleOffer = Readonly<{
  planId: string;
  bundleId: string;
  available: boolean;
  hourlyToman: number | null;
  monthlyDisplayToman: number | null;
}>;
export type DatabaseCapabilities = DatabaseAccountScope & Readonly<{
  contract: "liara-database-capabilities-v1";
  observedAt: number;
  catalog: "observed" | "unsupported";
  engines: readonly Readonly<{ type: string; versions: readonly string[] }>[];
  plans: readonly DatabasePlanOffer[];
  bundles: readonly DatabaseBundleOffer[];
  defaults: Readonly<Record<string, string>> | null;
  balanceToman: number | null;
  operations: Readonly<{
    inventory: "read_only";
    credentials: "private_binding_only";
    provision: "approval_required";
    migrate: "not_implemented";
    connectivity: "unverified";
  }>;
}>;
export type DatabaseQuote = Readonly<{
  contract: "liara-database-quote-v1";
  observedAt: number;
  type: string;
  version: string;
  planId: string;
  bundleId: string;
  supports: readonly string[];
  planHourlyToman: number | null;
  planMonthlyDisplayToman: number | null;
  bundleHourlyToman: number | null;
  bundleMonthlyDisplayToman: number | null;
  balanceToman: number | null;
  creditCoversPlanBaseHour: boolean | null;
  combinedTotal: "not_computed";
  unit: "toman_per_hour" | null;
  unknown: readonly string[];
}>;

export function databaseAccountScope(value: DatabaseAccountScope): DatabaseAccountScope {
  return { accountId: providerObjectId(value.accountId), teamId: providerObjectId(value.teamId) };
}
