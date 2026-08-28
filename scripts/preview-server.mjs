// Lightweight web preview for this Obsidian vault.
//
// Obsidian is a desktop GUI that cannot run headless in a Cloud Agent VM, so
// this server provides an equivalent way to browse the vault: it lists every
// note, renders Markdown, resolves Obsidian-style [[wikilinks]] to navigable
// links, and shows backlinks for the current note.
import express from "express";
import MarkdownIt from "markdown-it";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const IGNORED_DIRS = new Set(["node_modules", ".obsidian", ".git", "scripts"]);

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

/** Recursively collect every Markdown file, returning vault-relative paths. */
async function collectNotes(dir = VAULT_ROOT, notes = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await collectNotes(path.join(dir, entry.name), notes);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      notes.push(path.relative(VAULT_ROOT, path.join(dir, entry.name)));
    }
  }
  return notes.sort((a, b) => a.localeCompare(b));
}

/** A note's display name is its basename without the .md extension. */
function noteName(relPath) {
  return path.basename(relPath, ".md");
}

/** Map a wikilink target (basename or path) to an actual note relative path. */
function resolveTarget(target, notes) {
  const clean = target.split("#")[0].trim();
  const direct = notes.find((n) => n === clean || n === `${clean}.md`);
  if (direct) return direct;
  const byName = notes.find(
    (n) => noteName(n).toLowerCase() === clean.toLowerCase(),
  );
  return byName || null;
}

// Replace [[wikilinks]] and ![[embeds]] with Markdown links before rendering.
function transformWikilinks(source, notes) {
  return source.replace(
    /(!?)\[\[([^\]]+)\]\]/g,
    (_match, bang, inner) => {
      const [rawTarget, alias] = inner.split("|").map((s) => s.trim());
      const resolved = resolveTarget(rawTarget, notes);
      const label = alias || rawTarget;
      if (!resolved) {
        // Unresolved link, mirror Obsidian's "not created yet" styling.
        return `<span class="wikilink-missing" title="Unresolved link">${label}</span>`;
      }
      const href = `/note/${encodeURIComponent(resolved)}`;
      const prefix = bang ? "&rarr; embed: " : "";
      return `[${prefix}${label}](${href})`;
    },
  );
}

/** Find notes that link to the given note (backlinks). */
async function findBacklinks(targetRel, notes) {
  const targetName = noteName(targetRel).toLowerCase();
  const backlinks = [];
  for (const rel of notes) {
    if (rel === targetRel) continue;
    const content = await readFile(path.join(VAULT_ROOT, rel), "utf8");
    const matches = content.matchAll(/!?\[\[([^\]]+)\]\]/g);
    for (const m of matches) {
      const linkTarget = m[1].split("|")[0].split("#")[0].trim().toLowerCase();
      if (linkTarget === targetName) {
        backlinks.push(rel);
        break;
      }
    }
  }
  return backlinks;
}

function layout({ title, sidebar, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Vault Preview</title>
<style>
  :root { color-scheme: light dark; --accent: #7c6cf0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; min-height: 100vh; background: #1e1e24; color: #e6e6ea; }
  aside { width: 280px; flex-shrink: 0; background: #16161a; border-right: 1px solid #2a2a33; padding: 20px; overflow-y: auto; }
  aside h1 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color: #9a9aa8; margin: 0 0 16px; }
  aside ul { list-style: none; margin: 0; padding: 0; }
  aside li { margin: 2px 0; }
  aside a { display: block; padding: 6px 10px; border-radius: 6px; color: #cfcfe0; text-decoration: none; font-size: 14px; }
  aside a:hover { background: #24242e; }
  aside a.active { background: var(--accent); color: white; }
  main { flex: 1; padding: 40px 56px; max-width: 860px; overflow-y: auto; }
  main h1, main h2, main h3 { line-height: 1.25; }
  main a { color: var(--accent); }
  .wikilink-missing { color: #e0708a; border-bottom: 1px dashed #e0708a; }
  .backlinks { margin-top: 48px; padding-top: 20px; border-top: 1px solid #2a2a33; }
  .backlinks h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #9a9aa8; }
  .empty { color: #7a7a88; font-style: italic; }
  code { background: #2a2a33; padding: 2px 5px; border-radius: 4px; }
  pre { background: #16161a; padding: 16px; border-radius: 8px; overflow-x: auto; }
</style>
</head>
<body>
<aside>
  <h1>Vault (${sidebar.count} notes)</h1>
  <ul>${sidebar.items}</ul>
</aside>
<main>${body}</main>
</body>
</html>`;
}

const app = express();

app.get("/", async (_req, res) => {
  const notes = await collectNotes();
  res.redirect(notes.length ? `/note/${encodeURIComponent(notes[0])}` : "/empty");
});

app.get("/empty", async (_req, res) => {
  res.send(
    layout({
      title: "Empty vault",
      sidebar: { count: 0, items: "" },
      body: "<h1>Empty vault</h1><p class='empty'>No Markdown notes found.</p>",
    }),
  );
});

app.get("/note/:rel(*)", async (req, res) => {
  const notes = await collectNotes();
  const rel = decodeURIComponent(req.params.rel);
  const abs = path.join(VAULT_ROOT, rel);

  // Guard against path traversal outside the vault.
  if (!abs.startsWith(VAULT_ROOT) || !notes.includes(rel)) {
    res.status(404).send(
      layout({
        title: "Not found",
        sidebar: {
          count: notes.length,
          items: notes
            .map(
              (n) =>
                `<li><a href="/note/${encodeURIComponent(n)}">${noteName(n)}</a></li>`,
            )
            .join(""),
        },
        body: `<h1>Note not found</h1><p class='empty'>${rel}</p>`,
      }),
    );
    return;
  }

  const raw = await readFile(abs, "utf8");
  const rendered = md.render(transformWikilinks(raw, notes));
  const backlinks = await findBacklinks(rel, notes);

  const sidebarItems = notes
    .map((n) => {
      const active = n === rel ? " class=\"active\"" : "";
      return `<li><a${active} href="/note/${encodeURIComponent(n)}">${noteName(n)}</a></li>`;
    })
    .join("");

  const backlinkHtml = backlinks.length
    ? `<ul>${backlinks
        .map(
          (b) =>
            `<li><a href="/note/${encodeURIComponent(b)}">${noteName(b)}</a></li>`,
        )
        .join("")}</ul>`
    : "<p class='empty'>No backlinks.</p>";

  const body = `
    <article>${rendered || "<p class='empty'>(empty note)</p>"}</article>
    <section class="backlinks">
      <h2>Backlinks</h2>
      ${backlinkHtml}
    </section>`;

  res.send(
    layout({
      title: noteName(rel),
      sidebar: { count: notes.length, items: sidebarItems },
      body,
    }),
  );
});

// Simple JSON health/inventory endpoint, handy for automated checks.
app.get("/api/notes", async (_req, res) => {
  const notes = await collectNotes();
  res.json({ count: notes.length, notes });
});

app.listen(PORT, HOST, () => {
  console.log(`Vault preview server running at http://${HOST}:${PORT}`);
  console.log(`Serving vault from ${VAULT_ROOT}`);
});
