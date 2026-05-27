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
              {type === "true_or_false" ? "True or False" : type === "puzzle" ? "Puzzle" : `${count} Options`}
            </span>
            {type === "true_or_false" ? (
              <div className="flex gap-4 sm:gap-6 mt-2 justify-center">
                <div
                  className={clsx(
                    "flex h-16 w-24 sm:h-20 sm:w-32 items-center justify-center rounded-2xl text-xl sm:text-2xl font-black shadow-2xl border border-white/20 text-white animate-tf-balance-a",
                    ANSWERS_COLORS[0]
                  )}
                >
                  {ANSWERS_LABELS[0]}
                </div>
                <div
                  className={clsx(
                    "flex h-16 w-24 sm:h-20 sm:w-32 items-center justify-center rounded-2xl text-xl sm:text-2xl font-black shadow-2xl border border-white/20 text-white animate-tf-balance-b",
                    ANSWERS_COLORS[1]
                  )}
                >
                  {ANSWERS_LABELS[1]}
                </div>
              </div>
            ) : type === "puzzle" ? (
              <div className="puzzle-container-card mt-2 rounded-2xl bg-slate-900/80 p-4 border border-slate-700/50 backdrop-blur-md shadow-2xl">
                <div className="grid grid-cols-2 gap-3 min-w-[140px] sm:min-w-[180px]">
                  {Array.from({ length: count }).map((_, i) => {
                    const animClass =
                      i === 0 ? "animate-puzzle-tile-1" :
                      i === 1 ? "animate-puzzle-tile-2" :
                      i === 2 ? "animate-puzzle-tile-3" :
                      i === 3 ? "animate-puzzle-tile-4" : "animate-bounce-custom"

                    return (
                      <div
                        key={i}
                        className={clsx(
                          "flex size-12 sm:size-16 items-center justify-center rounded-xl text-lg sm:text-xl font-black shadow-lg border border-white/10 text-white",
                          ANSWERS_COLORS[i],
                          animClass
                        )}
                      >
                        {ANSWERS_LABELS[i]}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-2 justify-center">
                {Array.from({ length: count }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "flex size-10 sm:size-12 items-center justify-center rounded-full text-base sm:text-lg font-black shadow-lg border border-white/15 text-white animate-quiz-wave",
                      ANSWERS_COLORS[i]
                    )}
                    style={{
                      animationDelay: `${i * 0.12}s`,
                    }}
                  >
                    {ANSWERS_LABELS[i]}
                  </div>
                ))}
              </div>
            )}
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
