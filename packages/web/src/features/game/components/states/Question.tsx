import { MEDIA_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import {
  SFX,
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { useEffect } from "react"
import useSound from "use-sound"
import clsx from "clsx"
import { Sparkles } from "lucide-react"
import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import QuestionHeading from "@razzia/web/features/game/components/QuestionHeading"

interface Props {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const Question = ({
  data: {
    question,
    media,
    cooldown,
    answersCount,
    type,
    doublePoints,
    hideTextOnClient,
  },
}: Props) => {
  const isManager = useIsManagerScreen()
  const hideText = Boolean(hideTextOnClient) && !isManager
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  const count = type === "true_or_false" ? 2 : answersCount || 4

  return (
    <section className="conductor-compact:h-auto conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:gap-4 conductor-compact:overflow-visible conductor-compact:px-2 conductor-compact:py-2 relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-between overflow-x-hidden overflow-y-auto px-4">
      <div className="conductor-compact:basis-auto conductor-compact:gap-3 flex w-full flex-auto flex-col items-center justify-center gap-4 pb-3 md:gap-6">
        {!hideText && (
          <QuestionHeading
            question={question}
            className="anim-show conductor-compact:rounded-xl conductor-compact:bg-black/35 conductor-compact:p-3 w-full px-2"
          />
        )}

        {doublePoints && (
          <div className="animate-double-points conductor-compact:my-0 conductor-compact:px-3 conductor-compact:py-1 conductor-compact:text-xs my-1 flex shrink-0 items-center gap-2 rounded-full border border-yellow-300/30 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 px-6 py-2 text-sm font-black tracking-wider text-white uppercase shadow-[0_0_20px_rgba(245,158,11,0.5)] select-none sm:text-base">
            <Sparkles className="animate-spin-slow size-4 text-yellow-100" />
            Double Points
            <Sparkles className="animate-spin-slow size-4 text-yellow-100" />
          </div>
        )}

        {!hideText && media?.type === MEDIA_TYPES.IMAGE && (
          <img
            alt={question}
            src={media.url}
            className="conductor-compact:max-h-[clamp(6rem,35dvh,16rem)] max-h-[35dvh] max-w-full rounded-xl object-contain shadow-2xl sm:max-h-[42dvh]"
          />
        )}

        {type !== "slide" && (
          <div className="anim-show conductor-compact:mt-0 conductor-compact:gap-1 mt-4 flex max-w-full shrink-0 flex-col items-center gap-2">
            <span className="conductor-compact:rounded-md conductor-compact:bg-black/65 conductor-compact:px-2 conductor-compact:py-1 conductor-compact:text-xs conductor-compact:text-white text-sm font-semibold tracking-widest text-white/60 uppercase">
              {type === "true_or_false"
                ? "True or False"
                : type === "puzzle"
                  ? "Puzzle"
                  : `${count} Options`}
            </span>
            {type === "true_or_false" ? (
              <div className="conductor-compact:gap-2 mt-2 flex justify-center gap-4 sm:gap-6">
                <div
                  className={clsx(
                    "animate-tf-balance-a conductor-compact:h-10 conductor-compact:w-16 conductor-compact:rounded-xl conductor-compact:text-base flex h-16 w-24 items-center justify-center rounded-2xl border border-white/20 text-xl font-black text-white shadow-2xl sm:h-20 sm:w-32 sm:text-2xl",
                    ANSWERS_COLORS[0],
                  )}
                >
                  {ANSWERS_LABELS[0]}
                </div>
                <div
                  className={clsx(
                    "animate-tf-balance-b conductor-compact:h-10 conductor-compact:w-16 conductor-compact:rounded-xl conductor-compact:text-base flex h-16 w-24 items-center justify-center rounded-2xl border border-white/20 text-xl font-black text-white shadow-2xl sm:h-20 sm:w-32 sm:text-2xl",
                    ANSWERS_COLORS[1],
                  )}
                >
                  {ANSWERS_LABELS[1]}
                </div>
              </div>
            ) : type === "puzzle" ? (
              <div className="puzzle-container-card conductor-compact:p-2 mt-2 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-md">
                <div className="conductor-compact:min-w-0 conductor-compact:grid-cols-4 conductor-compact:gap-2 grid min-w-[140px] grid-cols-2 gap-3 sm:min-w-[180px]">
                  {Array.from({ length: count }).map((_, i) => {
                    const animClass =
                      i === 0
                        ? "animate-puzzle-tile-1"
                        : i === 1
                          ? "animate-puzzle-tile-2"
                          : i === 2
                            ? "animate-puzzle-tile-3"
                            : i === 3
                              ? "animate-puzzle-tile-4"
                              : "animate-bounce-custom"

                    return (
                      <div
                        key={i}
                        className={clsx(
                          "conductor-compact:size-9 conductor-compact:rounded-lg conductor-compact:text-sm flex size-12 items-center justify-center rounded-xl border border-white/10 text-lg font-black text-white shadow-lg sm:size-16 sm:text-xl",
                          ANSWERS_COLORS[i],
                          animClass,
                        )}
                      >
                        {ANSWERS_LABELS[i]}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="conductor-compact:gap-1.5 mt-2 flex flex-wrap justify-center gap-3">
                {Array.from({ length: count }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "animate-quiz-wave conductor-compact:size-8 conductor-compact:text-sm flex size-10 items-center justify-center rounded-full border border-white/15 text-base font-black text-white shadow-lg sm:size-12 sm:text-lg",
                      ANSWERS_COLORS[i],
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
        className="bg-primary conductor-compact:mb-0 conductor-compact:h-2 mb-12 h-4 shrink-0 self-start justify-self-end rounded-full sm:mb-20"
        style={{ animation: `progressBar ${cooldown}s linear forwards` }}
      ></div>
    </section>
  )
}

export default Question
