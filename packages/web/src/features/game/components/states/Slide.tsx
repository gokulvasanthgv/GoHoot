import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import { useEffect, useState } from "react"
import clsx from "clsx"

interface Props {
  data: CommonStatusDataMap["SHOW_SLIDE"]
}

const Slide = ({ data: { question, text, media } }: Props) => {
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait" | "square">("landscape")

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
    <section className="relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-4 min-h-0 select-none">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 min-h-0">
        <h2 className="text-center text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold text-white drop-shadow-lg leading-tight shrink-0">
          {question}
        </h2>

        <div className={clsx(
          "w-full flex flex-1 min-h-0 gap-4 md:gap-8 items-center justify-center",
          isLandscape ? "flex-col justify-center" : "flex-col md:flex-row"
        )}>
          {media && (
            <div className={clsx(
              "flex items-center justify-center min-h-0 shrink overflow-hidden",
              isLandscape 
                ? "h-[30vh] sm:h-[35vh] w-auto" 
                : "h-[35vh] md:h-[50vh] w-full md:max-w-[45%]"
            )}>
              <QuestionMedia media={media} alt={question} className="max-h-full max-w-full object-contain" />
            </div>
          )}

          {text && (
            <div className={clsx(
              "overflow-y-auto rounded-2xl border border-white/20 bg-black/40 p-4 sm:p-6 md:p-8 text-center leading-relaxed font-semibold text-white shadow-xl backdrop-blur-md flex-1 min-h-0",
              isLandscape 
                ? "w-full max-w-4xl max-h-[25vh] sm:max-h-[35vh] text-base sm:text-xl md:text-2xl" 
                : "w-full text-base sm:text-xl md:text-2xl lg:text-3xl max-h-[35vh] md:max-h-full flex items-center justify-center"
            )}>
              <span className="w-full whitespace-pre-wrap">{text}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Slide
