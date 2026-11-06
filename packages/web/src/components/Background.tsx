import logo from "@razzia/web/assets/gohoot-logo.webp"
import GithubIcon from "@razzia/web/components/GithubIcon"
import type { PropsWithChildren } from "react"

type Props = PropsWithChildren<{
  variant?: "default" | "dashboard"
}>

const Background = ({ children, variant = "default" }: Props) => (
  <section
    className={
      variant === "dashboard"
        ? "relative flex min-h-dvh min-w-0 flex-col items-center gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6"
        : "relative flex min-h-dvh flex-col items-center justify-center"
    }
  >
    <div className="pointer-events-none absolute h-full max-h-svh w-full overflow-hidden">
      <div className="bg-primary/15 absolute top-[-70vmin] left-[-50vmin] min-h-[120vmin] min-w-[120vmin] rotate-20 rounded-4xl" />
      <div className="bg-primary/15 absolute right-[-10vmin] bottom-[-45vmin] min-h-[75vmin] min-w-[75vmin] rotate-20 rounded-4xl" />
    </div>

    <img
      src={logo}
      className={
        variant === "dashboard"
          ? "relative z-10 h-10 max-w-full shrink-0 sm:h-12"
          : "mb-10 h-16"
      }
      alt="logo"
    />
    {children}

    <a
      href="https://github.com/gokulvasanthgv/GoHoot"
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === "dashboard"
          ? "relative z-10 mt-auto flex shrink-0 items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors hover:text-white/80"
          : "absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors hover:text-white/80"
      }
    >
      <GithubIcon size={14} />
      GoHoot - v{__APP_VERSION__}
    </a>
  </section>
)

export default Background
