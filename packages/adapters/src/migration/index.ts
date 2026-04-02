import type { MigrationAdapter } from "@courtiq/shared";
import type { MigrationPlatform } from "@courtiq/shared";
import { PlaytomicMigrationAdapter } from "./playtomic.js";
import { MatchiMigrationAdapter } from "./matchi.js";
import { ReclubMigrationAdapter } from "./reclub.js";
import { PadelMatesMigrationAdapter } from "./padel-mates.js";

export { PlaytomicMigrationAdapter } from "./playtomic.js";
export { MatchiMigrationAdapter } from "./matchi.js";
export { ReclubMigrationAdapter } from "./reclub.js";
export { PadelMatesMigrationAdapter } from "./padel-mates.js";

const migrationAdapters = new Map<string, MigrationAdapter>();

migrationAdapters.set("playtomic", new PlaytomicMigrationAdapter());
migrationAdapters.set("matchi", new MatchiMigrationAdapter());
migrationAdapters.set("reclub", new ReclubMigrationAdapter());
migrationAdapters.set("padel_mates", new PadelMatesMigrationAdapter());

export function getMigrationAdapter(platform: MigrationPlatform): MigrationAdapter | undefined {
  return migrationAdapters.get(platform);
}

export function getSupportedMigrationPlatforms(): MigrationPlatform[] {
  return Array.from(migrationAdapters.keys()) as MigrationPlatform[];
}
