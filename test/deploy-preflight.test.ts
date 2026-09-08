import { execFileSync } from "node:child_process";
import fs from "node:fs";
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
 */

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts/check-deploy.mjs");

const run = (args: string[]): { status: number; out: string } => {
  try {
    const out = execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

let vercelOriginal: string;
let wranglerOriginal: string;

beforeAll(() => {
  vercelOriginal = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
  wranglerOriginal = fs.readFileSync(path.join(root, "api/wrangler.toml"), "utf8");
});

afterAll(() => {
  // Restore, or the working tree is left dirty by the tests themselves.
  fs.writeFileSync(path.join(root, "vercel.json"), vercelOriginal);
  fs.writeFileSync(path.join(root, "api/wrangler.toml"), wranglerOriginal);
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
    const target = path.join(root, "vercel.json");
    fs.writeFileSync(
      target,
      vercelOriginal.replace(
        "affiliate-hub-api.REPLACE_ME.workers.dev",
        "affiliate-hub-api.example.workers.dev",
      ),
    );
    try {
      const { status, out } = run(["vercel"]);
      expect(status).toBe(0);
      expect(out).toContain("clean");
    } finally {
      fs.writeFileSync(target, vercelOriginal);
    }
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
    const target = path.join(root, "api/wrangler.toml");
    fs.writeFileSync(
      target,
      wranglerOriginal
        .replace("REPLACE_WITH_D1_DATABASE_ID", "11111111-2222-3333-4444-555555555555")
        .replace("REPLACE_WITH_KV_NAMESPACE_ID", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
    );
    try {
      const { status } = run(["worker"]);
      expect(status).toBe(0);
    } finally {
      fs.writeFileSync(target, wranglerOriginal);
    }
  });

  it("rejects an unknown target rather than passing silently", () => {
    const { status, out } = run(["nonsense"]);
    expect(status).toBe(2);
    expect(out).toContain("unknown deploy target");
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
    expect(cmd.indexOf("check-deploy.mjs")).toBeLessThan(cmd.indexOf("vite build") === -1 ? cmd.indexOf("npm run build") : cmd.indexOf("vite build"));
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
