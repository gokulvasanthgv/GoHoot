import clsx from "clsx"
import { Check, X } from "lucide-react"
import { type ButtonHTMLAttributes, type PropsWithChildren, useLayoutEffect, useRef } from "react"

type Props = PropsWithChildren &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    correct?: boolean
    largeLabelOnly?: boolean
    fontSizeClass?: string
  }

const AnswerButton = ({
  className,
  label,
  children,
  correct,
  largeLabelOnly,
  fontSizeClass,
  ...otherProps
}: Props) => {
  const CorrectIcon = correct ? Check : X
  const buttonRef = useRef<HTMLButtonElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const button = buttonRef.current
    const text = textRef.current
    if (!button || !text || largeLabelOnly) return

    const adjustFontSize = () => {
      const origOverflow = text.style.overflow
      text.style.overflow = "hidden"
      let min = 8
      let max = 32
      let optimal = min

      while (min <= max) {
        const mid = Math.floor((min + max) / 2)
        text.style.setProperty("font-size", `${mid}px`, "important")

        const isOverflowing =
          text.scrollHeight > text.clientHeight ||
          button.scrollHeight > button.clientHeight ||
          text.scrollWidth > text.clientWidth

        if (isOverflowing) {
          max = mid - 1
        } else {
          optimal = mid
          min = mid + 1
        }
      }

      text.style.setProperty("font-size", `${optimal}px`, "important")
      text.style.overflow = origOverflow
    }

    const observer = new ResizeObserver(() => {
      adjustFontSize()
    })

    observer.observe(button)
    adjustFontSize()

    return () => {
      observer.disconnect()
    }
  }, [children, largeLabelOnly])

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
      ref={buttonRef}
      className={clsx(
        "relative flex items-center gap-2 sm:gap-3 rounded-2xl px-3 py-2 sm:px-5 sm:py-4 text-left cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all duration-100 w-full h-full overflow-hidden",
        className,
      )}
      {...otherProps}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-black/20 text-sm font-extrabold sm:size-8 sm:rounded-xl md:size-10 md:text-lg lg:size-12 lg:text-xl">
        {label}
      </span>
      <p
        ref={textRef}
        className={clsx(
          "w-full flex-1 font-extrabold break-words drop-shadow-md leading-tight max-h-full overflow-y-auto pr-1",
          fontSizeClass || "text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl"
        )}
      >
        {children}
      </p>
      {correct !== undefined && (
        <CorrectIcon className="size-4 sm:size-6 md:size-8 lg:size-10 stroke-6 shrink-0" />
      )}
    </button>
  )
}

export default AnswerButton
