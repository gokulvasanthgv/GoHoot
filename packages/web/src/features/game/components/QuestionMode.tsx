import type { QuestionType } from "@razzia/common/types/game"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

interface Props {
  type?: QuestionType
  multiSelect?: boolean
  className?: string
  animated?: boolean
}

const choices = ["M5 9H17V21H5Z", "M5 27H17V39H5Z", "M24 15H42", "M24 33H38"]
const firstCheck = "M7 14L11 18L20 8"
const symbols = {
  quiz: { outline: choices, marks: [] },
  single: { outline: choices, marks: [firstCheck] },
  multiple: { outline: choices, marks: [firstCheck, "M7 32L11 36L20 26"] },
  trueOrFalse: {
    outline: ["M4 14H22V32H4Z", "M26 14H44V32H26Z"],
    marks: ["M8 22L12 26L18 19", "M31 19L39 27 M39 19L31 27"],
  },
  order: {
    outline: ["M19 11H42", "M19 24H38", "M19 37H42"],
    marks: ["M9 12V36 M5 16L9 12L13 16 M5 32L9 36L13 32"],
  },
  slide: { outline: ["M5 9H43V39H5Z", "M12 18H36", "M12 25H29"], marks: [] },
}

const modeKey = (type?: QuestionType, multiSelect?: boolean) => {
  switch (type) {
    case "true_or_false":
      return "trueOrFalse"

    case "puzzle":
      return "order"

    case "slide":
      return "slide"

    default:
      return multiSelect === undefined
        ? "quiz"
        : multiSelect
          ? "multiple"
          : "single"
  }
}

const QuestionMode = ({
  type,
  multiSelect,
  className,
  animated = false,
}: Props) => {
  const { t } = useTranslation()
  const key = modeKey(type, multiSelect)
  const { outline, marks } = symbols[key]

  return (
    <span
      className={clsx(
        "inline-flex w-fit max-w-full items-center self-center text-center font-extrabold",
        animated
          ? "conductor-compact:py-2 flex-col gap-2 rounded-2xl bg-amber-100 px-6 py-3 text-lg text-amber-950 shadow-xl sm:text-2xl"
          : "conductor-compact:px-2 conductor-compact:py-0.5 conductor-compact:text-xs gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-950 shadow-sm sm:text-base",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        data-question-mode-art={animated ? key : undefined}
        className={
          animated
            ? "question-mode-cue conductor-compact:size-12 size-16 sm:size-20"
            : "conductor-compact:size-4 size-5 shrink-0"
        }
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {outline.map((path) => (
          <path key={path} d={path} opacity=".5" />
        ))}
        {marks.map((path, index) => (
          <path
            key={path}
            d={path}
            className={animated ? "question-mode-mark" : undefined}
            style={
              animated
                ? { animationDelay: `${180 + index * 130}ms` }
                : undefined
            }
          />
        ))}
      </svg>
      {t(`game:questionMode.${key}`)}
    </span>
  )
}

export default QuestionMode
