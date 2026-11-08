'use client'

import { useState } from 'react'

// Real screenshots of the extension (public/images/screenshots), one at a
// time, picked by tab.
const SHOTS = [
  {
    label: 'Hover',
    src: '/images/screenshots/hover.png',
    caption:
      'Point at a class to see the class it extends, or at an attribute to see its type.',
  },
  {
    label: 'Quick fix',
    src: '/images/screenshots/quickFix.png',
    caption:
      'A misspelled attribute is flagged as you type, with the fix one click away.',
  },
  {
    label: 'Completion',
    src: '/images/screenshots/comp-attributes.png',
    caption: "Suggestions for the unit's own attributes, with their types.",
  },
  {
    label: 'Ctrl+click',
    src: '/images/screenshots/ctrlClick.png',
    caption:
      'Ctrl+click a path to open the file, or a unit name to go to where it is defined.',
  },
  {
    label: '@include',
    src: '/images/screenshots/include.png',
    caption: 'Completion lists the folders and .sui files you can include.',
  },
  {
    label: 'Moving files',
    src: '/images/screenshots/renameFile.png',
    caption:
      'Rename or move a file, and every path to it is updated and marked for review.',
  },
]

export function ScreenshotGallery() {
  const [current, setCurrent] = useState(0)
  const shot = SHOTS[current]
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div
        role="tablist"
        aria-label="Screenshots"
        className="mb-4 flex flex-wrap justify-center gap-2"
      >
        {SHOTS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            id={`shot-tab-${i}`}
            aria-selected={i === current}
            aria-controls="shot-panel"
            onClick={() => setCurrent(i)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              i === current
                ? 'scs-on-accent border-(--rdx-highlighting) bg-(--rdx-highlighting)'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <figure
        id="shot-panel"
        role="tabpanel"
        aria-labelledby={`shot-tab-${current}`}
      >
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border bg-[#1e1e1e] shadow-2xl">
          <img
            src={shot.src}
            alt={`${shot.label}: ${shot.caption}`}
            width={944}
            height={896}
            className="mx-auto block h-auto w-full max-w-[944px]"
          />
        </div>
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">
          {shot.caption}
        </figcaption>
      </figure>
    </div>
  )
}
