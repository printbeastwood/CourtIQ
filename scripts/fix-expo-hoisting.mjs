/**
 * Fix npm workspace hoisting for Expo packages.
 *
 * npm hoists expo-* and @react-native-firebase/* packages to root
 * node_modules/, but they peer-depend on `expo` and `@expo/config-plugins`
 * which stay in apps/mobile/node_modules/. This creates broken require()
 * calls during prebuild and Xcode build phases.
 *
 * Solution: symlink missing packages from apps/mobile/node_modules/ into
 * root node_modules/ so hoisted packages can resolve their dependencies.
 */

import {
  existsSync,
  symlinkSync,
  lstatSync,
  unlinkSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mobileModules = resolve(root, "apps/mobile/node_modules");
const rootModules = resolve(root, "node_modules");

if (!existsSync(mobileModules)) {
  process.exit(0);
}

// Packages that hoisted expo/RN plugins need at root.
// react-native is needed by nativewind/react-native-css-interop (hoisted)
// which require react-native/package.json at resolution time.
const packages = [
  "expo",
  "@expo/config-plugins",
  "@expo/config",
  "react-native",
  "react-native-svg",
];

let linked = 0;

for (const pkg of packages) {
  const target = resolve(mobileModules, pkg);
  const link = resolve(rootModules, pkg);

  if (!existsSync(target)) continue;

  // For scoped packages, ensure the scope dir exists
  if (pkg.startsWith("@")) {
    const scopeDir = resolve(rootModules, pkg.split("/")[0]);
    if (!existsSync(scopeDir)) {
      mkdirSync(scopeDir, { recursive: true });
    }
  }

  if (existsSync(link)) {
    const stat = lstatSync(link);
    if (stat.isSymbolicLink()) {
      unlinkSync(link);
    } else {
      continue; // Real directory — leave it alone
    }
  }

  symlinkSync(target, link, "dir");
  linked++;
}

if (linked > 0) {
  console.log(
    `fix-expo-hoisting: linked ${linked} package(s) from apps/mobile/node_modules`
  );
}
