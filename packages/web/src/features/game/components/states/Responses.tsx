import { MEDIA_TYPES } from "@razzia/common/constants"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerDistribution from "@razzia/web/features/game/components/AnswerDistribution"
import ConductorMusic from "@razzia/web/features/game/components/ConductorMusic"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
  SFX,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
}

const Responses = ({
  data: { question, answers, responses, solutions, type, media },
}: Props) => {
  const [showMedia, setShowMedia] = useState(false)
  const { t } = useTranslation()
  const [sfxResults] = useSound(SFX.RESULTS_SOUND, { volume: 0.2 })
  const isPuzzle = type === "puzzle"
  const playingMedia =
    showMedia &&
    (media?.type === MEDIA_TYPES.AUDIO || media?.type === MEDIA_TYPES.VIDEO)

  useEffect(() => {
    sfxResults()
  }, [sfxResults, responses])

  return (
    <div className="conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:overflow-visible conductor-compact:px-2 conductor-compact:pb-3 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-20 text-white select-none sm:gap-4 sm:px-6">
      <ConductorMusic enabled={!playingMedia} />
      <div className="conductor-compact:rounded-xl conductor-compact:bg-black/60 conductor-compact:p-2.5 flex shrink-0 flex-wrap items-center justify-center gap-2">
        <h2 className="conductor-compact:max-h-none conductor-compact:min-w-[min(100%,12rem)] conductor-compact:overflow-visible conductor-compact:text-[clamp(1.125rem,3.5vw,1.75rem)] max-h-[18dvh] min-w-0 flex-1 overflow-y-auto text-center text-xl leading-tight font-extrabold [overflow-wrap:anywhere] text-white drop-shadow-lg sm:text-2xl lg:text-3xl">
          {question}
        </h2>
        {media && (
          <button
            type="button"
            onClick={() => setShowMedia((previous) => !previous)}
            className="min-h-11 shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-900 shadow-md hover:bg-gray-100"
          >
            {t(
              showMedia
                ? "game:roundResults.showChart"
                : "game:roundResults.showMedia",
            )}
          </button>
        )}
      </div>

      <div className="conductor-compact:min-h-[clamp(12rem,32dvh,21rem)] flex min-h-40 flex-1 items-stretch">
        {showMedia && media ? (
          <div className="flex min-h-40 w-full items-center justify-center overflow-hidden">
            <QuestionMedia
              media={media}
              alt={question}
              className="conductor-compact:m-0 conductor-compact:max-h-[45dvh] max-h-full max-w-full rounded-lg object-contain shadow-md"
            />
          </div>
        ) : (
          <AnswerDistribution
            answers={answers}
            responses={responses}
            puzzle={isPuzzle}
          />
        )}
      </div>

      <ol
        aria-label={t("game:roundResults.options")}
        className="conductor-compact:grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {answers.map((answer, index) => {
          const correct = isPuzzle || solutions.includes(index)
          const CorrectIcon = correct ? Check : X

          return (
            <li
              key={index}
              className={clsx(
                "conductor-compact:min-h-11 conductor-compact:px-2 conductor-compact:text-sm flex min-h-14 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold sm:text-base",
                ANSWERS_COLORS[index],
                answers.length % 2 === 1 &&
                  index === answers.length - 1 &&
                  "max-sm:conductor-compact:col-span-full",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-black/20 text-sm font-extrabold">
                {isPuzzle ? index + 1 : ANSWERS_LABELS[index]}
              </span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {answer}
              </span>
              <CorrectIcon
                className="size-5 shrink-0 stroke-3"
                aria-hidden="true"
              />
              <span className="sr-only">
                {t(
                  correct
                    ? "game:roundResults.correct"
                    : "game:roundResults.incorrect",
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default Responses
