import clsx from "clsx"
import { Check, X } from "lucide-react"
import {
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  useLayoutEffect,
  useRef,
} from "react"

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

    if (!button || !text || largeLabelOnly) {
      return
    }

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
          "relative flex h-full w-full cursor-pointer touch-manipulation flex-col items-center justify-center gap-3 rounded-2xl p-4 text-center transition-all duration-100 select-none active:scale-[0.98]",
          className,
        )}
        {...otherProps}
      >
        <span className="flex size-16 items-center justify-center rounded-3xl bg-black/20 text-3xl font-extrabold text-white sm:size-24 sm:text-5xl md:size-32 md:text-6xl lg:size-40 lg:text-7xl">
          {label}
        </span>
        {correct !== undefined && (
          <CorrectIcon className="mt-4 size-8 stroke-6 sm:size-12 md:size-16" />
        )}
      </button>
    )
  }

  return (
    <button
      ref={buttonRef}
      className={clsx(
        "relative flex h-full w-full cursor-pointer touch-manipulation items-center gap-2 overflow-hidden rounded-2xl px-3 py-2 text-left transition-all duration-100 select-none active:scale-[0.98] sm:gap-3 sm:px-5 sm:py-4",
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
          "max-h-full w-full flex-1 overflow-y-auto pr-1 leading-tight font-extrabold break-words drop-shadow-md",
          fontSizeClass ||
            "text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl",
        )}
      >
        {children}
      </p>
      {correct !== undefined && (
        <CorrectIcon className="size-4 shrink-0 stroke-6 sm:size-6 md:size-8 lg:size-10" />
      )}
    </button>
  )
}

export default AnswerButton
