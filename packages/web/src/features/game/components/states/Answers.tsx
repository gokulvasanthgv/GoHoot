import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMediaType } from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
  SFX,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: { question, answers, media, time, totalPlayer, type, multiSelect, hideTextOnClient },
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()
  const isManager = !!useManagerStore((state) => state.gameId)
  const shouldHideText = !!hideTextOnClient && !isManager

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()

  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [puzzleItems, setPuzzleItems] = useState<
    { index: number; text: string }[]
  >([])

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  useEffect(() => {
    if (type === "puzzle") {
      setPuzzleItems(answers.map((text, index) => ({ index, text })))
    }
  }, [answers, type])

  const handleAnswer = (answerKey: number) => () => {
    if (!player || !gameId) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKey,
      },
    })
    sfxPop()
  }

  const handleToggle = (key: number) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
    sfxPop()
  }

  const movePuzzleItem = (index: number, direction: number) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= puzzleItems.length) return

    setPuzzleItems((prev) => {
      const items = [...prev]
      const [moved] = items.splice(index, 1)
      items.splice(nextIndex, 0, moved)
      return items
    })
    sfxPop()
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    setPuzzleItems((prev) => {
      const items = Array.from(prev)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reorderedItem)
      return items
    })
    sfxPop()
  }

  const handleSubmit = () => {
    if (!player || !gameId) {
      return
    }

    const answerKey =
      type === "puzzle" ? puzzleItems.map((item) => item.index) : selectedKeys

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKey,
      },
    })
    sfxPop()
  }

  useEffect(() => {
    const disabledMusicMedia = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ] as QuestionMediaType[]

    if (disabledMusicMedia.includes(media?.type)) {
      return
    }

    playMusic()

    return () => {
      stopMusic()
    }
    // oxlint-disable-next-line
  }, [playMusic])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const isMultiOrPuzzle = type === "puzzle" || multiSelect

  const getFontSizeClass = (len: number) => {
    if (len < 50) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold"
    if (len < 100) return "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold"
    return "text-sm sm:text-base md:text-lg lg:text-xl font-bold"
  }

  const maxAnswerLength = Math.max(...answers.map((a) => a.length))

  const getOptionFontSizeClass = (maxLen: number) => {
    if (maxLen < 20) return "text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl"
    if (maxLen < 45) return "text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl"
    if (maxLen < 75) return "text-[11px] sm:text-xs md:text-sm lg:text-base xl:text-lg"
    return "text-[10px] sm:text-[11px] md:text-xs lg:text-sm xl:text-base"
  }

  const optionFontSizeClass = getOptionFontSizeClass(maxAnswerLength)

  return (
    <div className="flex h-full flex-1 flex-col justify-between p-2 sm:p-4 select-none min-h-0">
      <div className={clsx("mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-2 px-4 min-h-0 shrink mb-2",
        (type === "puzzle" || !media) ? "shrink-0 py-1" : "flex-1"
      )}>
        <div className={clsx(
          "w-full overflow-y-auto px-2 shrink-0 flex items-center justify-center mb-1",
          type === "puzzle" ? "max-h-[15vh]" : (media ? "max-h-[18vh] sm:max-h-[22vh]" : "max-h-[35vh]")
        )}>
          <h2 className={clsx(
            "text-center text-white drop-shadow-lg leading-tight w-full break-words",
            getFontSizeClass(question.length)
          )}>
            {question}
          </h2>
        </div>

        {!shouldHideText && media && (
          <div className="max-h-[22vh] sm:max-h-[26vh] md:max-h-[30vh] flex items-center justify-center shrink min-h-0 overflow-hidden">
            <QuestionMedia media={media} alt={question} className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 h-0">
        <div className="mx-auto mb-2 sm:mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-sm sm:text-lg font-bold text-white md:text-xl shrink-0">
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-3 sm:px-4 text-xs sm:text-lg font-bold py-1">
            <span className="text-[10px] sm:text-sm text-gray-300">{t("game:hud.time")}</span>
            <span className="font-extrabold">{cooldown}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-3 sm:px-4 text-xs sm:text-lg font-bold py-1">
            <span className="text-[10px] sm:text-sm text-gray-300">
              {t("game:hud.answers")}
            </span>
            <span className="font-extrabold">
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        {type === "puzzle" ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="puzzle-droppable">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="mx-auto flex flex-1 flex-col gap-2 w-full max-w-2xl min-h-0 px-4 h-full pb-2 justify-between"
                >
                  {puzzleItems.map((item, index) => (
                    <Draggable key={item.index.toString()} draggableId={item.index.toString()} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            height: snapshot.isDragging 
                              ? (window.innerWidth < 640 ? '60px' : '72px')
                              : `calc((100% - ${(puzzleItems.length - 1) * 8}px) / ${puzzleItems.length})`,
                          }}
                          className={clsx(
                            "flex w-full items-center justify-between rounded-xl border border-white/20 bg-white/10 p-3 sm:p-5 text-white shadow-lg backdrop-blur-md select-none touch-manipulation",
                            !snapshot.isDragging && "transition-colors duration-150 hover:bg-white/15",
                            snapshot.isDragging && "bg-white/25 scale-[1.02] shadow-2xl border-white/30 cursor-grabbing"
                          )}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 pointer-events-none">
                            <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/20 text-sm sm:text-lg font-extrabold text-white">
                              {index + 1}
                            </span>
                            <span className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold">{item.text}</span>
                          </div>
                          <div className="flex gap-1.5 sm:gap-2 pointer-events-none opacity-60">
                            <svg className="size-6 sm:size-8 text-white fill-current" viewBox="0 0 24 24">
                              <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="mx-auto w-full gap-2 px-2 text-xl font-extrabold text-white sm:text-2xl md:text-3xl flex-1 grid grid-cols-2 auto-rows-fr h-0 pb-4 max-w-7xl">
            {answers.map((answer, key) => (
              <AnswerButton
                key={key}
                largeLabelOnly={shouldHideText}
                fontSizeClass={optionFontSizeClass}
                className={clsx(
                  ANSWERS_COLORS[key],
                  multiSelect &&
                    (selectedKeys.includes(key)
                      ? "opacity-100 ring-4 ring-white"
                      : "opacity-60"),
                )}
                label={ANSWERS_LABELS[key]}
                onClick={
                  multiSelect ? () => handleToggle(key) : handleAnswer(key)
                }
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex-1 pr-1 sm:pr-2">{answer}</span>
                  {multiSelect && selectedKeys.includes(key) && (
                    <svg
                      className="size-4 sm:size-5 shrink-0 fill-current stroke-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
              </AnswerButton>
            ))}
          </div>
        )}

        {isMultiOrPuzzle && (
          <div className="mx-auto my-2 sm:my-4 flex w-full max-w-md justify-center px-4 shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !multiSelect && type !== "puzzle"
                  ? false
                  : type === "puzzle"
                    ? false
                    : selectedKeys.length === 0
              }
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 sm:py-3 text-center text-sm sm:text-lg font-bold text-white shadow-lg shadow-emerald-500/20 transition duration-300 hover:from-emerald-600 hover:to-teal-600 active:scale-95 disabled:pointer-events-none disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 touch-manipulation"
            >
              {t("common:submit")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Answers
