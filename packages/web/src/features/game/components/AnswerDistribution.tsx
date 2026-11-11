import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

interface Props {
  answers: string[]
  responses: Record<number, number>
  puzzle: boolean
}

const AnswerDistribution = ({ answers, responses, puzzle }: Props) => {
  const { t } = useTranslation()
  const entries = puzzle
    ? [
        { label: t("game:roundResults.correct"), color: ANSWERS_COLORS[2] },
        { label: t("game:roundResults.incorrect"), color: ANSWERS_COLORS[5] },
      ]
    : answers.map((_, index) => ({
        label: ANSWERS_LABELS[index],
        color: ANSWERS_COLORS[index],
      }))
  const maximum = Math.max(
    1,
    ...entries.map((_, index) => responses[index] || 0),
  )

  return (
    <ol
      aria-label={t("game:roundResults.distribution")}
      className="conductor-compact:gap-2 mx-auto grid h-full min-h-40 w-full max-w-4xl gap-3 px-2 pt-9 sm:gap-6"
      style={{
        gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`,
      }}
    >
      {entries.map(({ label, color }, index) => {
        const count = responses[index] || 0

        return (
          <li
            key={index}
            aria-label={`${label}: ${count}`}
            className="flex min-h-0 min-w-0 flex-col gap-2"
          >
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <div
                className={clsx("relative min-h-1 w-full rounded-t-lg", color)}
                style={{ height: `${(count / maximum) * 100}%` }}
              >
                <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-md bg-slate-950 px-2 py-0.5 text-base font-extrabold text-white sm:text-xl">
                  {count}
                </span>
              </div>
            </div>
            <span
              className={clsx(
                "min-h-7 self-center rounded-md px-2 py-1 text-center text-xs leading-tight font-bold [overflow-wrap:anywhere] sm:text-sm",
                color,
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default AnswerDistribution
