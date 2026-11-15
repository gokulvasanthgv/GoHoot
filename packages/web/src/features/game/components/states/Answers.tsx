import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerShape from "@razzia/web/features/game/components/AnswerShape"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import GameMusic from "@razzia/web/features/game/components/GameMusic"
import QuestionMode from "@razzia/web/features/game/components/QuestionMode"
import QuestionHeading from "@razzia/web/features/game/components/QuestionHeading"
import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { ANSWERS_COLORS, SFX } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useGameSound, {
  useGameSoundsEnabled,
} from "@razzia/web/features/game/hooks/useGameSound"
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
  const isManager = useIsManagerScreen()
  const soundsEnabled = useGameSoundsEnabled()
  const shouldHideText = Boolean(hideTextOnClient) && !isManager
  const answerGridRef = useRef<HTMLDivElement>(null)

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()

  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [puzzleItems, setPuzzleItems] = useState<
    Array<{ id: string; index: number; text: string }>
  >([])

  const [sfxPop] = useGameSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  useEffect(() => {
    if (type === "puzzle") {
      setPuzzleItems(
        answers.map((text, index) => ({ id: String(index), index, text })),
      )
    }
  }, [answers, type])

  useLayoutEffect(() => {
    const grid = answerGridRef.current

    if (!grid) {
      return
    }

    const labels = [...grid.querySelectorAll<HTMLElement>("[data-answer-text]")]

    if (labels.length === 0) {
      return
    }

    const [firstLabel] = labels
    const fitAnswers = () => {
      const widths = labels.map((label) => ({
        label,
        available: label.clientWidth,
      }))

      if (widths.some(({ available }) => available === 0)) {
        return
      }

      // Let the browser measure the widest part of each answer it would keep together.
      grid.dataset.measuringAnswers = ""
      const preferred = Number.parseFloat(getComputedStyle(firstLabel).fontSize)
      const minimum = Number.parseFloat(getComputedStyle(grid).fontSize)
      const ratio = Math.min(
        1,
        ...widths.map(({ label, available }) => {
          const needed = label.offsetWidth

          // A token that would wrap at the readable minimum should not shrink the other options.
          return needed * (minimum / preferred) > available
            ? 1
            : (available - 1) / Math.max(1, needed)
        }),
      )
      delete grid.dataset.measuringAnswers
      grid.style.setProperty("--answer-fitted-size", `${preferred * ratio}px`)
    }

    let frame: number | undefined = undefined
    const scheduleFit = () => {
      frame ??= requestAnimationFrame(() => {
        frame = undefined
        fitAnswers()
      })
    }
    const observer = new ResizeObserver(scheduleFit)

    fitAnswers()
    observer.observe(grid)
    window.addEventListener("resize", scheduleFit)
    document.fonts.addEventListener("loadingdone", scheduleFit)

    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
      }

      observer.disconnect()
      window.removeEventListener("resize", scheduleFit)
      document.fonts.removeEventListener("loadingdone", scheduleFit)
      grid.style.removeProperty("--answer-fitted-size")
    }
  }, [answers, shouldHideText, type])

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

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const isMultiOrPuzzle = type === "puzzle" || multiSelect

  const prompt = (
    <div
      className={
        isManager
          ? "conductor-round-prompt-content"
          : "mx-auto mb-2 flex w-full max-w-7xl shrink-0 flex-col items-center justify-center gap-2 px-4"
      }
      data-has-media={isManager && media ? "" : undefined}
    >
      {!shouldHideText && (
        <div
          className={
            isManager ? "conductor-round-heading" : "w-full min-w-0 px-2"
          }
        >
          <QuestionHeading question={question} />
        </div>
      )}

      {!shouldHideText && media && (
        <div
          className={
            isManager
              ? "conductor-round-media"
              : "flex h-[clamp(4rem,24dvh,18rem)] min-h-0 shrink-0 items-center justify-center overflow-hidden"
          }
        >
          <QuestionMedia
            media={media}
            muted={!soundsEnabled}
            alt={question}
            className={
              isManager ? undefined : "max-h-full max-w-full object-contain"
            }
          />
        </div>
      )}
    </div>
  )

  const statClass = isManager
    ? "conductor-round-stat"
    : "flex flex-col items-center rounded-lg bg-black/40 px-3 py-1 text-xs font-bold sm:px-4 sm:text-lg"
  const hud = (
    <div
      className={
        isManager
          ? "conductor-round-hud"
          : "mx-auto mb-2 flex w-full max-w-7xl shrink-0 items-center justify-between gap-1 px-2 text-sm font-bold text-white sm:mb-4 sm:text-lg md:text-xl"
      }
    >
      <div className={statClass}>
        <span className="text-[10px] text-gray-300 sm:text-sm">
          {t("game:hud.time")}
        </span>
        <span className="font-extrabold">{cooldown}</span>
      </div>
      {isManager && (
        <QuestionMode type={type} multiSelect={multiSelect ?? false} />
      )}
      <div className={statClass}>
        <span className="text-[10px] text-gray-300 sm:text-sm">
          {t("game:hud.answers")}
        </span>
        <span className="font-extrabold">
          {totalAnswer}/{totalPlayer}
        </span>
      </div>
    </div>
  )

  const options =
    type === "puzzle" ? (
      <SortableList
        items={puzzleItems}
        onReorder={(items) => {
          setPuzzleItems(items)
          sfxPop()
        }}
        label={(_item, index) => `Move answer ${index + 1}`}
        className={clsx(
          "answer-puzzle",
          isManager
            ? "conductor-round-choices"
            : "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pb-2",
        )}
        itemClassName="flex-auto"
        renderItem={(item, index, handle) => (
          <div
            className={clsx(
              "flex h-full min-h-12 w-full items-center gap-3 rounded-xl p-2 text-white shadow-lg sm:p-3",
              ANSWERS_COLORS[item.index],
            )}
          >
            <AnswerShape index={item.index} className="size-6 shrink-0" />
            <span className="text-sm font-extrabold">{index + 1}</span>
            <span
              data-answer-text=""
              className="min-w-0 flex-1 leading-snug font-bold"
            >
              {item.text}
            </span>
            {!isManager && handle}
          </div>
        )}
      />
    ) : (
      <div
        ref={answerGridRef}
        data-answer-count={isManager ? answers.length : undefined}
        className={clsx(
          "answer-grid text-white",
          isManager
            ? "conductor-round-choices"
            : "mx-auto grid w-full max-w-7xl flex-1 auto-rows-fr grid-cols-2 gap-2 px-2 pb-4 max-[300px]:grid-cols-1",
        )}
      >
        {answers.map((answer, key) => (
          <AnswerButton
            key={key}
            hideText={shouldHideText}
            className={clsx(ANSWERS_COLORS[key], "disabled:cursor-default")}
            disabled={isManager}
            selected={
              !isManager && multiSelect ? selectedKeys.includes(key) : undefined
            }
            index={key}
            answer={answer}
            onClick={multiSelect ? () => handleToggle(key) : handleAnswer(key)}
          />
        ))}
      </div>
    )

  return (
    <div
      className={
        isManager
          ? "conductor-round select-none"
          : "flex h-full min-h-0 flex-1 flex-col justify-between overflow-x-hidden overflow-y-auto p-2 select-none sm:p-4"
      }
    >
      <GameMusic
        enabled={
          media?.type !== MEDIA_TYPES.AUDIO && media?.type !== MEDIA_TYPES.VIDEO
        }
      />
      {isManager ? (
        <>
          {hud}
          <div className="conductor-round-prompt">{prompt}</div>
          {options}
        </>
      ) : (
        <>
          <div className="mx-auto flex w-full shrink-0 justify-center pb-2">
            <QuestionMode type={type} multiSelect={multiSelect ?? false} />
          </div>
          {prompt}
          <div className="flex flex-1 flex-col">
            {hud}
            {options}
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
        </>
      )}
    </div>
  )
}

export default Answers
