import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import PinInput from "@razzia/web/components/PinInput"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { useNavigate } from "@tanstack/react-router"
import { LogOut, LayoutDashboard, Play, CheckCircle2, XCircle, ArrowRight, Award, History, Info, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "motion/react"
import ResultModal from "@razzia/web/features/manager/components/ResultModal"

const PlayerDashboard = () => {
  const { socket } = useSocket()
  const { user, setUser } = useUserStore()
  const { join, reset } = usePlayerStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<"join" | "performance">("join")
  const [invitation, setInvitation] = useState("")
  const [attendedQuizzes, setAttendedQuizzes] = useState<any[]>([])
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)

  useEffect(() => {
    socket.emit(EVENTS.RESULTS.PLAYER_DASHBOARD)
  }, [socket])

  useEvent(EVENTS.RESULTS.PLAYER_DASHBOARD_DATA, (data) => {
    if (data && data.attended) {
      setAttendedQuizzes(data.attended)
    }
  })

  useEvent(EVENTS.RESULTS.DATA, (data) => {
    setSelectedResult(data)
  })

  const handleOpenReport = (id: string) => {
    socket.emit(EVENTS.RESULTS.GET, id)
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (payload) => {
    const gameId = typeof payload === "string" ? payload : payload.gameId
    join(gameId)
    socket.emit(EVENTS.PLAYER.LOGIN, {
      gameId,
      data: { username: user?.username || "" }
    })
    navigate({ to: "/party/$gameId", params: { gameId } })
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
    <div className="flex flex-col h-full w-full max-w-lg mx-auto bg-gray-50/90 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800">GoHoot</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500 font-medium">{user?.username}</span>
            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-primary bg-primary/10 rounded-full capitalize">
              {user?.role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && user.role !== "quizzer" && (
            <button
              onClick={() => navigate({ to: "/manager/config" })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <LayoutDashboard className="size-3.5" />
              {t("manager:configurationsTitle") || "Host Panel"}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition"
            title="Logout"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>

      <div className="flex bg-gray-100/50 p-1 border-b border-gray-100 shrink-0">
        <button
          onClick={() => setActiveTab("join")}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all flex-none flex items-center justify-center gap-1.5 ${
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
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all flex-none flex items-center justify-center gap-1.5 ${
            activeTab === "performance"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Award className="size-4" />
          {t("game:performanceTab", "Performance")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === "join" ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <Card className="w-full max-w-sm p-6 shadow-md border border-gray-100">
                <p className="mb-4 text-center font-bold text-gray-600">
                  {t("game:pinLabel") || "Enter Game PIN to join live session"}
                </p>
                <PinInput value={invitation} onChange={setInvitation} />
                <Button className="mt-6 w-full shadow-md flex items-center justify-center gap-2" onClick={handleJoin}>
                  {t("common:submit") || "Join Room"}
                  <ArrowRight className="size-4.5" />
                </Button>
              </Card>
            </motion.div>
          ) : (
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
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition duration-200"
                >
                  <div className="flex items-center justify-between p-4 flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-800 truncate">{quiz.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-medium">
                        <History className="size-3.5" />
                        <span>{formatDate(quiz.date)}</span>
                        <span>•</span>
                        <span>{quiz.mode === "accuracy" ? "Accuracy" : "Classic"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-400">Score</p>
                        <p className="text-sm font-bold text-gray-700">{quiz.points} pts</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-400">Rank</p>
                        <p className="text-sm font-bold text-primary">#{quiz.rank}/{quiz.totalPlayers}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto sm:border-l sm:border-gray-100 sm:pl-3 justify-end">
                      <button
                        onClick={() => handleOpenReport(quiz.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                      >
                        <Award className="size-3" />
                        Report
                      </button>
                      <button
                        onClick={() => navigate({ to: "/party/solo/$quizzId", params: { quizzId: quiz.quizzId } })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
                      >
                        <Play className="size-3" />
                        Solo
                      </button>
                      <button
                        onClick={() => setExpandedQuizId(expandedQuizId === quiz.id ? null : quiz.id)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition"
                      >
                        {expandedQuizId === quiz.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
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
                        className="border-t border-gray-100 bg-gray-50/50 overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <Info className="size-3.5" />
                            Question Breakdown
                          </p>
                          {quiz.questions.map((q: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-lg">
                              <span className="flex items-center justify-center shrink-0 size-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-700 leading-snug">{q.question}</p>
                                <p className="text-xs text-gray-400 mt-1 truncate">
                                  Your selection:{" "}
                                  <span className="font-semibold text-gray-600">
                                    {q.selectedAnswers && q.selectedAnswers.length > 0
                                      ? q.selectedAnswers.map((ansIdx: number) => q.answers?.[ansIdx] || ansIdx).join(", ")
                                      : "None"}
                                  </span>
                                </p>
                              </div>
                              <div className="shrink-0 ml-2 mt-0.5">
                                {q.correct ? (
                                  <CheckCircle2 className="size-5 text-green-500 fill-green-50" />
                                ) : (
                                  <XCircle className="size-5 text-red-500 fill-red-50" />
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
                  <Award className="size-12 text-gray-200 mb-3" />
                  <p className="text-gray-500 font-medium">No attended quizzes yet</p>
                  <p className="text-xs text-gray-400 mt-1">Join live rooms or complete private sessions</p>
                </div>
              )}
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
