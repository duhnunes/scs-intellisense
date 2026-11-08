'use client'

import { useState } from 'react'

// A YouTube video that loads only when played: until then, its thumbnail and
// a play button. The page stays light, and YouTube sees nothing from readers
// who don't watch.
export function Video({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="relative aspect-video w-full">
      {playing ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer"
          aria-label={`Play video: ${title}`}
        >
          <img
            src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
            alt=""
            width={1280}
            height={720}
            className="size-full object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover:bg-black/10">
            <span className="scs-on-accent grid size-16 place-items-center rounded-full bg-(--rdx-highlighting) shadow-lg transition-transform group-hover:scale-110 sm:size-20">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="size-7 sm:size-9"
              >
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
