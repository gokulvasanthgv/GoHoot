import { EVENTS } from "@razzia/common/constants"
import { STATUS, type Status } from "@razzia/common/types/game/status"
import background from "@razzia/web/assets/background.png"
import Button from "@razzia/web/components/Button"
import GameAudioControls from "@razzia/web/features/game/components/GameAudioControls"
import Loader from "@razzia/web/components/Loader"
import AlertDialog from "@razzia/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { GameScreenContext } from "@razzia/web/features/game/contexts/game-screen-context"
import { MANAGER_SKIP_BTN } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { ChevronLeft, X } from "lucide-react"
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
  const { socket } = useSocket()
  const { gameId, inviteCode, wallpaper: managerWallpaper } = useManagerStore()
  const { player, wallpaper: playerWallpaper } = usePlayerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const [resizeNoticeDismissed, setResizeNoticeDismissed] = useState(false)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const activeWallpaper = manager ? managerWallpaper : playerWallpaper
  const dockFooter =
    statusName === STATUS.SELECT_ANSWER || statusName === STATUS.FINISHED
  const scrollStage = dockFooter || statusName === STATUS.SHOW_QUESTION
  const canEndQuiz =
    statusName &&
    statusName !== STATUS.FINISHED &&
    statusName !== STATUS.SHOW_ROOM &&
    statusName !== STATUS.WAIT &&
    statusName !== STATUS.SHOW_START

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
    <GameScreenContext.Provider value={manager ? "manager" : "player"}>
      <section
        data-conductor={manager ? "" : undefined}
        className="relative flex h-dvh w-full overflow-hidden bg-slate-950"
      >
        {statusName && (
          <div
            data-game-wallpaper=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <img
              className="h-full w-full object-cover select-none"
              src={activeWallpaper || background}
              alt=""
            />
            <div className="absolute inset-0 bg-black opacity-65" />
          </div>
        )}

        {manager && !resizeNoticeDismissed && (
          <aside className="conductor-resize-notice absolute inset-x-2 top-1/2 z-50 mx-auto w-fit max-w-[calc(100%-1rem)] -translate-y-1/2 items-center gap-2 rounded-xl border border-white/20 bg-slate-950 px-3 py-1 text-sm text-white shadow-xl">
            <p role="status">{t("game:resizeWindow")}</p>
            <button
              type="button"
              aria-label={t("game:dismissResizeNotice")}
              onClick={() => setResizeNoticeDismissed(true)}
              className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-2"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </aside>
        )}

        <div className="z-10 flex min-h-0 w-full flex-1 flex-col justify-between overflow-hidden">
          {!statusName ? (
            <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
              <Loader className="h-30" />
              <h1 className="text-4xl font-bold text-white">
                {t("common:connecting")}
              </h1>
            </div>
          ) : (
            <>
              <header className="conductor-compact:shrink-0 conductor-compact:flex-wrap conductor-compact:items-center conductor-compact:gap-1.5 conductor-compact:p-2 flex w-full justify-between p-4">
                <div className="conductor-compact:gap-1.5 flex items-center gap-2">
                  {manager &&
                    questionStates &&
                    questionStates.current > 1 &&
                    statusName !== STATUS.SELECT_ANSWER &&
                    statusName !== STATUS.SHOW_QUESTION && (
                      <Button
                        aria-label={t("quizz:editor.previousQuestion")}
                        onClick={() => {
                          const index = questionStates.current - 2
                          socket.emit(EVENTS.MANAGER.GO_TO_QUESTION, {
                            gameId: gameId ?? "",
                            index,
                          })
                        }}
                        className="conductor-compact:size-11 conductor-compact:px-1 bg-white px-4 font-bold text-black hover:bg-gray-200"
                      >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                      </Button>
                    )}
                  {questionStates && (
                    <div className="conductor-compact:px-2 conductor-compact:text-sm flex items-center rounded-md bg-white p-2 px-4 text-lg font-bold text-black">
                      {`${questionStates.current} / ${questionStates.total}`}
                    </div>
                  )}
                </div>

                <div className="conductor-compact:ml-auto conductor-compact:min-w-0 conductor-compact:flex-wrap conductor-compact:justify-end conductor-compact:gap-1.5 flex items-center gap-2">
                  <GameAudioControls />

                  {manager && next && (
                    <Button
                      className={clsx(
                        "conductor-compact:min-h-11 conductor-compact:px-2.5 conductor-compact:text-base bg-white px-4 text-black hover:bg-gray-200",
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
                        <Button className="conductor-compact:min-h-11 conductor-compact:px-2.5 conductor-compact:text-base bg-white px-4 text-black hover:bg-gray-200">
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
              </header>

              {manager ? (
                <>
                  <main
                    key={statusName}
                    className={clsx(
                      "flex min-h-0 w-full flex-1 flex-col",
                      scrollStage
                        ? "overflow-x-hidden overflow-y-auto overscroll-y-contain"
                        : "conductor-compact:overflow-x-hidden conductor-compact:overflow-y-auto conductor-compact:overscroll-y-contain",
                      statusName === STATUS.SELECT_ANSWER && "scroll-pt-12",
                    )}
                  >
                    {children}
                  </main>
                  {(inviteCode || canEndQuiz) && (
                    <footer
                      className={clsx(
                        dockFooter
                          ? "mx-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-2 sm:px-4"
                          : "conductor-compact:flex conductor-compact:shrink-0 conductor-compact:flex-wrap conductor-compact:items-center conductor-compact:justify-between conductor-compact:gap-2 conductor-compact:px-2 conductor-compact:pt-1 conductor-compact:pb-2 contents",
                        statusName === STATUS.SHOW_ROOM &&
                          "conductor-compact:hidden",
                      )}
                    >
                      {inviteCode && (
                        <div
                          className={clsx(
                            "rounded bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-sm",
                            !dockFooter &&
                              "conductor-compact:static conductor-compact:z-auto fixed bottom-4 left-4 z-50",
                          )}
                        >
                          {t("game:gamePinLabel")}{" "}
                          <span className="font-bold tracking-wider">
                            {inviteCode}
                          </span>
                        </div>
                      )}
                      {canEndQuiz && (
                        <div
                          className={
                            dockFooter
                              ? "ml-auto"
                              : "conductor-compact:static conductor-compact:z-auto conductor-compact:ml-auto fixed right-4 bottom-4 z-50"
                          }
                        >
                          <AlertDialog
                            trigger={
                              <Button className="conductor-compact:min-h-11 conductor-compact:px-3 conductor-compact:text-base bg-red-600 px-4 font-bold text-white shadow-lg hover:bg-red-700 active:scale-95">
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
                    </footer>
                  )}
                </>
              ) : (
                children
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
    </GameScreenContext.Provider>
  )
}

export default GameWrapper
