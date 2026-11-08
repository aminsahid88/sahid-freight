#!/usr/bin/env node
/**
 * `npm run build` for apps/api.
 *
 * Locally (monorepo present) it bundles the API, worker and seed with esbuild, aliasing the
 * shared @tbo/* packages to their sources. In a platform build of an uploaded artifact
 * (`railway up` from apps/api, where dist/ is already built and ../../packages is absent)
 * it leaves the prebuilt bundle alone instead of failing on the missing packages.
 */
const { existsSync, rmSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const root = join(__dirname, "..");
const packages = join(root, "..", "..", "packages");
const dist = join(root, "dist");

if (!existsSync(join(packages, "core", "src", "index.ts"))) {
  if (existsSync(join(dist, "index.js")) && existsSync(join(dist, "worker.js"))) {
    console.log("build: shared packages not present and dist/ is prebuilt; keeping the uploaded bundle.");
    process.exit(0);
  }
  console.error("build: shared packages not present and no prebuilt dist/. Build locally with `npm run build` and upload dist/.");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
const common = [
  "--bundle", "--platform=node", "--target=node20", "--packages=external",
  "--alias:@tbo/core=../../packages/core/src/index.ts",
  "--alias:@tbo/i18n=../../packages/i18n/src/index.ts",
  "--alias:@tbo/extraction=../../packages/extraction/src/index.ts",
  "--log-level=warning",
];
const run = (args) => {
  const r = spawnSync("npx", ["esbuild", ...args], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(["src/index.ts", "src/worker.ts", ...common, "--outdir=dist"]);
run(["prisma/seed.backoffice.ts", ...common, "--outfile=dist/seed.backoffice.js"]);
console.log("build: dist/index.js, dist/worker.js, dist/seed.backoffice.js");
