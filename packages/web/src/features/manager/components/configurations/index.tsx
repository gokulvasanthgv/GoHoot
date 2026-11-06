import type { PasswordResetRequest } from "@razzia/common/types/auth"
import { EVENTS } from "@razzia/common/constants"
import type { ManagerConfig } from "@razzia/common/types/manager"
import Card from "@razzia/web/components/Card"
import LanguageSwitcher from "@razzia/web/components/LanguageSwitcher"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import ConfigManageQuizz from "@razzia/web/features/manager/components/configurations/ConfigManageQuizz"
import ConfigResults from "@razzia/web/features/manager/components/configurations/ConfigResults"
import ConfigSelectQuizz from "@razzia/web/features/manager/components/configurations/ConfigSelectQuizz"
import ConfigSettings from "@razzia/web/features/manager/components/configurations/ConfigSettings"
import ConfigUsers from "@razzia/web/features/manager/components/configurations/ConfigUsers"
import ConfigTrash from "@razzia/web/features/manager/components/configurations/ConfigTrash"
import ConfigNavigation from "@razzia/web/features/manager/components/configurations/ConfigNavigation"
import { ConfigProvider } from "@razzia/web/features/manager/contexts/config-context"
import { LogOut, Bell, X } from "lucide-react"
import toast from "react-hot-toast"
import { useRef, useState, type ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@tanstack/react-router"

interface Props {
  data: ManagerConfig
}

const Configurations = ({ data }: Props) => {
  const [selectedTab, setSelectedTab] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [quizzFilter, setQuizzFilter] = useState<{
    creatorId: string
    username: string
  } | null>(null)
  const { reset } = useManagerStore()
  const { user, setUser } = useUserStore()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsList, setNotificationsList] = useState<
    PasswordResetRequest[]
  >(data.notifications ?? [])
  const [resettingReqId, setResettingReqId] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState("")

  useEvent("manager:notifications", (reqs) => {
    setNotificationsList(reqs)
  })

  useEvent("manager:adminPasswordResetSuccess", () => {
    toast.success("User password reset successful")
  })

  const handleDismissNotification = (requestId: string) => {
    socket.emit("manager:dismissNotification", { requestId })
    toast.success("Request dismissed")
  }

  const handleNotificationReset = (username: string) => {
    if (resetPasswordValue.length < 8) {
      toast.error("Password must be at least 8 characters")

      return
    }

    const userObj = data.users?.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    )

    if (userObj) {
      socket.emit(EVENTS.MANAGER.ADMIN_RESET_PASSWORD, {
        userId: userObj.id,
        newPassword: resetPasswordValue,
      })
      setResettingReqId(null)
      setResetPasswordValue("")
    } else {
      toast.error("User not found in system")
    }
  }

  const activeTabs: Array<{
    nameKey: string
    component: ComponentType<{
      quizzFilter?: { creatorId: string; username: string } | null
      onClearFilter?: () => void
      onOpenQuizzes?: (userId: string, username: string) => void
    }>
  }> = []

  if (user?.role === "admin") {
    activeTabs.push(
      { nameKey: "manager:tabs.play", component: ConfigSelectQuizz },
      { nameKey: "manager:tabs.quizz", component: ConfigManageQuizz },
      { nameKey: "manager:tabs.results", component: ConfigResults },
      { nameKey: "manager:tabs.trash", component: ConfigTrash },
      { nameKey: "manager:tabs.users", component: ConfigUsers },
      { nameKey: "manager:tabs.settings", component: ConfigSettings },
    )
  } else if (user?.role === "quizmaster") {
    activeTabs.push(
      { nameKey: "manager:tabs.play", component: ConfigSelectQuizz },
      { nameKey: "manager:tabs.quizz", component: ConfigManageQuizz },
      { nameKey: "manager:tabs.results", component: ConfigResults },
      { nameKey: "manager:tabs.trash", component: ConfigTrash },
    )
  } else if (user?.role === "analyst") {
    activeTabs.push({
      nameKey: "manager:tabs.results",
      component: ConfigResults,
    })
  }

  const activeIndex = Math.min(selectedTab, Math.max(0, activeTabs.length - 1))
  const TabComponent = activeTabs.at(activeIndex)?.component

  const handleLogout = () => {
    socket.emit(EVENTS.MANAGER.LOGOUT)
    setUser(null)
    reset()
  }

  return (
    <ConfigProvider data={data}>
      <Card className="w-full max-w-6xl min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">
              {t("manager:configurationsTitle")}
            </h1>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-medium [overflow-wrap:anywhere] text-gray-500">
                {user?.username}
              </span>
              <span className="bg-primary/10 rounded-full px-2 py-0.5 text-xs font-bold text-amber-800 capitalize">
                {user?.role}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              onClick={() => navigate({ to: "/" })}
              className="focus-visible:outline-primary flex min-h-11 items-center justify-center rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2"
              title="Join Game"
            >
              Join Game
            </button>
            <LanguageSwitcher />

            {user?.role === "admin" && (
              <div>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="focus-visible:outline-primary relative flex size-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2"
                  title="Notifications"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  aria-controls="reset-requests"
                >
                  <Bell className="size-4" />
                  {notificationsList.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-1 ring-white">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    id="reset-requests"
                    className="absolute top-full right-0 z-50 mt-3 max-h-[min(28rem,65dvh)] w-full max-w-sm overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                      <div>
                        <h2 className="text-sm font-bold text-gray-800">
                          Reset Requests
                        </h2>
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          {notificationsList.length} pending
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close notifications"
                        onClick={() => setShowNotifications(false)}
                        className="focus-visible:outline-primary flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {notificationsList.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">
                        No pending requests
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {notificationsList.map((req) => (
                          <div
                            key={req.id}
                            className="flex flex-col gap-2 rounded-lg bg-gray-50 p-2 text-xs"
                          >
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 font-bold [overflow-wrap:anywhere] text-gray-700">
                                {req.username}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(req.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            {resettingReqId === req.id ? (
                              <div className="mt-1 grid min-w-0 grid-cols-2 gap-2">
                                <input
                                  type="password"
                                  value={resetPasswordValue}
                                  onChange={(e) =>
                                    setResetPasswordValue(e.target.value)
                                  }
                                  placeholder="New password"
                                  aria-label={`New password for ${req.username}`}
                                  autoComplete="new-password"
                                  className="focus-visible:outline-primary col-span-2 min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
                                />
                                <button
                                  onClick={() =>
                                    handleNotificationReset(req.username)
                                  }
                                  className="min-h-11 rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white hover:bg-green-800"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setResettingReqId(null)
                                    setResetPasswordValue("")
                                  }}
                                  className="min-h-11 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setResettingReqId(req.id)
                                    setResetPasswordValue("")
                                  }}
                                  className="bg-primary/10 hover:bg-primary/20 min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-amber-800 transition"
                                >
                                  Reset Password
                                </button>
                                <button
                                  onClick={() =>
                                    handleDismissNotification(req.id)
                                  }
                                  className="min-h-11 flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
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
              className="focus-visible:outline-primary flex size-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={handleLogout}
              title={t("manager:logout")}
              aria-label={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <ConfigNavigation
          tabs={activeTabs}
          activeIndex={activeIndex}
          onSelect={(index, fromMobileMenu) => {
            setSelectedTab(index)

            if (fromMobileMenu) {
              requestAnimationFrame(() => {
                contentRef.current?.scrollIntoView({ block: "start" })
              })
            }
          }}
        />
        <hr className="my-5 text-gray-100" />
        <div ref={contentRef} className="flex min-w-0 scroll-mt-20 flex-col">
          {TabComponent && (
            <TabComponent
              quizzFilter={quizzFilter}
              onClearFilter={() => setQuizzFilter(null)}
              onOpenQuizzes={(userId: string, username: string) => {
                const quizIdx = activeTabs.findIndex(
                  (tab) => tab.nameKey === "manager:tabs.quizz",
                )

                if (quizIdx !== -1) {
                  setQuizzFilter({ creatorId: userId, username })
                  setSelectedTab(quizIdx)
                }
              }}
            />
          )}
        </div>
      </Card>
    </ConfigProvider>
  )
}

export default Configurations
