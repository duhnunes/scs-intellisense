# web

This documentation site was created with RDX.

Requires Node.js 22.18+ (22.x) or 24.11+ (24.x). Use the latest patch of either line.

## Development

Use the same package manager that installed the project:

```bash
pnpm dev
# npm alternative: npm run dev
# Yarn alternative: yarn dev
```

Edit files in `docs/` to create your documentation. RDX creates and maintains
its internal runtime in `.rdx/`.
If installation failed during creation, keep these files, fix the reported error
and retry `pnpm install` (or `npm install` / `yarn install`) before starting.

## Updating RDX

Update the framework with `pnpm add @lexibase/rdx@latest` (or `npm install`
/ `yarn add` with the same package). Review release notes for migrations, restart
development, and rebuild production. Optional plugins are updated separately.

## Optional versioning

```bash
pnpm rdx add versioning
pnpm rdx version 1.0.0
```

The first command installs the official plugin, activates it in `rdx.config.ts`
and prepares the runtime. It preserves existing options and validates the
configuration before saving it, without creating backup files. Restart `pnpm dev` afterward. Repeated
activation does not duplicate the plugin or upgrade its installed version.
If the configuration is too dynamic to edit safely, follow the manual
instructions printed by the CLI. Installing a package alone does not activate it.

## Public files

Put images and downloads in the project-root `public/` folder:

```text
public/images/rdx.svg        → /images/rdx.svg
public/downloads/example.txt → /downloads/example.txt
```

Use site-root URLs in MDX:

```md
![RDX logo](/images/rdx.svg)

[Download](/downloads/example.txt)
```

See `docs/examples/images.mdx` for a working example. Do not include `/public`
in URLs and do not store private files or credentials in this directory.

RDX connects `.rdx/public` to this folder automatically. Keep your files in
`public/`; `.rdx/` is generated. All documentation versions share public files;
use version-specific filenames if snapshots need to retain their original assets.

For production, run `pnpm build` and `pnpm start`. Restart/redeploy the site after
adding or removing public files in production. Deploy `public/` with the project,
not just `.rdx/`. If the filesystem does not support directory links, RDX reports
an error without deleting the original assets.
