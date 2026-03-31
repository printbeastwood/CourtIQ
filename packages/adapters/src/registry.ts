import type { PlatformAdapter } from "@courtiq/shared";
import { PlaytomicAdapter } from "./playtomic/index.js";
import { ReclubAdapter } from "./reclub/index.js";
import { BookAndGoAdapter } from "./book-and-go/index.js";
import { MatchiAdapter } from "./matchi/index.js";
import { PadelMatesAdapter } from "./padel-mates/index.js";
import { PadelSocietyAdapter } from "./padel-society/index.js";

const adapters = new Map<string, PlatformAdapter>();

function register(adapter: PlatformAdapter): void {
  adapters.set(adapter.platform, adapter);
}

register(new PlaytomicAdapter());
register(new ReclubAdapter());
register(new BookAndGoAdapter());
register(new MatchiAdapter());
register(new PadelMatesAdapter());
register(new PadelSocietyAdapter());

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return adapters.get(platform);
}

export function getAllAdapters(): PlatformAdapter[] {
  return Array.from(adapters.values());
}

export function getAdapterPlatforms(): string[] {
  return Array.from(adapters.keys());
}
