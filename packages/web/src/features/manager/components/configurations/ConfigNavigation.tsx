import ConfigTabButton from "@razzia/web/features/manager/components/configurations/ConfigTabButton"
import clsx from "clsx"
import { Menu, X } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  tabs: Array<{ nameKey: string }>
  activeIndex: number
  onSelect: (index: number, fromMobileMenu: boolean) => void
}

const ConfigNavigation = ({ tabs, activeIndex, onSelect }: Props) => {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const navigationRef = useRef<HTMLDivElement>(null)
  const { t, i18n } = useTranslation()
  const label = (nameKey: string) =>
    i18n.exists(nameKey) ? t(nameKey) : nameKey.split(".").pop()

  return (
    <div
      ref={navigationRef}
      className="sticky top-2 z-20 mt-5 rounded-xl border border-gray-200 bg-gray-100 p-1 lg:static"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation()
          setOpen(false)
          toggleRef.current?.focus()
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-label={t("manager:navigationMenu")}
        aria-expanded={open}
        aria-controls="configuration-sections"
        onClick={() => {
          setOpen(!open)

          if (!open) {
            requestAnimationFrame(() => {
              const navigation = navigationRef.current

              if (
                navigation &&
                navigation.getBoundingClientRect().bottom > window.innerHeight
              ) {
                navigation.scrollIntoView({ block: "start" })
              }
            })
          }
        }}
        className="focus-visible:outline-primary flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
      >
        {open ? (
          <X className="size-5 shrink-0" aria-hidden="true" />
        ) : (
          <Menu className="size-5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">
          {tabs[activeIndex] && label(tabs[activeIndex].nameKey)}
        </span>
        <span className="text-xs font-medium text-gray-500">
          {t("manager:menu")}
        </span>
      </button>
      <nav
        id="configuration-sections"
        aria-label={t("manager:configurationsTitle")}
        className={clsx(
          "mt-1 max-h-[calc(100dvh-6rem)] min-w-0 gap-1 overflow-y-auto lg:mt-0 lg:max-h-none lg:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] lg:overflow-visible",
          open ? "grid" : "hidden lg:grid",
        )}
      >
        {tabs.map((tab, index) => (
          <ConfigTabButton
            key={tab.nameKey}
            active={index === activeIndex}
            onClick={() => {
              onSelect(index, open)
              setOpen(false)

              if (open) {
                toggleRef.current?.focus()
              }
            }}
          >
            {label(tab.nameKey)}
          </ConfigTabButton>
        ))}
      </nav>
    </div>
  )
}

export default ConfigNavigation
