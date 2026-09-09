import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Deployment preflight.
 *
 * `vercel.json` cannot read environment variables — Vercel substitutes them in
 * code only, never in config — so the `/api/*` rewrite destination is a literal
 * URL in the committed file. Until a real Worker URL is filled in it points at
 * `affiliate-hub-api.REPLACE_ME.workers.dev`, which builds green, deploys green,
 * and then fails every API call in the browser.
 *
 * The preflight turns that into a build failure. These tests keep the guard
 * honest: a preflight that stops matching its own tokens would report success
 * while shipping exactly the breakage it exists to prevent.
 *
 * The "filled in" cases run against a scratch copy of the repo via
 * DEPLOY_CHECK_ROOT. The first version of this file rewrote `vercel.json` and
 * `api/wrangler.toml` in place and restored them afterwards, which worked in
 * isolation — but `wrangler dev` watches `wrangler.toml`, so running the suite
 * reloaded and then killed the dev server. A test must not mutate tracked files
 * that a live process depends on, however briefly.
 */

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts/check-deploy.mjs");

const vercelOriginal = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const wranglerOriginal = fs.readFileSync(path.join(root, "api/wrangler.toml"), "utf8");

/** Scratch tree the check can be pointed at without touching the repo. */
let scratch: string;

const writeScratch = (vercel: string, wrangler: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-check-"));
  fs.writeFileSync(path.join(dir, "vercel.json"), vercel);
  fs.mkdirSync(path.join(dir, "api"), { recursive: true });
  fs.writeFileSync(path.join(dir, "api/wrangler.toml"), wrangler);
  return dir;
};

const run = (args: string[], cwdRoot?: string): { status: number; out: string } => {
  try {
    const out = execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(cwdRoot ? { DEPLOY_CHECK_ROOT: cwdRoot } : {}) },
    });
    return { status: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

const cleanups: string[] = [];

beforeAll(() => {
  scratch = writeScratch(vercelOriginal, wranglerOriginal);
  cleanups.push(scratch);
});

afterAll(() => {
  for (const dir of cleanups) fs.rmSync(dir, { recursive: true, force: true });
});

describe("deploy preflight", () => {
  it("fails on the vercel target while REPLACE_ME is in vercel.json", () => {
    // The repository ships with the placeholder unfilled — that is the state
    // this guard exists for, so it must be the state that fails.
    expect(vercelOriginal).toContain("REPLACE_ME");

    const { status, out } = run(["vercel"]);
    expect(status).toBe(1);
    expect(out).toContain("Deploy preflight FAILED");
    expect(out).toContain("REPLACE_ME");
    // The message has to name the line, or it is not actionable.
    expect(out).toMatch(/line \d+:/);
  });

  it("passes on the vercel target once the worker url is filled in", () => {
    const dir = writeScratch(
      vercelOriginal.replace(
        "affiliate-hub-api.REPLACE_ME.workers.dev",
        "affiliate-hub-api.example.workers.dev",
      ),
      wranglerOriginal,
    );
    cleanups.push(dir);

    const { status, out } = run(["vercel"], dir);
    expect(status).toBe(0);
    expect(out).toContain("clean");
  });

  it("fails on the worker target for unfilled cloudflare ids", () => {
    expect(wranglerOriginal).toContain("REPLACE_WITH_D1_DATABASE_ID");

    const { status, out } = run(["worker"]);
    expect(status).toBe(1);
    // Token names must be reported whole: an earlier character class omitted
    // digits and reported "REPLACE_WITH_D", which is not in the file.
    expect(out).toContain("REPLACE_WITH_D1_DATABASE_ID");
  });

  it("reports tokens intact, not truncated at the first digit", () => {
    const { out } = run(["worker"]);
    expect(out).not.toMatch(/REPLACE_WITH_D\n/);
    expect(out).not.toContain("REPLACE_WITH_D1\n");
  });

  it("passes on the worker target once both ids are filled in", () => {
    const dir = writeScratch(
      vercelOriginal,
      wranglerOriginal
        .replace("REPLACE_WITH_D1_DATABASE_ID", "11111111-2222-3333-4444-555555555555")
        .replace("REPLACE_WITH_KV_NAMESPACE_ID", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
    );
    cleanups.push(dir);

    const { status } = run(["worker"], dir);
    expect(status).toBe(0);
  });

  it("rejects an unknown target rather than passing silently", () => {
    const { status, out } = run(["nonsense"]);
    expect(status).toBe(2);
    expect(out).toContain("unknown deploy target");
  });

  it("fails when a checked file is missing rather than passing vacuously", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-check-empty-"));
    cleanups.push(dir);

    const { status, out } = run(["vercel"], dir);
    expect(status).toBe(2);
    expect(out).toContain("file not found");
  });
});

describe("the tests never mutate tracked files", () => {
  it("vercel.json and wrangler.toml are byte-identical after the suite", () => {
    // This is the regression that killed the dev server: the earlier version
    // rewrote both files in place, and `wrangler dev` reloads on any change to
    // wrangler.toml. Asserting on the contents catches it if it comes back.
    expect(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).toBe(vercelOriginal);
    expect(fs.readFileSync(path.join(root, "api/wrangler.toml"), "utf8")).toBe(wranglerOriginal);
  });
});

describe("the preflight is actually wired into the vercel build", () => {
  it("vercel.json buildCommand reaches the preflight", () => {
    // A guard that is not wired into the build command never runs on Vercel.
    // The indirection matters: vercel.json names an npm script, and that script
    // is what actually invokes the check, so both links have to hold.
    const config = JSON.parse(vercelOriginal) as { buildCommand?: string };
    const scriptName = config.buildCommand?.replace(/^npm run /, "") ?? "";
    expect(scriptName, "vercel.json must run a named build script").toBe("build:vercel");

    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts[scriptName]).toContain("check-deploy.mjs vercel");
    // The preflight must run *before* the build, or a broken config still ships.
    const cmd = pkg.scripts[scriptName];
    const checkAt = cmd.indexOf("check-deploy.mjs");
    const buildAt = cmd.indexOf("npm run build");
    expect(checkAt).toBeGreaterThanOrEqual(0);
    expect(buildAt).toBeGreaterThan(checkAt);
    expect(cmd).toContain("&&");
  });

  it("package.json exposes build:vercel and check:deploy", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build:vercel"]).toContain("check-deploy.mjs vercel");
    expect(pkg.scripts["build:vercel"]).toContain("npm run build");
    expect(pkg.scripts["check:deploy"]).toContain("check-deploy.mjs");
  });

  it("the plain local build does not require real cloud ids", () => {
    // Otherwise `npm run verify` would fail for anyone without a Cloudflare
    // account, which would push people to delete the check.
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).not.toContain("check-deploy.mjs");
  });
});
