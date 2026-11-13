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
import { AlertDialog } from "radix-ui"
import {
  Trophy,
  Zap,
  Shuffle,
  Timer,
  Check,
  Settings,
  EyeOff,
} from "lucide-react"

const ManagerGamePage = () => {
  const navigate = useNavigate()
  const { gameId: gameIdParam } = useParams({ from: "/party/manager/$gameId" })
  const { socket, isConnected } = useSocket()
  const {
    gameId,
    status,
    reset,
    restoreGame,
    applyGameStatus,
    applyGameSettings,
  } = useManagerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  const [showPreGameMenu, setShowPreGameMenu] = useState(false)
  const [gameMode, setGameMode] = useState<"classic" | "accuracy">("classic")
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [doubleTime, setDoubleTime] = useState(false)
  const [shuffleAnswers, setShuffleAnswers] = useState(false)
  const [hideTextOnClient, setHideTextOnClient] = useState(false)
  useEvent(EVENTS.GAME.SETTINGS, (settings) => {
    if (settings.gameId === gameIdParam) {
      applyGameSettings(settings)
    }
  })

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

  useEvent(EVENTS.GAME.STATUS, (update) => {
    if (
      update.gameId === gameIdParam &&
      update.name in GAME_STATE_COMPONENTS_MANAGER
    ) {
      applyGameStatus(update)
    }
  })

  useEvent(EVENTS.MANAGER.SUCCESS_RECONNECT, (game) => {
    if (game.gameId === gameIdParam) {
      restoreGame(game)
      setQuestionStates(game.currentQuestion)
    }
  })

  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  }, [isConnected, gameIdParam, socket])

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

  if (!status || gameId !== gameIdParam) {
    return <GameWrapper statusName={undefined} manager />
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

      <AlertDialog.Root
        open={showPreGameMenu}
        onOpenChange={setShowPreGameMenu}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
          <AlertDialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl outline-none"
          >
            <div className="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-4 py-3 sm:px-6">
              <Settings className="size-6 text-indigo-600" />
              <AlertDialog.Title className="text-xl font-bold text-gray-900">
                Pre-Game Settings
              </AlertDialog.Title>
            </div>

            <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div>
                <label className="mb-3 block text-sm font-semibold text-gray-700">
                  Game Mode
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={gameMode === "classic"}
                    onClick={() => setGameMode("classic")}
                    className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      gameMode === "classic"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="mb-1 flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <Zap
                          className={`size-4 ${gameMode === "classic" ? "text-indigo-600" : "text-gray-400"}`}
                        />
                        Classic Mode
                      </div>
                      {gameMode === "classic" && (
                        <Check className="size-4 text-indigo-600" />
                      )}
                    </div>
                    <span className="text-xs leading-normal text-gray-500">
                      Faster answers get higher scores. Speed and accuracy
                      matter!
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={gameMode === "accuracy"}
                    onClick={() => setGameMode("accuracy")}
                    className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      gameMode === "accuracy"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="mb-1 flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <Trophy
                          className={`size-4 ${gameMode === "accuracy" ? "text-indigo-600" : "text-gray-400"}`}
                        />
                        Accuracy Mode
                      </div>
                      {gameMode === "accuracy" && (
                        <Check className="size-4 text-indigo-600" />
                      )}
                    </div>
                    <span className="text-xs leading-normal text-gray-500">
                      Flat score (1000 pts) per correct answer. Same rank for
                      matching scores.
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-semibold text-gray-700">
                  Additional Options
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5 select-none hover:bg-indigo-50/20 sm:flex-col sm:items-stretch">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-indigo-50 p-2">
                        <Shuffle className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm leading-tight font-semibold text-gray-900">
                          Shuffle questions
                        </div>
                        <div className="mt-1 text-xs leading-snug text-gray-500">
                          Play questions in a randomized sequence
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="size-4.5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5 select-none hover:bg-indigo-50/20 sm:flex-col sm:items-stretch">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-indigo-50 p-2">
                        <Timer className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm leading-tight font-semibold text-gray-900">
                          Double time
                        </div>
                        <div className="mt-1 text-xs leading-snug text-gray-500">
                          Provide twice the normal duration for each question
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <input
                        type="checkbox"
                        checked={doubleTime}
                        onChange={(e) => setDoubleTime(e.target.checked)}
                        className="size-4.5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5 select-none hover:bg-indigo-50/20 sm:flex-col sm:items-stretch">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-indigo-50 p-2">
                        <Shuffle className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm leading-tight font-semibold text-gray-900">
                          Shuffle options
                        </div>
                        <div className="mt-1 text-xs leading-snug text-gray-500">
                          Randomize the order of answers/options for players
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <input
                        type="checkbox"
                        checked={shuffleAnswers}
                        onChange={(e) => setShuffleAnswers(e.target.checked)}
                        className="size-4.5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5 select-none hover:bg-indigo-50/20 sm:flex-col sm:items-stretch">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-indigo-50 p-2">
                        <EyeOff className="size-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm leading-tight font-semibold text-gray-900">
                          Hide questions
                        </div>
                        <div className="mt-1 text-xs leading-snug text-gray-500">
                          Players see only color option buttons without question
                          text
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <input
                        type="checkbox"
                        checked={hideTextOnClient}
                        onChange={(e) => setHideTextOnClient(e.target.checked)}
                        className="size-4.5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-2 sm:px-6">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={confirmStartGame}
                className="min-h-11 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
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
