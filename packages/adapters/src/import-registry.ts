import type { PlayerImportAdapter, ImportPlatform } from "@courtiq/shared";
import { PlaytomicImportAdapter } from "./playtomic/import.js";
import { MatchiImportAdapter } from "./matchi/import.js";
import { ReclubImportAdapter } from "./reclub/import.js";
import { PadelMatesImportAdapter } from "./padel-mates/import.js";

const importAdapters = new Map<ImportPlatform, PlayerImportAdapter>();

function registerImport(adapter: PlayerImportAdapter): void {
  importAdapters.set(adapter.platform, adapter);
}

registerImport(new PlaytomicImportAdapter());
registerImport(new MatchiImportAdapter());
registerImport(new ReclubImportAdapter());
registerImport(new PadelMatesImportAdapter());

export function getImportAdapter(platform: ImportPlatform): PlayerImportAdapter | undefined {
  return importAdapters.get(platform);
}

export function getAllImportAdapters(): PlayerImportAdapter[] {
  return Array.from(importAdapters.values());
}

export function getImportPlatforms(): ImportPlatform[] {
  return Array.from(importAdapters.keys());
}
