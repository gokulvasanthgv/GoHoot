import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import QuestionHeading from "@razzia/web/features/game/components/QuestionHeading"
import { useEffect, useState } from "react"
import clsx from "clsx"

interface Props {
  data: CommonStatusDataMap["SHOW_SLIDE"]
}

const Slide = ({ data: { question, text, media } }: Props) => {
  const [aspectRatio, setAspectRatio] = useState<
    "landscape" | "portrait" | "square"
  >("landscape")

  useEffect(() => {
    if (media?.type?.toLowerCase() === "image" && media.url) {
      const img = new Image()
      img.src = media.url
      img.onload = () => {
        const ratio = img.width / img.height

        if (ratio > 1.2) {
          setAspectRatio("landscape")
        } else if (ratio < 0.85) {
          setAspectRatio("portrait")
        } else {
          setAspectRatio("square")
        }
      }
    } else {
      setAspectRatio("landscape")
    }
  }, [media])

  const isLandscape = aspectRatio === "landscape"

  return (
    <section className="conductor-compact:h-auto conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:px-2 conductor-compact:py-2 relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-4 select-none">
      <div className="conductor-compact:basis-auto conductor-compact:gap-2 flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4">
        <QuestionHeading
          question={question}
          className="conductor-compact:rounded-xl conductor-compact:bg-black/35 conductor-compact:p-3 w-full shrink-0"
        />

        <div
          className={clsx(
            "conductor-compact:basis-auto conductor-compact:gap-2 flex min-h-0 w-full flex-1 items-center justify-center gap-4 md:gap-8",
            isLandscape ? "flex-col justify-center" : "flex-col md:flex-row",
          )}
        >
          {media && (
            <div
              className={clsx(
                "conductor-compact:h-auto conductor-compact:w-full conductor-compact:max-w-full flex min-h-0 shrink items-center justify-center overflow-hidden",
                isLandscape
                  ? "h-[30vh] w-auto sm:h-[35vh]"
                  : "h-[35vh] w-full md:h-[50vh] md:max-w-[45%]",
              )}
            >
              <QuestionMedia
                media={media}
                alt={question}
                className="conductor-compact:m-0 conductor-compact:max-h-[clamp(6rem,45dvh,18rem)] max-h-full max-w-full object-contain"
              />
            </div>
          )}

          {text && (
            <div
              className={clsx(
                "game-slide-text conductor-compact:max-h-none conductor-compact:basis-auto conductor-compact:overflow-visible conductor-compact:p-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/20 bg-black/40 p-4 text-center leading-relaxed font-semibold text-white shadow-xl backdrop-blur-md sm:p-6 md:p-8",
                isLandscape
                  ? "max-h-[25dvh] w-full max-w-4xl sm:max-h-[35dvh]"
                  : "flex max-h-[35dvh] w-full items-center-safe justify-center-safe md:max-h-full",
              )}
            >
              <span className="w-full min-w-0 whitespace-pre-wrap">{text}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Slide
