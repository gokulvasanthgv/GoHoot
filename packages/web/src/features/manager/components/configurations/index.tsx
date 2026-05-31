import { EVENTS } from "@razzia/common/constants"
import type { ManagerConfig } from "@razzia/common/types/manager"
import Card from "@razzia/web/components/Card"
import LanguageSwitcher from "@razzia/web/components/LanguageSwitcher"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
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
import { LogOut, ChevronLeft, ChevronRight, Bell } from "lucide-react"
import toast from "react-hot-toast"
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

  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsList, setNotificationsList] = useState<any[]>(data.notifications || [])
  const [resettingReqId, setResettingReqId] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState("")

  useEvent("manager:notifications", (reqs: any[]) => {
    setNotificationsList(reqs)
  })

  useEvent("manager:adminPasswordResetSuccess", () => {
    toast.success("User password reset successful")
  })

  const handleDismissNotification = (requestId: string) => {
    socket.emit("manager:dismissNotification", { requestId })
    toast.success("Request dismissed")
  }

  const handleNotificationReset = (username: string, requestId: string) => {
    if (resetPasswordValue.length < 4) {
      toast.error("Password must be at least 4 characters")
      return
    }
    const userObj = data.users?.find(u => u.username.toLowerCase() === username.toLowerCase())
    if (userObj) {
      socket.emit(EVENTS.MANAGER.ADMIN_RESET_PASSWORD, { userId: userObj.id, newPassword: resetPasswordValue })
      setResettingReqId(null)
      setResetPasswordValue("")
    } else {
      toast.error("User not found in system")
    }
  }

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

            {user?.role === "admin" && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative rounded-sm p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="size-4" />
                  {notificationsList.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-1 ring-white">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-lg bg-white shadow-xl ring-1 ring-black/5 z-50 p-4 border border-gray-100 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                      <h4 className="font-bold text-gray-800 text-sm">Reset Requests</h4>
                      <span className="text-xs text-gray-400 font-medium">{notificationsList.length} pending</span>
                    </div>
                    {notificationsList.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No pending requests</p>
                    ) : (
                      <div className="space-y-3">
                        {notificationsList.map((req) => (
                          <div key={req.id} className="flex flex-col gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-700">{req.username}</span>
                              <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleTimeString()}</span>
                            </div>
                            {resettingReqId === req.id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="password"
                                  value={resetPasswordValue}
                                  onChange={(e) => setResetPasswordValue(e.target.value)}
                                  placeholder="New password"
                                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-[10px] bg-white focus:outline-none"
                                />
                                <button
                                  onClick={() => handleNotificationReset(req.username, req.id)}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setResettingReqId(null)
                                    setResetPasswordValue("")
                                  }}
                                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-medium"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-end mt-1">
                                <button
                                  onClick={() => {
                                    setResettingReqId(req.id)
                                    setResetPasswordValue("")
                                  }}
                                  className="px-2 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition"
                                >
                                  Reset Pass
                                </button>
                                <button
                                  onClick={() => handleDismissNotification(req.id)}
                                  className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
