/**
 * Builds the static bundle GitHub Pages serves.
 *
 * `output: "export"` refuses to build alongside API route handlers or
 * middleware, both of which need a server. Rather than delete them from the
 * repository, this copies the project into a scratch directory, removes the
 * server-only pieces there, builds, and copies `out/` back.
 */
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = process.cwd();
const work = join(root, ".static-build");
const out = join(root, "out");

rmSync(work, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

for (const entry of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "next-env.d.ts"]) {
  const from = join(root, entry);
  if (existsSync(from)) cpSync(from, join(work, entry), { recursive: true });
}

// Reuse the installed dependencies instead of a second npm install.
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

// The server-only pieces cannot exist in a static export.
rmSync(join(work, "src/app/api"), { recursive: true, force: true });
rmSync(join(work, "src/middleware.ts"), { force: true });

execFileSync("node_modules/.bin/next", ["build"], {
  cwd: work,
  stdio: "inherit",
  env: {
    ...process.env,
    STATIC_EXPORT: "1",
    // Baked into the client bundle: tells the app it has no server to call.
    NEXT_PUBLIC_STATIC_DEMO: "1",
  },
});

cpSync(join(work, "out"), out, { recursive: true });

// Without this, Pages runs Jekyll, which ignores directories starting with an
// underscore -- and every Next.js asset lives under _next.
writeFileSync(join(out, ".nojekyll"), "");

rmSync(work, { recursive: true, force: true });
console.log(`\nStatic bundle written to ${resolve(out)}`);
