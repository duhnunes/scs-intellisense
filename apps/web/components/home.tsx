import type { RdxHomepageProps } from '@lexibase/rdx'
import type { ReactNode } from 'react'

import { Logo } from './logo'
import { ScreenshotGallery, type ShotText } from './screenshot-gallery'
import { SiiSnippet } from './sii-snippet'
import { Video } from './video'

// The landing page at "/" (homepage.component in rdx.config.ts). The layout
// lives here; each language passes its own HomeText: English below, others in
// locale/<folder>/home.tsx (RDX 5.2: served at /<locale>). Every example on it
// is real: game files from ATS 1.61, the extension's own messages and hover
// text. Those stay in English in every language, as the extension shows them.

const MARKETPLACE =
  'https://marketplace.visualstudio.com/items?itemName=DuHNunes.scs-intellisense'
const GITHUB = 'https://github.com/duhnunes/scs-intellisense'
const VIDEO_ID = 'keAtViyStMg'

/** Lucide-style outline icon; `d` holds the path data. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-6 shrink-0 text-(--rdx-highlighting)"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  palette: (
    <Icon>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </Icon>
  ),
  warning: (
    <Icon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  info: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  ),
  file: (
    <Icon>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </Icon>
  ),
  move: (
    <Icon>
      <path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z" />
      <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z" />
      <path d="M3 5a2 2 0 0 0 2 2h3" />
      <path d="M3 3v13a2 2 0 0 0 2 2h3" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </Icon>
  ),
  external: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  github: (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  ),
}

/** Every piece of text on the page that a translation changes. */
export type HomeText = {
  tagline: string
  subtitle: string
  install: string
  readDocs: string
  playVideo: string
  featuresTitle: string
  highlighting: { title: string; text: string }
  diagnostics: { title: string; text: string }
  hover: { title: string; text: string }
  experimental: string
  icons: { title: string; text: string; treeLabel: string }
  paths: { title: string; text: string }
  more: { title: string; text: string; items: string[]; link: string }
  screenshotsTitle: string
  screenshotsLabel: string
  shots: ShotText
  ctaTitle: string
  ctaText: string
  ctaButton: string
  footerText: string
  footerLabel: string
  footerDocs: string
}

const EN: HomeText = {
  tagline: 'A modern development experience for SCS Software modding.',
  subtitle:
    'A free VS Code extension for American Truck Simulator and Euro Truck Simulator 2 mods.',
  install: 'Install for VS Code',
  readDocs: 'Read the docs',
  playVideo: 'Play video',
  featuresTitle: 'Built for SCS modding.',
  highlighting: {
    title: 'Semantic Highlighting',
    text: 'Classes, keys, values and paths, each in its own color.',
  },
  diagnostics: {
    title: 'Diagnostics',
    text: 'Mistakes are flagged as you type, before the game finds them.',
  },
  hover: {
    title: 'Hover Info',
    text: "An attribute's type and what it does, without leaving the editor.",
  },
  experimental: 'Experimental',
  icons: {
    title: 'File Icons',
    text: 'Models, materials, textures and sound banks: recognized at a glance.',
    treeLabel: "A mod's files with their icons",
  },
  paths: {
    title: 'Paths Follow Your Files',
    text: 'Rename or move a file in VS Code, and every path to it is updated.',
  },
  more: {
    title: 'And More',
    text: 'Everything a modder reaches for, in one extension.',
    items: [
      'Completion for classes, attributes, values and paths (experimental)',
      'Go to Definition, Find References and Rename',
      'Quick fixes for common mistakes',
      'A formatter that never changes your content (experimental)',
      'Outline and breadcrumbs for every unit',
    ],
    link: 'See every feature →',
  },
  screenshotsTitle: 'SCS files, with a little more intelligence.',
  screenshotsLabel: 'Screenshots',
  shots: {
    hover: {
      label: 'Hover',
      caption:
        'Point at a class to see the class it extends, or at an attribute to see its type.',
    },
    quickFix: {
      label: 'Quick fix',
      caption:
        'A misspelled attribute is flagged as you type, with the fix one click away.',
    },
    completion: {
      label: 'Completion',
      caption: "Suggestions for the unit's own attributes, with their types.",
    },
    ctrlClick: {
      label: 'Ctrl+click',
      caption:
        'Ctrl+click a path to open the file, or a unit name to go to where it is defined.',
    },
    include: {
      label: '@include',
      caption: 'Completion lists the folders and .sui files you can include.',
    },
    moving: {
      label: 'Moving files',
      caption:
        'Rename or move a file, and every path to it is updated and marked for review.',
    },
  },
  ctaTitle: 'Ready to mod with more?',
  ctaText: 'Get SCS IntelliSense for VS Code.',
  ctaButton: 'Install Extension',
  footerText: 'Modern tools for SCS Software modding.',
  footerLabel: 'Footer',
  footerDocs: 'Docs',
}

function Card({
  icon,
  title,
  text,
  badge,
  children,
}: {
  icon: ReactNode
  title: string
  text: string
  badge?: string
  children: ReactNode
}) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex gap-3">
        {icon}
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {title}
            {badge && (
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                {badge}
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      <div>{children}</div>
    </article>
  )
}

/** A VS Code-like hover or problem popup, under a line of a snippet. */
function Popup({ children }: { children: ReactNode }) {
  return <span className="sii-popup">{children}</span>
}

const HIGHLIGHT = `SiiNunit
{
accessory_engine_data : dd13_370.freightliner.cascadia2019.engine
{
	price: 37650
	part_type: factory
	torque_curve[]: (975, 1.0)
@include "sound.sui"
}
}`

const DIAGNOSTIC = `animated_gate : anim_gate4r
{
	collsion: "/model/props/street/tollgate04_right_anim.pmc"
	trigger_distance: 5
}`

const HOVER = `accessory_engine_data : dd13_370.freightliner.cascadia2019.engine
{
	price: 37650
	unlock: 0
}`

const FILES: [icon: string, name: string, depth: number][] = [
  ['folder', 'my_mod', 0],
  ['sii', 'manifest.sii', 1],
  ['folder', 'def', 1],
  ['sii', 'dd13_370.sii', 2],
  ['sui', 'sound.sui', 2],
  ['folder', 'vehicle', 1],
  ['pmd', 'cabin.pmd', 2],
  ['mat', 'paint.mat', 2],
  ['tobj', 'paint.tobj', 2],
  ['bnk', 'engine.bank', 2],
]

function FileTree({ label }: { label: string }) {
  return (
    <ul className="sii-snippet space-y-1.5" aria-label={label}>
      {FILES.map(([icon, name, depth]) => (
        <li
          key={name}
          className="flex items-center gap-2"
          style={{ paddingInlineStart: `${depth * 1.25}rem` }}
        >
          {icon === 'folder' ? (
            <svg
              viewBox="0 0 24 24"
              className="size-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
          ) : (
            <img
              src={`/images/extensions/${icon}.svg`}
              alt=""
              width={16}
              height={16}
              className="size-4"
            />
          )}
          <span>{name}</span>
        </li>
      ))}
    </ul>
  )
}

/** English homepage, at "/". */
export default function Home({ docsHref }: RdxHomepageProps) {
  return <HomeLayout text={EN} docsHref={docsHref} />
}

/** The page itself, in the language of `text`. */
export function HomeLayout({
  text: t,
  docsHref,
}: {
  text: HomeText
  docsHref: string
}) {
  return (
    <div className="scs-home">
      {/* Hero */}
      <section className="px-4 pt-14 pb-12 text-center sm:pt-20">
        <Logo className="mx-auto size-20 sm:size-24" />
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          SCS IntelliSense
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground sm:text-xl">
          {t.tagline}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {t.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={MARKETPLACE}
            target="_blank"
            rel="noreferrer"
            className="scs-button scs-button-primary"
          >
            {t.install} {ICONS.external}
          </a>
          <a href={docsHref} className="scs-button">
            {t.readDocs}
          </a>
        </div>

        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-xl border bg-black shadow-2xl">
          <Video
            id={VIDEO_ID}
            title="ATS & ETS2 Modding, the Easy Way | SCS IntelliSense"
            playLabel={t.playVideo}
          />
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features" className="px-4 py-12">
        <h2
          id="features"
          className="text-center text-2xl font-semibold sm:text-3xl"
        >
          {t.featuresTitle}
        </h2>
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            icon={ICONS.palette}
            title={t.highlighting.title}
            text={t.highlighting.text}
          >
            <SiiSnippet code={HIGHLIGHT} />
          </Card>

          <Card
            icon={ICONS.warning}
            title={t.diagnostics.title}
            text={t.diagnostics.text}
          >
            <SiiSnippet
              code={DIAGNOSTIC}
              mark="collsion"
              after={
                <Popup>
                  Unknown attribute &quot;collsion&quot; for animated_gate
                  <span className="sii-popup-action">
                    Quick fix: Change to &quot;collision&quot;
                  </span>
                </Popup>
              }
            />
          </Card>

          <Card
            icon={ICONS.info}
            title={t.hover.title}
            badge={t.experimental}
            text={t.hover.text}
          >
            <SiiSnippet
              code={HOVER}
              mark="price"
              markStyle="hover"
              after={
                <Popup>
                  <strong>price</strong>: <code>s64</code>
                  <span className="mt-1.5 block">
                    The price of the accessory in the store in the base currency
                    (ETS2 -&gt; EUR, ATS -&gt; USD). If zero, the accessory will
                    not be visible to the player.
                  </span>
                  <span className="mt-1.5 block">
                    Default: <code>0</code>
                  </span>
                </Popup>
              }
            />
          </Card>

          <Card icon={ICONS.file} title={t.icons.title} text={t.icons.text}>
            <FileTree label={t.icons.treeLabel} />
          </Card>

          <Card icon={ICONS.move} title={t.paths.title} text={t.paths.text}>
            <pre className="sii-snippet">
              <code>
                <span className="block text-muted-foreground">
                  cabin.pmd → cabin_day.pmd
                </span>
                <span className="block">{'​'}</span>
                <span className="sii-diff-del block">
                  - <span className="sii-key">model</span>
                  <span className="sii-colon">:</span>{' '}
                  <span className="sii-string">
                    &quot;/vehicle/my_truck/cabin.pmd&quot;
                  </span>
                </span>
                <span className="sii-diff-add block">
                  + <span className="sii-key">model</span>
                  <span className="sii-colon">:</span>{' '}
                  <span className="sii-string">
                    &quot;/vehicle/my_truck/cabin_day.pmd&quot;
                  </span>
                </span>
              </code>
            </pre>
          </Card>

          <Card icon={ICONS.more} title={t.more.title} text={t.more.text}>
            <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground marker:text-(--rdx-highlighting)">
              {t.more.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a
              href={docsHref}
              className="mt-4 inline-block text-sm font-medium text-(--rdx-highlighting) hover:underline"
            >
              {t.more.link}
            </a>
          </Card>
        </div>
      </section>

      {/* Screenshots */}
      <section aria-labelledby="screenshots" className="px-4 py-12">
        <h2
          id="screenshots"
          className="mb-8 text-center text-2xl font-semibold sm:text-3xl"
        >
          {t.screenshotsTitle}
        </h2>
        <ScreenshotGallery shots={t.shots} label={t.screenshotsLabel} />
      </section>

      {/* Call to action */}
      <section
        aria-labelledby="install"
        className="px-4 pt-12 pb-20 text-center"
      >
        <h2 id="install" className="text-2xl font-semibold sm:text-3xl">
          {t.ctaTitle}
        </h2>
        <p className="mt-3 text-muted-foreground">{t.ctaText}</p>
        <a
          href={MARKETPLACE}
          target="_blank"
          rel="noreferrer"
          className="scs-button scs-button-primary mt-6"
        >
          {t.ctaButton} {ICONS.external}
        </a>
      </section>

      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="size-8" />
            <div>
              <p className="text-sm font-medium">SCS IntelliSense</p>
              <p className="text-xs text-muted-foreground">{t.footerText}</p>
            </div>
          </div>
          <nav
            aria-label={t.footerLabel}
            className="flex items-center gap-5 text-sm"
          >
            <a href={docsHref} className="hover:text-(--rdx-highlighting)">
              {t.footerDocs}
            </a>
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="hover:text-(--rdx-highlighting)"
            >
              {ICONS.github}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
