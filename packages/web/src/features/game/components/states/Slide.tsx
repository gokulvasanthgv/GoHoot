import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
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
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-4 select-none">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4">
        <h2 className="shrink-0 text-center text-2xl leading-tight font-extrabold text-white drop-shadow-lg sm:text-3xl md:text-5xl lg:text-6xl">
          {question}
        </h2>

        <div
          className={clsx(
            "flex min-h-0 w-full flex-1 items-center justify-center gap-4 md:gap-8",
            isLandscape ? "flex-col justify-center" : "flex-col md:flex-row",
          )}
        >
          {media && (
            <div
              className={clsx(
                "flex min-h-0 shrink items-center justify-center overflow-hidden",
                isLandscape
                  ? "h-[30vh] w-auto sm:h-[35vh]"
                  : "h-[35vh] w-full md:h-[50vh] md:max-w-[45%]",
              )}
            >
              <QuestionMedia
                media={media}
                alt={question}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}

          {text && (
            <div
              className={clsx(
                "min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/20 bg-black/40 p-4 text-center leading-relaxed font-semibold text-white shadow-xl backdrop-blur-md sm:p-6 md:p-8",
                isLandscape
                  ? "max-h-[25vh] w-full max-w-4xl text-base sm:max-h-[35vh] sm:text-xl md:text-2xl"
                  : "flex max-h-[35vh] w-full items-center justify-center text-base sm:text-xl md:max-h-full md:text-2xl lg:text-3xl",
              )}
            >
              <span className="w-full whitespace-pre-wrap">{text}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Slide
