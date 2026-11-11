import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const Prepared = ({ data: { totalAnswers, questionNumber } }: Props) => {
  const { t } = useTranslation()

  return (
    <section className="anim-show conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:px-2 conductor-compact:py-3 relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      <h2 className="anim-show conductor-compact:mb-3 conductor-compact:text-2xl mb-20 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
        {t("game:questionPrefix")}
        {questionNumber}
      </h2>
      <div className="anim-quizz conductor-compact:aspect-auto conductor-compact:w-auto conductor-compact:grid-cols-4 conductor-compact:gap-2 conductor-compact:p-2 conductor-compact:transform-none! grid aspect-square w-60 grid-cols-2 gap-4 rounded-2xl bg-gray-700 p-5 md:w-60">
        {Array.from({ length: totalAnswers }).map((_, key) => (
          <div
            key={key}
            className={clsx(
              "button shadow-inset conductor-compact:size-10 conductor-compact:rounded-xl flex aspect-square h-full w-full items-center justify-center rounded-2xl",
              ANSWERS_COLORS[key],
            )}
          >
            <span className="conductor-compact:text-base text-2xl font-bold text-white md:text-3xl">
              {ANSWERS_LABELS[key]}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Prepared
