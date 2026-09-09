import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Repository hygiene.
 *
 * `backend/.env` shipped with `JWT_SECRET=your-secret-key-here` committed. It was
 * removed from the index once already and the removal did not stick — a
 * `.gitignore` entry has no effect on a path that is already tracked, and
 * `git check-ignore` consults the index by default, so it reported "ignored"
 * while the file was still in every checkout. The claim "untracked and ignored"
 * was verified with a command that could not have detected the failure.
 *
 * These assertions ask the index directly, which is the only source that matters.
 */

const root = path.resolve(__dirname, "..");

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/** Every path currently in the git index. */
const tracked = (): string[] => git("ls-files").split("\n").filter(Boolean);

describe("no secret file is tracked", () => {
  it("no .env is in the index", () => {
    const offenders = tracked().filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".example"));
    expect(
      offenders,
      `these secret files are committed: ${offenders.join(", ")} — a .gitignore entry does not untrack a path already in the index`,
    ).toEqual([]);
  });

  it("no local dev secrets file is in the index", () => {
    const offenders = tracked().filter((f) => /(^|\/)\.dev\.vars$/.test(f));
    expect(offenders).toEqual([]);
  });

  it("the committed templates are still there to copy from", () => {
    // Removing secrets must not remove the documentation of what to set.
    const files = tracked();
    expect(files).toContain(".env.example");
    expect(files).toContain("api/.dev.vars.example");
  });
});

describe("no tracked file contains a live credential", () => {
  it("no committed file carries a secret-looking assignment", () => {
    const files = tracked().filter(
      (f) =>
        !f.endsWith(".png") &&
        !f.endsWith(".lock") &&
        !f.endsWith("package-lock.json") &&
        !f.includes("test/") &&
        !f.includes("api/test/"),
    );

    // Deliberately narrow: a real assignment of a value that looks like a
    // credential. Placeholder text and empty values are fine — the point is to
    // catch a pasted key, not to lint configuration.
    const suspicious = /(?:secret|password|token|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9/+_-]{24,}/i;

    const offenders: string[] = [];
    for (const file of files) {
      let contents: string;
      try {
        contents = git("show", `HEAD:${file}`);
      } catch {
        continue; // staged-but-uncommitted or binary; not this test's concern
      }
      for (const line of contents.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
        // Templates document the variable name with no value.
        if (/[:=]\s*["']?\s*$/.test(trimmed)) continue;
        // Explicit placeholders are the opposite of a credential; check-deploy.mjs
        // names them in order to reject them at deploy time.
        if (/REPLACE_ME|REPLACE_WITH_[A-Z0-9_]+|your-secret-key-here|<[^>]+>/.test(trimmed)) continue;
        if (suspicious.test(trimmed)) offenders.push(`${file}: ${trimmed.slice(0, 80)}`);
      }
    }

    expect(offenders, `possible credentials committed:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("the vulnerable legacy backend is marked as such", () => {
  it("backend/README.md warns against running it", () => {
    // It describes an Express API that accepts negative withdrawals and mints
    // JWTs for unverified identities. Without a banner a reader takes it for a
    // working backend.
    // Read the working tree: reading HEAD would keep passing against a stale
    // commit and could not detect a banner being removed locally.
    const readme = fs.readFileSync(path.join(root, "backend/README.md"), "utf8");
    expect(readme).toMatch(/SUPERSEDED/);
    expect(readme).toMatch(/do not run|DO NOT RUN/i);
  });

  it("nothing in the build or deploy pipeline references backend/", () => {
    // If it were wired in, the vulnerable code would ship.
    for (const file of ["package.json", "vercel.json", "api/package.json", "api/wrangler.toml"]) {
      const contents = git("show", `HEAD:${file}`);
      expect(contents, `${file} references the legacy backend/`).not.toMatch(/["'/]backend\//);
    }
  });
});

describe("gitignore actually covers the secret paths", () => {
  it.each([".env", "api/.dev.vars", "backend/.env", ".env.production"])(
    "%s is ignored",
    (file) => {
      // --no-index checks the patterns alone. Without it, a tracked path reports
      // as not-ignored and a tracked-and-ignored path reports as ignored, which
      // is exactly the confusion that let backend/.env slip back in.
      const out = execFileSync("git", ["check-ignore", "--no-index", file], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      expect(out).toContain(file);
    },
  );

  it("does not ignore the example templates", () => {
    for (const file of [".env.example", "api/.dev.vars.example"]) {
      let ignored = false;
      try {
        execFileSync("git", ["check-ignore", "--no-index", "--quiet", file], {
          cwd: root,
          stdio: "ignore",
        });
        ignored = true;
      } catch {
        ignored = false; // non-zero exit means not ignored, which is what we want
      }
      expect(ignored, `${file} must stay committable`).toBe(false);
    }
  });
});
