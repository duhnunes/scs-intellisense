'use client'

import { useState } from 'react'

// Real screenshots of the extension (public/images/screenshots), one at a
// time, picked by tab. Labels and captions come from the page's language.
const SHOTS = {
  hover: '/images/screenshots/hover.png',
  quickFix: '/images/screenshots/quickFix.png',
  completion: '/images/screenshots/comp-attributes.png',
  ctrlClick: '/images/screenshots/ctrlClick.png',
  include: '/images/screenshots/include.png',
  moving: '/images/screenshots/renameFile.png',
}

/** Tab label and caption for each screenshot. */
export type ShotText = Record<
  keyof typeof SHOTS,
  { label: string; caption: string }
>

export function ScreenshotGallery({
  shots,
  label,
}: {
  shots: ShotText
  label: string
}) {
  const keys = Object.keys(SHOTS) as (keyof typeof SHOTS)[]
  const [current, setCurrent] = useState(0)
  const shot = shots[keys[current]]
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div
        role="tablist"
        aria-label={label}
        className="mb-4 flex flex-wrap justify-center gap-2"
      >
        {keys.map((key, i) => (
          <button
            key={key}
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
            {shots[key].label}
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
            src={SHOTS[keys[current]]}
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
