import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(resolve(root, p), "utf8");
const html = read("examples/example/index.html");

test("landing guide is useful without JavaScript and matches typechecked examples", () => {
  execFileSync(
    process.execPath,
    ["scripts/sync-pages-examples.mjs", "--check"],
    { cwd: root },
  );
  for (const method of [
    "create",
    "attach",
    "configure",
    "subscribe",
    "getConfig",
    "destroy",
  ]) {
    assert.ok(html.includes(`.${method}(`), `documented method ${method}`);
  }
  for (const id of [
    "features",
    "architecture",
    "integration",
    "quickstart",
    "configure",
    "existing-app",
    "service-worker",
    "disable",
    "try",
  ])
    assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /npm install @youge\/assistant-sdk/);
  assert.match(html, /SDK 0\.4\.1/);
  assert.doesNotMatch(html, /Progressier|Register a project|not yet published/);
});

test("landing anchors, asset paths and source documentation links resolve", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith("#")) assert.ok(ids.has(href.slice(1)), href);
    if (
      href.includes("github.com/sandro-defender/you-ge-assistant/blob/main/")
    ) {
      assert.ok(existsSync(resolve(root, href.split("/blob/main/")[1])), href);
    }
  }
  assert.ok(existsSync(resolve(root, "examples/example/workspace.html")));
  assert.ok(existsSync(resolve(root, "examples/example/launcher-demo.html")));
  assert.match(
    read("examples/example/vite.config.js"),
    /launcherDemo: path.join\(exampleRoot, 'launcher-demo.html'\)/,
  );
});

test("live demo delegates to the SDK and never registers or replaces a worker", () => {
  const source = read("examples/example/src/landing.ts");
  assert.match(source, /YouGeAssistant.attach\(\)/);
  assert.match(source, /assistant.subscribe\(render\)/);
  assert.match(source, /assistant.configure\(\{ theme: theme.value \}\)/);
  assert.doesNotMatch(
    source,
    /serviceWorker\.(register|unregister)|caches\.delete|setInterval/,
  );
  assert.match(html, /<script src="assistant-widget.js" defer/);
  // Opt-in is explained as escaped code, not silently enabled on this site.
  const pwaTag = html.match(/<script[\s\S]*?src="pwa.js"[\s\S]*?>/)?.[0] || "";
  assert.doesNotMatch(pwaTag, /data-assistant-worker/);
});

test("assembled Pages links and assets work under the project base path", (t) => {
  // Assembly is required by CI before its validation stage and exercised by existing checks.
  // Build in the same order as Pages: independent Vite first, root assembly second.
  if (!existsSync(resolve(root, "examples/example/dist/index.html"))) {
    t.skip("Build the Vite example first (CI ordering)");
    return;
  }
  const site = mkdtempSync(join(tmpdir(), "youge-landing-"));
  t.after(() => rmSync(site, { recursive: true, force: true }));
  execFileSync(
    process.execPath,
    ["scripts/assemble-pages.mjs", "--out", site],
    { cwd: root },
  );
  for (const page of [
    "index.html",
    "demo/index.html",
    "example/index.html",
    "example/workspace.html",
    "example/launcher-demo.html",
    "sdk-demo/index.html",
    "config-playground/index.html",
  ]) {
    const source = readFileSync(resolve(site, page), "utf8");
    for (const [, url] of source.matchAll(
      /<(?:script|link|a|img)\b[^>]*?\b(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g,
    )) {
      if (/^(https?:|data:)/.test(url)) continue;
      assert.ok(!url.startsWith("/"), `${page}: root-absolute ${url}`);
      const path = resolve(site, dirname(page), decodeURIComponent(url));
      assert.ok(existsSync(path), `${page}: missing ${url}`);
    }

    for (const [, href] of source.matchAll(/<a\b[^>]*?href="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const url = new URL(
        href,
        `https://pages.invalid/you-ge-assistant/${page}`,
      );
      assert.ok(url.pathname.startsWith("/you-ge-assistant/"), href);
      let target = resolve(
        site,
        decodeURIComponent(url.pathname.slice("/you-ge-assistant/".length)),
      );
      if (url.pathname.endsWith("/")) target = join(target, "index.html");
      if (url.hash && target.endsWith(".html")) {
        const destination = readFileSync(target, "utf8");
        // SDK demo sections are rendered at runtime from main.ts.
        const anchorSource = target.endsWith("sdk-demo/index.html")
          ? read("examples/sdk-demo/src/main.ts")
          : destination;
        assert.ok(
          anchorSource.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          `${page}: broken anchor ${href}`,
        );
      }
    }
  }
  assert.match(
    readFileSync(resolve(site, "example/index.html"), "utf8"),
    /href="\.\/manifest.webmanifest"/,
  );
});

test("every product page uses shared identity and progressive mobile navigation", () => {
  for (const path of [
    "examples/demo/index.html",
    "examples/example/index.html",
    "examples/example/workspace.html",
    "examples/landing/index.html",
    "examples/config-playground/index.html",
  ]) {
    const source = read(path);
    for (const attribute of [
      "data-product-header",
      "data-menu-toggle",
      'aria-expanded="false"',
      'aria-controls="product-navigation"',
    ])
      assert.ok(source.includes(attribute), `${path}: ${attribute}`);
    for (const file of ["product.css", "product.js", "assistant-symbol.svg"])
      assert.ok(source.includes(file));
  }
  const navigation = read("examples/example/public/product.js");
  assert.match(navigation, /Escape/);
  assert.match(navigation, /button.focus\(\)/);
  assert.match(
    read("examples/example/public/product.css"),
    /prefers-reduced-motion/,
  );
});
