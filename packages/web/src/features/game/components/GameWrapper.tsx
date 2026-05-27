import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import type { Status } from "@razzia/common/types/game/status"
import background from "@razzia/web/assets/background.png"
import Button from "@razzia/web/components/Button"
import Loader from "@razzia/web/components/Loader"
import AlertDialog from "@razzia/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { MANAGER_SKIP_BTN } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { type PropsWithChildren, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = PropsWithChildren & {
  statusName: Status | undefined
  onNext?: () => void
  onBack?: () => void
  manager?: boolean
}

const GameWrapper = ({
  children,
  statusName,
  onNext,
  onBack,
  manager,
}: Props) => {
  const { socket, isConnected } = useSocket()
  const {
    gameId,
    inviteCode,
    wallpaper: managerWallpaper,
    volume,
    isMuted,
    setVolume,
    setIsMuted,
  } = useManagerStore()
  const { player, wallpaper: playerWallpaper } = usePlayerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const activeWallpaper = manager ? managerWallpaper : playerWallpaper

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({
      current,
      total,
    })
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
    console.log(t(message))
    setIsDisabled(false)
  })

  useEffect(() => {
    setIsDisabled(false)
  }, [statusName])

  const handleNext = () => {
    if (statusName !== STATUS.SHOW_ROOM) {
      setIsDisabled(true)
    }
    onNext?.()
  }

  return (
    <section className="relative flex h-dvh w-full overflow-hidden">
      <div className="fixed top-0 left-0 h-full w-full">
        <img
          className="pointer-events-none h-full w-full object-cover select-none"
          src={activeWallpaper || background}
          alt="background"
        />
      </div>

      <div className="z-10 flex w-full flex-1 flex-col justify-between min-h-0 overflow-hidden">
        {!isConnected && !statusName ? (
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
            <Loader className="h-30" />
            <h1 className="text-4xl font-bold text-white">
              {t("common:connecting")}
            </h1>
          </div>
        ) : (
          <>
            <div className="flex w-full justify-between p-4">
              <div className="flex items-center gap-2">
                {manager &&
                  questionStates &&
                  questionStates.current > 1 &&
                  statusName !== STATUS.SELECT_ANSWER &&
                  statusName !== STATUS.SHOW_QUESTION && (
                    <Button
                      onClick={() => {
                        const index = questionStates.current - 2
                        socket.emit(EVENTS.MANAGER.GO_TO_QUESTION, {
                          gameId: gameId ?? "",
                          index,
                        })
                      }}
                      className="bg-white px-4 font-bold text-black hover:bg-gray-200"
                    >
                      ←
                    </Button>
                  )}
                {questionStates && (
                  <div className="flex items-center rounded-md bg-white p-2 px-4 text-lg font-bold text-black">
                    {`${questionStates.current} / ${questionStates.total}`}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {manager && (
                  <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm mr-2">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white hover:text-gray-200 active:scale-95 transition"
                    >
                      {isMuted ? (
                        <svg className="size-5 fill-current" viewBox="0 0 24 24">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                      ) : (
                        <svg className="size-5 fill-current" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => {
                        const newVol = parseFloat(e.target.value)
                        setVolume(newVol)
                        if (newVol > 0 && isMuted) {
                          setIsMuted(false)
                        }
                      }}
                      className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-white/30 accent-white outline-none"
                    />
                  </div>
                )}

                {manager && next && (
                  <Button
                    className={clsx(
                      "bg-white px-4 text-black hover:bg-gray-200",
                      {
                        "pointer-events-none": isDisabled,
                      },
                    )}
                    onClick={handleNext}
                  >
                    {t(next)}
                  </Button>
                )}

                {manager && onBack && (
                  <AlertDialog
                    trigger={
                      <Button className="bg-white px-4 text-black hover:bg-gray-200">
                        {t("common:exit")}
                      </Button>
                    }
                    title="Exit Lobby"
                    description="Are you sure you want to exit the lobby? This will cancel the game session."
                    confirmLabel="Exit"
                    onConfirm={onBack}
                  />
                )}
              </div>
            </div>

            {children}

            {manager &&
              statusName &&
              statusName !== STATUS.FINISHED &&
              statusName !== STATUS.SHOW_ROOM &&
              statusName !== STATUS.WAIT &&
              statusName !== STATUS.SHOW_START && (
                <div className="fixed bottom-4 right-4 z-50">
                  <AlertDialog
                    trigger={
                      <Button className="bg-red-600 px-4 font-bold text-white shadow-lg hover:bg-red-700 active:scale-95">
                        {t("game:endQuiz")}
                      </Button>
                    }
                    title="End Quiz"
                    description="Are you sure you want to end this quiz? This will stop the game for all participants."
                    confirmLabel="End Quiz"
                    onConfirm={() => {
                      socket.emit(EVENTS.MANAGER.END_GAME, {
                        gameId: gameId ?? "",
                      })
                    }}
                  />
                </div>
              )}

            {manager && inviteCode && (
              <div className="fixed bottom-4 left-4 z-50 rounded bg-black/60 px-3 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
                Game PIN: <span className="font-bold tracking-wider">{inviteCode}</span>
              </div>
            )}

            {!manager && (
              <div className="z-50 flex items-center justify-between bg-white px-4 py-2 text-lg font-bold text-white">
                <p className="text-gray-800">{player?.username}</p>
                <div className="rounded-lg bg-gray-800 px-3 py-1 text-lg">
                  {player?.points}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default GameWrapper
