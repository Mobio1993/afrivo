import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(__dirname, "../..");
const SUPER_ROOT_ROOT = resolve(__dirname);

function readSource(relativePath) {
  return readFileSync(join(SRC_ROOT, relativePath), "utf8");
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return listFiles(fullPath);
    return [fullPath];
  });
}

test("/super-root/login and /super-root/mfa routes exist", () => {
  const routes = readSource("app/routes/SuperRootRoutes.jsx");

  assert.match(routes, /path="\/super-root\/login"/);
  assert.match(routes, /path="\/super-root\/mfa"/);
});

test("critical maintenance action opens SuperRootConfirmModal", () => {
  const page = readSource("features/super-root/maintenance/SuperRootMaintenancePage.jsx");

  assert.match(page, /SuperRootConfirmModal/);
  assert.match(page, /setConfirmAction/);
  assert.match(page, /requiredPhrase="CONFIRMER"/);
  assert.match(page, /phrase:\s*"CONFIRMER"/);
});

test("Super Root critical actions do not use native window.confirm", () => {
  for (const file of listFiles(SUPER_ROOT_ROOT)) {
    if (file.endsWith("superRootSecurity.test.js")) continue;
    if (!/\.(jsx?|tsx?)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("window.confirm"), false, `${file} must not use window.confirm`);
  }
});
