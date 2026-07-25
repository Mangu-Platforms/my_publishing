# Pre-Flight Book Production Tool (vendored)

A standalone **Vite + React 19 + React Router** dashboard, generated separately from
the MANGU Publishers Next.js site. It has its own `package.json`, `tsconfig*.json`,
`tailwind.config.js`, `postcss.config.js`, and `eslint.config.js`.

## Why it moved

It was originally committed into `app/` — the Next.js App Router directory — by the
bulk upload in `5da2289`. That placement broke the main site's toolchain:

- `tsconfig.json` includes `**/*.ts{,x}`, so `npm run type-check` and `next build`
  compiled these files against the **root** dependency tree. They import packages
  the root project does not install (`react-router-dom`, `vite`, `cmdk`, `vaul`,
  `embla-carousel-react`, and ~15 `@radix-ui/*` packages), producing **120+
  `error TS2307` / `TS7006` failures** and a red `type-check` job.
- A nested `package.json` and three nested `tsconfig` files inside the App Router
  directory are a hazard for Next.js resolution and for anyone reading the tree.

Moving it to `tools/` matches the layout documented in `AGENTS.md`
(`tools/` = dev tooling) and takes it out of both the route tree and the root
TypeScript project. `tsconfig.json` excludes `tools/preflight-dashboard`, and
`.prettierignore` skips it so the root formatter does not rewrite vendored code.

Nothing was deleted; the move is a `git mv`, so history is intact.

## Running it

It is not wired into the main app's `npm` scripts and does not deploy with it.

```bash
cd tools/preflight-dashboard
npm install
npm run dev
```

Note it targets React 19 while the main site is on React 18 — another reason the two
dependency trees must stay separate.
