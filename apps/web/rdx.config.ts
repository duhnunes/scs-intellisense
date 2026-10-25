import { defineConfig } from '@lexibase/rdx'

import { Logo } from './logo'

export default defineConfig({
  description:
    'VS Code extension for modding American Truck Simulator and Euro Truck Simulator 2: highlighting, diagnostics, completion and navigation for .sii and .sui files.',
  // Site identity, SEO and link previews. '/' paths refer to files in public/.
  metadata: {
    // The single site name: browser titles, social previews and default branding.
    applicationName: 'SCS IntelliSense',
    // Footer starting year. Change it to an earlier founding year if needed.
    since: 2026,
    // Set metadataBase to your public site URL to resolve relative share images.
    keywords: [
      'SCS IntelliSense',
      'VS Code',
      'American Truck Simulator',
      'Euro Truck Simulator 2',
      'ATS',
      'ETS2',
      'modding',
      'sii',
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
  // When disabled, '/' redirects to '/docs'.
  // To use your own home.tsx, import its component and set homepage.component.
  homepage: {
    enabled: false,
  },
  theme: {
    defaultTheme: 'system',
  },
})
