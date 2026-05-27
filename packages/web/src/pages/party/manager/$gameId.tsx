import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS_MANAGER,
  MANAGER_SKIP_EVENTS,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { Trophy, Zap, Shuffle, Timer, Check, Settings, EyeOff } from "lucide-react"

const ManagerGamePage = () => {
  const navigate = useNavigate()
  const { gameId: gameIdParam } = useParams({ from: "/party/manager/$gameId" })
  const { socket } = useSocket()
  const { gameId, status, setGameId, setInviteCode, setStatus, setPlayers, reset, setWallpaper, setAudio } =
    useManagerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  const [showPreGameMenu, setShowPreGameMenu] = useState(false)
  const [gameMode, setGameMode] = useState<"classic" | "accuracy">("classic")
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [doubleTime, setDoubleTime] = useState(false)
  const [shuffleAnswers, setShuffleAnswers] = useState(false)
  const [hideTextOnClient, setHideTextOnClient] = useState(false)

  const confirmStartGame = () => {
    socket.emit(EVENTS.MANAGER.START_GAME, {
      gameId: gameId ?? "",
      mode: gameMode,
      options: {
        shuffleQuestions,
        doubleTime,
        shuffleAnswers,
        hideTextOnClient,
      },
    })
    setShowPreGameMenu(false)
  }

  useEvent(EVENTS.GAME.STATUS, ({ name, data, wallpaper, audio }) => {
    if (name in GAME_STATE_COMPONENTS_MANAGER) {
      setStatus(name, data)
      setWallpaper(wallpaper ?? null)
      setAudio(audio ?? null)
    }
  })

  useEffect(() => {
    if (socket.connected && gameIdParam && !status) {
      socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  }, [socket.connected, gameIdParam, socket, status])

  useEvent("connect", () => {
    if (gameIdParam) {
      socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  })

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      inviteCode: reconnectInviteCode,
      status: reconnectStatus,
      players,
      currentQuestion,
      wallpaper,
      audio,
    }) => {
      setGameId(reconnectGameId)
      if (reconnectInviteCode) {
        setInviteCode(reconnectInviteCode)
      }
      setStatus(reconnectStatus.name, reconnectStatus.data)
      setPlayers(players)
      setQuestionStates(currentQuestion)
      setWallpaper(wallpaper ?? null)
      setAudio(audio ?? null)
    },
  )

  useEvent(EVENTS.GAME.RESET, (message) => {
    navigate({ to: "/manager/config" })
    reset()
    setQuestionStates(null)
    toast.error(t(message))
  })

  const handleSkip = () => {
    if (!status) {
      return
    }

    if (status.name === STATUS.FINISHED) {
      navigate({ to: "/manager/config" })
      reset()
      setQuestionStates(null)

      return
    }

    if (!gameId) {
      return
    }

    if (status.name === STATUS.SHOW_ROOM) {
      setShowPreGameMenu(true)
      return
    }

    if (isKeyOf(MANAGER_SKIP_EVENTS, status.name)) {
      socket.emit(MANAGER_SKIP_EVENTS[status.name], { gameId })
    }
  }

  const handleBack = () => {
    navigate({ to: "/manager/config" })
    reset()
    setQuestionStates(null)
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS_MANAGER, status.name)
      ? GAME_STATE_COMPONENTS_MANAGER[status.name]
      : null

  if (!status) {
    return null
  }

  return (
    <>
      <GameWrapper
        statusName={status.name}
        onNext={handleSkip}
        onBack={status.name === STATUS.SHOW_ROOM ? handleBack : undefined}
        manager
      >
        {CurrentComponent && <CurrentComponent data={status.data as never} />}
      </GameWrapper>

      <AlertDialog.Root open={showPreGameMenu} onOpenChange={setShowPreGameMenu}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 outline-none">
            <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4 mb-5">
              <Settings className="size-6 text-indigo-600" />
              <AlertDialog.Title className="text-xl font-bold text-gray-900">
                Pre-Game Settings
              </AlertDialog.Title>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-3">
                  Game Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setGameMode("classic")}
                    className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                      gameMode === "classic"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <Zap className={`size-4 ${gameMode === "classic" ? "text-indigo-600" : "text-gray-400"}`} />
                        Classic Mode
                      </div>
                      {gameMode === "classic" && (
                        <Check className="size-4 text-indigo-600" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 leading-normal">
                      Faster answers get higher scores. Speed and accuracy matter!
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode("accuracy")}
                    className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                      gameMode === "accuracy"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <Trophy className={`size-4 ${gameMode === "accuracy" ? "text-indigo-600" : "text-gray-400"}`} />
                        Accuracy Mode
                      </div>
                      {gameMode === "accuracy" && (
                        <Check className="size-4 text-indigo-600" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 leading-normal">
                      Flat score (1000 pts) per correct answer. Same rank for matching scores.
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-3">
                  Additional Options
                </label>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-150 hover:bg-gray-55 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Shuffle className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Shuffle questions order</div>
                        <div className="text-xs text-gray-500">Play questions in a randomized sequence</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-150 hover:bg-gray-55 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Timer className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Double answering time</div>
                        <div className="text-xs text-gray-500">Provide twice the normal duration for each question</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={doubleTime}
                      onChange={(e) => setDoubleTime(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-150 hover:bg-gray-55 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Shuffle className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Shuffle options order</div>
                        <div className="text-xs text-gray-500">Randomize the order of answers/options for players</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={shuffleAnswers}
                      onChange={(e) => setShuffleAnswers(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-150 hover:bg-gray-55 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <EyeOff className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Hide questions on player screens</div>
                        <div className="text-xs text-gray-500">Players see only color option buttons without question text</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideTextOnClient}
                      onChange={(e) => setHideTextOnClient(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-7 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                onClick={confirmStartGame}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-600/10"
              >
                Start Game
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}

export const Route = createFileRoute("/party/manager/$gameId")({
  component: ManagerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.MANAGER.LEAVE, { gameId })
  },
})
