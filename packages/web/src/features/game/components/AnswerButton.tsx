import clsx from "clsx"
import { Check } from "lucide-react"
import type { ButtonHTMLAttributes } from "react"
import AnswerShape, { useAnswerShapeName } from "./AnswerShape"

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  index: number
  answer: string
  selected?: boolean
  hideText?: boolean
}

const AnswerButton = ({
  className,
  index,
  answer,
  selected,
  hideText,
  ...otherProps
}: Props) => {
  const shapeName = useAnswerShapeName()

  return (
    <button
      type="button"
      aria-label={hideText ? shapeName(index) : undefined}
      aria-pressed={selected}
      data-answer-hidden={hideText ? "" : undefined}
      className={clsx(
        "answer-option conductor-compact:rounded-xl conductor-compact:px-1 conductor-compact:py-2 sm:conductor-compact:py-1.5 relative flex min-h-12 min-w-0 cursor-pointer touch-manipulation items-center rounded-2xl px-1 py-2.5 text-center font-extrabold text-white transition-transform duration-100 select-none active:scale-[0.98] sm:px-5 sm:py-4",
        selected && "ring-4 ring-white",
        className,
      )}
      {...otherProps}
    >
      <span className="answer-option-content">
        <AnswerShape index={index} className="answer-option-shape" />
        {!hideText && (
          <span
            data-answer-text=""
            className="min-w-0 leading-[1.25] drop-shadow-md"
          >
            {answer}
          </span>
        )}
      </span>
      {selected && (
        <Check
          aria-hidden="true"
          className="answer-selection absolute end-2 top-1 size-4 stroke-3"
        />
      )}
    </button>
  )
}

export default AnswerButton
