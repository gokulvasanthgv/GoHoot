import clsx from "clsx"
import { Check, X } from "lucide-react"
import type { ButtonHTMLAttributes, PropsWithChildren } from "react"

type Props = PropsWithChildren &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    correct?: boolean
    largeLabelOnly?: boolean
  }

const AnswerButton = ({
  className,
  label,
  children,
  correct,
  largeLabelOnly,
  ...otherProps
}: Props) => {
  const CorrectIcon = correct ? Check : X

  if (largeLabelOnly) {
    return (
      <button
        className={clsx(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl text-center cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all duration-100 w-full h-full p-4",
          className,
        )}
        {...otherProps}
      >
        <span className="flex size-16 sm:size-24 md:size-32 lg:size-40 items-center justify-center rounded-3xl bg-black/20 text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
          {label}
        </span>
        {correct !== undefined && (
          <CorrectIcon className="size-8 sm:size-12 md:size-16 stroke-6 mt-4" />
        )}
      </button>
    )
  }

  return (
    <button
      className={clsx(
        "relative flex items-center gap-3 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 md:py-5 lg:py-6 text-left cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all duration-100 w-full h-full",
        className,
      )}
      {...otherProps}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-black/20 text-sm font-extrabold sm:size-8 sm:rounded-xl md:size-10 md:text-lg lg:size-12 lg:text-xl">
        {label}
      </span>
      <p className="w-full flex-1 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-extrabold break-words drop-shadow-md leading-normal">
        {children}
      </p>
      {correct !== undefined && (
        <CorrectIcon className="size-4 sm:size-6 md:size-8 lg:size-10 stroke-6 shrink-0" />
      )}
    </button>
  )
}

export default AnswerButton
