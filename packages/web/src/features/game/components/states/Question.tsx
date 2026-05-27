import { MEDIA_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { SFX, ANSWERS_COLORS, ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import { useEffect } from "react"
import useSound from "use-sound"
import clsx from "clsx"

interface Props {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const Question = ({ data: { question, media, cooldown, answersCount, type } }: Props) => {
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  const getFontSizeClass = (len: number) => {
    if (len < 50) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold"
    if (len < 100) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold"
    return "text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold"
  }

  const hasMedia = !!(media?.type === MEDIA_TYPES.IMAGE)
  const count = type === "true_or_false" ? 2 : (answersCount || 4)

  return (
    <section className="relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-between px-4 min-h-0">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 md:gap-6 min-h-0 w-full shrink">
        <div className={clsx(
          "w-full overflow-y-auto px-2 shrink-0 flex items-center justify-center mb-2",
          hasMedia ? "max-h-[30vh] sm:max-h-[35vh]" : "max-h-[70vh]"
        )}>
          <h2 className={clsx(
            "anim-show text-center text-white drop-shadow-lg leading-tight w-full break-words",
            getFontSizeClass(question.length)
          )}>
            {question}
          </h2>
        </div>

        {media?.type === MEDIA_TYPES.IMAGE && (
          <img
            alt={question}
            src={media.url}
            className="max-h-[35vh] sm:max-h-[45vh] md:max-h-[50vh] w-auto rounded-xl object-contain shadow-2xl shrink min-h-0"
          />
        )}

        {type !== "slide" && (
          <div className="flex flex-col items-center gap-2 mt-4 shrink-0 anim-show">
            <span className="text-sm font-semibold uppercase tracking-widest text-white/60">
              {type === "true_or_false" ? "True or False" : `${count} Options`}
            </span>
            <div className="flex gap-3">
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    "flex size-10 items-center justify-center rounded-full text-lg font-bold shadow-lg border border-white/10 text-white animate-bounce-custom",
                    ANSWERS_COLORS[i]
                  )}
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "1.0s",
                    animationIterationCount: "infinite"
                  }}
                >
                  {ANSWERS_LABELS[i]}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        className="bg-primary mb-12 sm:mb-20 h-4 self-start justify-self-end rounded-full shrink-0"
        style={{ animation: `progressBar ${cooldown}s linear forwards` }}
      ></div>
    </section>
  )
}

export default Question
