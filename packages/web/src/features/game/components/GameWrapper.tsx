import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import type { Status } from "@razzia/common/types/game/status"
import background from "@razzia/web/assets/background.png"
import Button from "@razzia/web/components/Button"
import Loader from "@razzia/web/components/Loader"
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
  const { gameId, inviteCode } = useManagerStore()
  const { player } = usePlayerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null

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
    <section className="relative flex min-h-dvh">
      <div className="fixed top-0 left-0 h-full w-full">
        <img
          className="pointer-events-none h-full w-full object-cover select-none"
          src={background}
          alt="background"
        />
      </div>

      <div className="z-10 flex w-full flex-1 flex-col justify-between">
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
                {manager && questionStates && questionStates.current > 1 && (
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
                  <Button
                    onClick={onBack}
                    className="bg-white px-4 text-black hover:bg-gray-200"
                  >
                    {t("common:exit")}
                  </Button>
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
                  <Button
                    onClick={() => {
                      socket.emit(EVENTS.MANAGER.END_GAME, {
                        gameId: gameId ?? "",
                      })
                    }}
                    className="bg-red-600 px-4 font-bold text-white shadow-lg hover:bg-red-700 active:scale-95"
                  >
                    {t("game:endQuiz")}
                  </Button>
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
