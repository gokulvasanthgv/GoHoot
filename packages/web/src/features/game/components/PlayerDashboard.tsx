import type { AttendedQuiz, GameResult } from "@razzia/common/types/game"
import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import PinInput from "@razzia/web/components/PinInput"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { useNavigate } from "@tanstack/react-router"
import {
  LogOut,
  LayoutDashboard,
  Play,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Award,
  History,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  Lock,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "motion/react"
import ResultModal from "@razzia/web/features/manager/components/ResultModal"
import toast from "react-hot-toast"
import { joinGame } from "@razzia/web/features/manager/queries"

const PlayerDashboard = () => {
  const { socket } = useSocket()
  const { user, setUser } = useUserStore()
  const { join, reset } = usePlayerStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<
    "join" | "performance" | "profile"
  >("join")
  const [invitation, setInvitation] = useState("")
  const [attendedQuizzes, setAttendedQuizzes] = useState<AttendedQuiz[]>([])
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    socket.emit(EVENTS.RESULTS.PLAYER_DASHBOARD)
  }, [socket])

  useEvent(EVENTS.RESULTS.PLAYER_DASHBOARD_DATA, (data) => {
    setAttendedQuizzes(data.attended)
  })

  useEvent(EVENTS.RESULTS.DATA, (data) => {
    setSelectedResult(data)
  })

  useEvent("manager:passwordChanged", (res) => {
    if (res.success) {
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } else {
      toast.error(t(res.error ?? "errors:api.serverError"))
    }
  })

  const handleOpenReport = (id: string) => {
    socket.emit(EVENTS.RESULTS.GET, id)
  }

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required")

      return
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")

      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")

      return
    }

    socket.emit(EVENTS.MANAGER.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    })
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (payload) => {
    const gameId = typeof payload === "string" ? payload : payload.gameId
    join(gameId)
    void joinGame(invitation.replace(/\s/gu, ""), user?.username ?? "")
      .then(({ ticket }) => {
        if (ticket) {
          socket.emit(EVENTS.PLAYER.LOGIN, { ticket })
        } else {
          navigate({ to: "/party/$gameId", params: { gameId } })
        }
      })
      .catch((failure: unknown) =>
        toast.error(
          t(
            failure instanceof Error
              ? failure.message
              : "errors:api.serverError",
          ),
        ),
      )
  })

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (gameId) => {
    void navigate({ to: "/party/$gameId", params: { gameId } })
  })

  const handleJoin = () => {
    if (invitation.trim()) {
      socket.emit(EVENTS.PLAYER.JOIN, invitation.replace(/\s/gu, ""))
    }
  }

  const handleLogout = () => {
    socket.emit(EVENTS.MANAGER.LOGOUT)
    setUser(null)
    reset()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)

    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-gray-50/90 shadow-xl backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800">GoHoot</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {user?.username}
            </span>
            <span className="text-primary bg-primary/10 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold capitalize">
              {user?.role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && user.role !== "quizzer" && (
            <button
              onClick={() => navigate({ to: "/manager/config" })}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
            >
              <LayoutDashboard className="size-3.5" />
              {t("manager:configurationsTitle") || "Host Panel"}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            title="Logout"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-gray-100 bg-gray-100/50 p-1">
        <button
          onClick={() => setActiveTab("join")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === "join"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Play className="size-4" />
          {t("game:joinTab", "Join")}
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === "performance"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Award className="size-4" />
          {t("game:performanceTab", "Performance")}
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === "profile"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <User className="size-4" />
          {t("game:profileTab", "Profile")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === "join" ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col items-center justify-center gap-4"
            >
              <Card className="w-full max-w-sm border border-gray-100 p-6 shadow-md">
                <p className="mb-4 text-center font-bold text-gray-600">
                  {t("game:pinLabel") || "Enter Game PIN to join live session"}
                </p>
                <PinInput value={invitation} onChange={setInvitation} />
                <Button
                  className="mt-6 flex w-full items-center justify-center gap-2 shadow-md"
                  onClick={handleJoin}
                >
                  {t("common:submit") || "Join Room"}
                  <ArrowRight className="size-4.5" />
                </Button>
              </Card>
            </motion.div>
          ) : activeTab === "performance" ? (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {attendedQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition duration-200 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-800">
                        {quiz.subject}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs font-medium text-gray-400">
                        <History className="size-3.5" />
                        <span>{formatDate(quiz.date)}</span>
                        <span>•</span>
                        <span>
                          {quiz.mode === "accuracy" ? "Accuracy" : "Classic"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-400">
                          Score
                        </p>
                        <p className="text-sm font-bold text-gray-700">
                          {quiz.points} pts
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-400">
                          Rank
                        </p>
                        <p className="text-primary text-sm font-bold">
                          #{quiz.rank}/{quiz.totalPlayers}
                        </p>
                      </div>
                    </div>

                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:border-l sm:border-gray-100 sm:pl-3">
                      <button
                        onClick={() => handleOpenReport(quiz.id)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100"
                      >
                        <Award className="size-3" />
                        Report
                      </button>
                      <button
                        disabled={!quiz.quizzId}
                        onClick={() =>
                          navigate({
                            to: "/party/solo/$quizzId",
                            params: { quizzId: quiz.quizzId ?? "" },
                          })
                        }
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-green-700"
                      >
                        <Play className="size-3" />
                        Solo
                      </button>
                      <button
                        onClick={() =>
                          setExpandedQuizId(
                            expandedQuizId === quiz.id ? null : quiz.id,
                          )
                        }
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      >
                        {expandedQuizId === quiz.id ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedQuizId === quiz.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
                      >
                        <div className="space-y-3 p-4">
                          <p className="mb-2 flex items-center gap-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
                            <Info className="size-3.5" />
                            Question Breakdown
                          </p>
                          {quiz.questions.map((q, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3"
                            >
                              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-snug font-semibold text-gray-700">
                                  {q.question}
                                </p>
                                <p className="mt-1 truncate text-xs text-gray-400">
                                  Your selection:{" "}
                                  <span className="font-semibold text-gray-600">
                                    {q.selectedAnswers &&
                                    q.selectedAnswers.length > 0
                                      ? q.selectedAnswers
                                          .map(
                                            (ansIdx: number) =>
                                              q.answers?.[ansIdx] || ansIdx,
                                          )
                                          .join(", ")
                                      : "None"}
                                  </span>
                                </p>
                              </div>
                              <div className="mt-0.5 ml-2 shrink-0">
                                {q.correct ? (
                                  <CheckCircle2 className="size-5 fill-green-50 text-green-500" />
                                ) : (
                                  <XCircle className="size-5 fill-red-50 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {attendedQuizzes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Award className="mb-3 size-12 text-gray-200" />
                  <p className="font-medium text-gray-500">
                    No attended quizzes yet
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Join live rooms or complete private sessions
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col items-center justify-center gap-4"
            >
              <Card className="w-full max-w-sm rounded-xl border border-gray-100 bg-white p-6 shadow-md">
                <h3 className="mb-4 text-center text-lg font-bold text-gray-800">
                  Change Password
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="focus:ring-primary/20 focus:border-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="focus:ring-primary/20 focus:border-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="focus:ring-primary/20 focus:border-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <Button
                    className="mt-2 flex w-full items-center justify-center gap-2 shadow-md"
                    onClick={handleChangePassword}
                  >
                    <Lock className="size-4" />
                    Save Password
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  )
}

export default PlayerDashboard
