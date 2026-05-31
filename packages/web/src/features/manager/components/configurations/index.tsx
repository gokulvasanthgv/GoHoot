import { EVENTS } from "@razzia/common/constants"
import type { ManagerConfig } from "@razzia/common/types/manager"
import Card from "@razzia/web/components/Card"
import LanguageSwitcher from "@razzia/web/components/LanguageSwitcher"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import ConfigManageQuizz from "@razzia/web/features/manager/components/configurations/ConfigManageQuizz"
import ConfigResults from "@razzia/web/features/manager/components/configurations/ConfigResults"
import ConfigSelectQuizz from "@razzia/web/features/manager/components/configurations/ConfigSelectQuizz"
import ConfigSettings from "@razzia/web/features/manager/components/configurations/ConfigSettings"
import ConfigUsers from "@razzia/web/features/manager/components/configurations/ConfigUsers"
import ConfigTrash from "@razzia/web/features/manager/components/configurations/ConfigTrash"
import ConfigTabButton from "@razzia/web/features/manager/components/configurations/ConfigTabButton"
import { ConfigProvider } from "@razzia/web/features/manager/contexts/config-context"
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@tanstack/react-router"

interface Props {
  data: ManagerConfig
}

const Configurations = ({ data }: Props) => {
  const [selectedTab, setSelectedTab] = useState(0)
  const [quizzFilter, setQuizzFilter] = useState<{ creatorId: string; username: string } | null>(null)
  const { reset } = useManagerStore()
  const { user, setUser } = useUserStore()
  const { socket } = useSocket()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const tabsRef = useRef<HTMLDivElement>(null)

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      const scrollAmount = 150
      tabsRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  const activeTabs: { nameKey: string; component: any }[] = []
  if (user?.role === "admin") {
    activeTabs.push(
      { nameKey: "manager:tabs.play", component: ConfigSelectQuizz },
      { nameKey: "manager:tabs.quizz", component: ConfigManageQuizz },
      { nameKey: "manager:tabs.results", component: ConfigResults },
      { nameKey: "manager:tabs.trash", component: ConfigTrash },
      { nameKey: "manager:tabs.users", component: ConfigUsers },
      { nameKey: "manager:tabs.settings", component: ConfigSettings }
    )
  } else if (user?.role === "quizmaster") {
    activeTabs.push(
      { nameKey: "manager:tabs.play", component: ConfigSelectQuizz },
      { nameKey: "manager:tabs.quizz", component: ConfigManageQuizz },
      { nameKey: "manager:tabs.results", component: ConfigResults },
      { nameKey: "manager:tabs.trash", component: ConfigTrash }
    )
  } else if (user?.role === "analyst") {
    activeTabs.push(
      { nameKey: "manager:tabs.results", component: ConfigResults }
    )
  }

  useEffect(() => {
    if (selectedTab >= activeTabs.length) {
      setSelectedTab(0)
    }
  }, [activeTabs.length, selectedTab])

  const TabComponent = activeTabs[selectedTab]?.component || (() => null)

  const handleSelect = (index: number) => () => {
    setSelectedTab(index)
  }

  const handleLogout = () => {
    socket.emit(EVENTS.MANAGER.LOGOUT)
    setUser(null)
    reset()
  }

  return (
    <ConfigProvider data={data}>
      <Card className="max-h-[80svh] w-full max-w-md">
        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <p className="text-lg font-semibold">
              {t("manager:configurationsTitle")}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500 font-medium">{user?.username}</span>
              <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold text-primary bg-primary/10 rounded-full capitalize">
                {user?.role}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              title="Join Game"
            >
              Join Game
            </button>
            <LanguageSwitcher />
            <button
              className="rounded-sm p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
              onClick={handleLogout}
              title={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <div className="relative flex items-center shrink-0 w-full">
          <button
            onClick={() => scrollTabs("left")}
            className="absolute left-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 focus:outline-none transition active:scale-95"
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          
          <div
            ref={tabsRef}
            className="flex-1 flex overflow-x-auto rounded-md border border-gray-200 bg-gray-100 p-0.5 scrollbar-none scroll-smooth mx-8"
          >
            {activeTabs.map((tab, index) => (
              <ConfigTabButton
                key={tab.nameKey}
                active={index === selectedTab}
                onClick={handleSelect(index)}
              >
                {i18n.exists(tab.nameKey) ? t(tab.nameKey) : tab.nameKey.split(".").pop()}
              </ConfigTabButton>
            ))}
          </div>

          <button
            onClick={() => scrollTabs("right")}
            className="absolute right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 focus:outline-none transition active:scale-95"
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <hr className="my-4 text-gray-100" />
        <div className="flex min-h-0 flex-1 flex-col">
          <TabComponent
            quizzFilter={quizzFilter}
            onClearFilter={() => setQuizzFilter(null)}
            onOpenQuizzes={(userId: string, username: string) => {
              const quizIdx = activeTabs.findIndex((t) => t.nameKey === "manager:tabs.quizz")
              if (quizIdx !== -1) {
                setQuizzFilter({ creatorId: userId, username })
                setSelectedTab(quizIdx)
              }
            }}
          />
        </div>
      </Card>
    </ConfigProvider>
  )
}

export default Configurations
