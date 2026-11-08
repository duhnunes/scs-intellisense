# Translating the docs

The user docs at [scs-intellisense.vercel.app](https://scs-intellisense.vercel.app/docs)
are written in English in [`apps/web/docs/`](../docs). Each translation lives
here, in a folder named after its language, with the same files at the same
paths:

```text
apps/web/docs/02-features/formatter.mdx            English (the original)
apps/web/locale/pt-br/docs/02-features/formatter.mdx   Brazilian Portuguese
```

You don't need to translate everything at once. A page with no translation
shows the English page, with a note saying so, so a partial translation is
already useful.

## Translate a page

1. Copy the English page to the same path under `locale/<language>/docs/`.
2. Translate `title` and `description` in the frontmatter (between the `---`
   lines). Keep `order` as it is.
3. Translate the text, headings, table cells and callout titles.

Keep these as they are in English:

- **Code blocks, file paths, class and attribute names.** They are what the
  game and the files use.
- **What the reader sees on screen in VS Code**: menu items, command names
  (**SCS IntelliSense: Show Output**), settings, buttons. The reader looks for
  those exact words.
- **Links**: the path stays the same (`../02-features/formatter.mdx`). Only the
  part after `#` changes, because it is made from the heading, and the heading
  is now translated: `#format-a-file` becomes `#formatar-um-arquivo` in
  Portuguese (lowercase, spaces become `-`, accents stay).

The [Brazilian Portuguese pages](./pt-br/docs) are a complete example.

## Translate the homepage

The homepage's translations live in `locale/<language>/home.json`: each
English phrase, exactly as written in
[`components/home.tsx`](../components/home.tsx) inside `t('...')`, followed by
its translation. Copy [`pt-br/home.json`](./pt-br/home.json) and replace the
Portuguese. `$metadata` holds the page title and description shown in search
results and link previews.

```json
{
  "Built for SCS modding.": "Feito para mods da SCS."
}
```

A phrase you leave out shows in English, so a partial translation works. Keep
the English side exactly as it is: if it doesn't match the page, the
translation isn't used. `pnpm build` lists, per language, the phrases still
missing and the ones whose English changed or no longer exists. The code
examples and the extension's messages on the page stay in English, as the
extension shows them.

## Add a new language

1. Create `locale/<tag>/docs/`, where `<tag>` is the language tag in lowercase:
   `es-es`, `de`, `fr`.
2. Add the language to `locales` in [`rdx.config.ts`](../rdx.config.ts):

   ```ts
   { code: 'es-ES', label: 'Español' },
   ```

   Until it is there, the site doesn't show the language, even with the pages
   in place.

## Check your work

From `apps/web` (see the [contributing guide](../../../CONTRIBUTING.md#setting-up)
to set up the repository):

```bash
pnpm build
```

It checks every page and link in every language and lists any broken one. To
read the pages as you write, run `pnpm dev`, open the address it prints and
add `/<tag>/docs` to it.

Then open a pull request. The commit message is `docs: translate ... to <language>`.

## When the English page changes

A translation doesn't update itself. When an English page changes, its
translations need the same change; a pull request that changes an English page
updates the translations it can and says which ones it couldn't.
