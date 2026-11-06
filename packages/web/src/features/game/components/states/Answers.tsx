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
import SortableList from "@razzia/web/components/SortableList"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: {
    question,
    answers,
    media,
    time,
    totalPlayer,
    type,
    multiSelect,
    hideTextOnClient,
  },
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()
  const isManager = Boolean(useManagerStore((state) => state.gameId))
  const shouldHideText = Boolean(hideTextOnClient) && !isManager

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()

  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [puzzleItems, setPuzzleItems] = useState<
    Array<{ id: string; index: number; text: string }>
  >([])

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const managerAudio = useManagerStore((state) => state.audio)
  const playerAudio = usePlayerStore((state) => state.audio)
  const activeAudio = isManager ? managerAudio : playerAudio
  const musicSource = activeAudio || SFX.ANSWERS.MUSIC

  const managerVolume = useManagerStore((state) => state.volume)
  const managerMuted = useManagerStore((state) => state.isMuted)
  const volume = isManager ? managerVolume : 0.2
  const isMuted = isManager ? managerMuted : false

  const [playMusic, { stop: stopMusic, sound }] = useSound(musicSource, {
    volume: isMuted ? 0 : volume,
    interrupt: true,
    loop: true,
  })

  useEffect(() => {
    if (sound) {
      sound.volume(isMuted ? 0 : volume)
    }
  }, [sound, volume, isMuted])

  useEffect(() => {
    if (type === "puzzle") {
      setPuzzleItems(
        answers.map((text, index) => ({ id: String(index), index, text })),
      )
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
  }, [playMusic, stopMusic, media?.type])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const isMultiOrPuzzle = type === "puzzle" || multiSelect

  const getFontSizeClass = (len: number) => {
    if (len < 50) {
      return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold"
    }

    if (len < 100) {
      return "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold"
    }

    return "text-sm sm:text-base md:text-lg lg:text-xl font-bold"
  }

  const maxAnswerLength = Math.max(...answers.map((a) => a.length))

  const getOptionFontSizeClass = (maxLen: number) => {
    if (maxLen < 20) {
      return "text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl"
    }

    if (maxLen < 45) {
      return "text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl"
    }

    if (maxLen < 75) {
      return "text-[11px] sm:text-xs md:text-sm lg:text-base xl:text-lg"
    }

    return "text-[10px] sm:text-[11px] md:text-xs lg:text-sm xl:text-base"
  }

  const optionFontSizeClass = getOptionFontSizeClass(maxAnswerLength)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col justify-between p-2 select-none sm:p-4">
      <div
        className={clsx(
          "mx-auto mb-2 flex min-h-0 w-full max-w-7xl shrink flex-col items-center justify-center gap-2 px-4",
          type === "puzzle" || !media ? "shrink-0 py-1" : "flex-1",
        )}
      >
        <div
          className={clsx(
            "mb-1 flex w-full shrink-0 items-center justify-center overflow-y-auto px-2",
            type === "puzzle"
              ? "max-h-[15vh]"
              : media
                ? "max-h-[18vh] sm:max-h-[22vh]"
                : "max-h-[35vh]",
          )}
        >
          {!shouldHideText && (
            <h2
              className={clsx(
                "w-full text-center leading-tight break-words text-white drop-shadow-lg",
                getFontSizeClass(question.length),
              )}
            >
              {question}
            </h2>
          )}
        </div>

        {!shouldHideText && media && (
          <div className="flex h-[22vh] min-h-0 shrink items-center justify-center overflow-hidden sm:h-[26vh] md:h-[30vh]">
            <QuestionMedia
              media={media}
              alt={question}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
      </div>

      <div className="flex h-0 flex-1 flex-col">
        <div className="mx-auto mb-2 flex w-full max-w-7xl shrink-0 justify-between gap-1 px-2 text-sm font-bold text-white sm:mb-4 sm:text-lg md:text-xl">
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-3 py-1 text-xs font-bold sm:px-4 sm:text-lg">
            <span className="text-[10px] text-gray-300 sm:text-sm">
              {t("game:hud.time")}
            </span>
            <span className="font-extrabold">{cooldown}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-3 py-1 text-xs font-bold sm:px-4 sm:text-lg">
            <span className="text-[10px] text-gray-300 sm:text-sm">
              {t("game:hud.answers")}
            </span>
            <span className="font-extrabold">
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        {type === "puzzle" ? (
          <SortableList
            items={puzzleItems}
            onReorder={(items) => {
              setPuzzleItems(items)
              sfxPop()
            }}
            label={(_item, index) => `Move answer ${index + 1}`}
            className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col gap-2 px-4 pb-2"
            itemClassName="min-h-0 flex-1"
            renderItem={(item, index, handle) => (
              <div className="flex h-full min-h-12 w-full items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-2 text-white shadow-lg backdrop-blur-md sm:p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-extrabold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-base font-bold [overflow-wrap:anywhere] sm:text-xl">
                  {item.text}
                </span>
                {handle}
              </div>
            )}
          />
        ) : (
          <div className="mx-auto grid h-0 w-full max-w-7xl flex-1 auto-rows-fr grid-cols-2 gap-2 px-2 pb-4 text-xl font-extrabold text-white sm:text-2xl md:text-3xl">
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
                      className="size-4 shrink-0 fill-current stroke-2 text-white sm:size-5"
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
          <div className="mx-auto my-2 flex w-full max-w-md shrink-0 justify-center px-4 sm:my-4">
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
              className="w-full touch-manipulation rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition duration-300 hover:from-emerald-600 hover:to-teal-600 active:scale-95 disabled:pointer-events-none disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 sm:py-3 sm:text-lg"
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
