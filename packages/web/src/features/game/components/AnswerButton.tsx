import clsx from "clsx"
import { Check } from "lucide-react"
import type { ButtonHTMLAttributes } from "react"

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string
  answer: string
  selected?: boolean
  largeLabelOnly?: boolean
}

const AnswerButton = ({
  className,
  label,
  answer,
  selected,
  largeLabelOnly,
  ...otherProps
}: Props) => {
  const badge = (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center bg-black/20 text-white",
        largeLabelOnly
          ? "answer-letter aspect-square rounded-2xl leading-none"
          : "sm:conductor-compact:size-7 sm:conductor-compact:rounded-lg sm:conductor-compact:text-sm size-6 rounded-lg text-sm sm:size-8 sm:rounded-xl md:size-10 md:text-lg lg:size-12 lg:text-xl",
      )}
    >
      {label}
    </span>
  )

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        "answer-option relative flex min-w-0 cursor-pointer touch-manipulation rounded-2xl font-extrabold transition-transform duration-100 select-none active:scale-[0.98]",
        largeLabelOnly
          ? "items-center justify-center p-4 text-center"
          : "conductor-compact:rounded-xl conductor-compact:px-2.5 conductor-compact:py-2 sm:conductor-compact:py-1.5 min-h-12 px-3 py-2.5 text-left sm:px-5 sm:py-4",
        selected && "ring-4 ring-white",
        className,
      )}
      {...otherProps}
    >
      {largeLabelOnly ? (
        badge
      ) : (
        <span className="answer-option-content flex w-full min-w-0 items-center gap-2 sm:gap-3">
          {badge}
          <span
            data-answer-text=""
            className="min-w-0 flex-1 leading-[1.25] drop-shadow-md"
          >
            {answer}
          </span>
          {selected !== undefined && (
            <Check
              aria-hidden="true"
              className={clsx(
                "answer-selection size-4 shrink-0 stroke-3 sm:size-5",
                !selected && "invisible",
              )}
            />
          )}
        </span>
      )}
    </button>
  )
}

export default AnswerButton
