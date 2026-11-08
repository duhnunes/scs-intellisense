import { defineConfig } from '@lexibase/rdx'
import { Logo } from './components/logo'
import { i18n } from '@lexibase/rdx-i18n'

export default defineConfig({
  description:
    'VS Code extension for modding American Truck Simulator and Euro Truck Simulator 2: highlighting, diagnostics, completion and navigation for .sii and .sui files.',
  // Site identity, SEO and link previews. '/' paths refer to files in public/.
  metadata: {
    // The single site name: browser titles, social previews and default branding.
    applicationName: 'SCS IntelliSense',
    // Footer starting year. Change it to an earlier founding year if needed.
    since: 2026,
    // The public site URL: relative share images resolve against it.
    metadataBase: 'https://scs-intellisense.vercel.app',
    keywords: [
      'SCS IntelliSense',
      'American Truck Simulator',
      'Euro Truck Simulator 2',
      'ATS',
      'ETS2',
      'modding',
      'sii',
      'VS Code',
    ],
    icons: {
      // Browser tab icons with optional sizes and MIME types.
      icon: [
        { url: '/images/icons/favicon.svg', type: 'image/svg+xml' },
        {
          url: '/images/icons/favicon-96x96.png',
          sizes: '96x96',
          type: 'image/png',
        },
      ],
      // Traditional favicon link for browser compatibility.
      shortcut: '/images/icons/favicon.ico',
      // Home screen icon on iPhone and iPad.
      apple: '/images/icons/apple-touch-icon.png',
    },
    // The web app manifest (name and icons when installed); RDX does not create it.
    manifest: '/site.webmanifest',
    // Link previews (Discord, forums): the logo, square, so a small card.
    openGraph: {
      type: 'website',
      siteName: 'SCS IntelliSense',
      images: [
        {
          url: '/images/icons/web-app-manifest-512x512.png',
          width: 512,
          height: 512,
          alt: 'SCS IntelliSense logo',
        },
      ],
    },
    twitter: {
      card: 'summary',
      images: ['/images/icons/web-app-manifest-512x512.png'],
    },
  },
  // "Edit this page" link to the page's file on GitHub.
  editPage: {
    baseUrl: 'https://github.com/duhnunes/scs-intellisense/edit/main/apps/web',
  },
  // Colors for ```sii and ```sui code blocks. The grammars mirror the
  // extension's highlighting; edit grammars/generate.mjs, not the JSON. sui
  // reuses sii's rules, so both are listed.
  syntaxHighlighting: {
    languages: {
      sii: './grammars/sii.tmLanguage.json',
      sui: './grammars/sui.tmLanguage.json',
    },
    themes: {
      dark: 'catppuccin-mocha',
      light: 'catppuccin-latte',
    },
  },
  // Floating heading navigation; shown only on pages with enough sections.
  TOC: true,
  // Local documentation search in the navbar; no external search service needed.
  search: true,
  // Optional navbar text does not change metadata.applicationName.
  navbar: {
    title: '', // Text beside the logo; empty or omitted shows only the logo.
    logo: Logo, // A React component that accepts className, not an image path.
    actions: {
      github: {
        visible: true,
        url: 'https://github.com/duhnunes/scs-intellisense',
      },
      showToggleMode: false,
    },
  },
  // The landing page at '/': components/home.tsx, translated by the
  // phrases in locale/<folder>/home.json. When disabled, '/' redirects to
  // '/docs'.
  homepage: {
    enabled: true,
    translations: true,
  },
  theme: {
    defaultTheme: 'system',
  },

  plugins: [
    i18n({
      locales: [
        {
          code: 'en',
          label: 'English',
        },
        {
          code: 'pt-BR',
          label: 'Português (Brasil)',
        },
      ],
      // "Help translate" (language menu) and "Translate this page" (on a
      // page missing its translation) open the translations folder.
      contributionUrl:
        'https://github.com/duhnunes/scs-intellisense/tree/main/apps/web/locale',
    }),
  ],
})
