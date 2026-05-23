import clsx from "clsx"
import { type HTMLAttributes } from "react"
import { twMerge } from "tailwind-merge"

type Props = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

const Card = ({ children, className, ...props }: Props) => (
  <div
    className={twMerge(
      clsx(
        "z-10 flex w-full max-w-80 flex-col rounded-xl bg-white p-4 shadow-sm",
        className,
      ),
    )}
    {...props}
  >
    {children}
  </div>
)

export default Card
