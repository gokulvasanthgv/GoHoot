import clsx from "clsx"
import type { ButtonHTMLAttributes, PropsWithChildren } from "react"

const ConfigTabButton = ({
  children,
  active,
  ...otherProps
}: ButtonHTMLAttributes<HTMLButtonElement> &
  PropsWithChildren & { active?: boolean }) => (
  <button
    className={clsx(
      "focus-visible:outline-primary min-h-11 min-w-0 rounded-lg px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere] whitespace-normal text-gray-600 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base",
      active && "bg-primary hover:bg-primary/90 text-white",
    )}
    aria-pressed={active}
    {...otherProps}
  >
    <div>{children}</div>
  </button>
)

export default ConfigTabButton
