import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
  SFX,
} from "@razzia/web/features/game/utils/constants"
import { calculatePercentages } from "@razzia/web/features/game/utils/score"
import clsx from "clsx"
import { useEffect, useState } from "react"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
}

const Responses = ({
  data: { question, answers, responses, solutions, type },
}: Props) => {
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)

  const [sfxResults] = useSound(SFX.RESULTS_SOUND, {
    volume: 0.2,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    onplay: () => {
      setIsMusicPlaying(true)
    },
    onend: () => {
      setIsMusicPlaying(false)
    },
  })

  useEffect(() => {
    stopMusic()
    sfxResults()

    setPercentages(calculatePercentages(responses))
  }, [responses, playMusic, stopMusic, sfxResults])

  useEffect(() => {
    if (!isMusicPlaying) {
      playMusic()
    }
  }, [isMusicPlaying, playMusic])

  useEffect(() => {
    stopMusic()
  }, [playMusic, stopMusic])

  const isPuzzle = type === "puzzle"

  const getFontSizeClass = (len: number) => {
    if (len < 50) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold"
    if (len < 100) return "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold"
    return "text-sm sm:text-base md:text-lg lg:text-xl font-bold"
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-between p-2 sm:p-4 select-none min-h-0">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-2 px-4 min-h-0 shrink mb-2">
        <div className="w-full max-h-[18vh] sm:max-h-[22vh] overflow-y-auto px-2 shrink-0 flex items-center justify-center mb-1">
          <h2 className={clsx(
            "text-center text-white drop-shadow-lg leading-tight w-full break-words",
            getFontSizeClass(question.length)
          )}>
            {question}
          </h2>
        </div>

        {isPuzzle ? (
          <div className="mt-4 grid flex-1 max-h-[25vh] min-h-[120px] w-full max-w-lg grid-cols-2 gap-4 px-2">
            <div className="flex h-full w-full flex-col justify-end self-end">
              <div
                className="mx-auto flex w-24 flex-col justify-end overflow-hidden rounded-md bg-emerald-500"
                style={{ height: percentages[0] || "0%", minHeight: "4px" }}
              >
                <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
                  {responses[0] || 0}
                </span>
              </div>
              <span className="mt-2 text-center font-bold text-emerald-400">
                Correct
              </span>
            </div>
            <div className="flex h-full w-full flex-col justify-end self-end">
              <div
                className="mx-auto flex w-24 flex-col justify-end overflow-hidden rounded-md bg-rose-500"
                style={{ height: percentages[1] || "0%", minHeight: "4px" }}
              >
                <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
                  {responses[1] || 0}
                </span>
              </div>
              <span className="mt-2 text-center font-bold text-rose-400">
                Incorrect
              </span>
            </div>
          </div>
        ) : (
          <div
            className="mt-4 grid flex-1 max-h-[25vh] min-h-[120px] w-full max-w-3xl gap-2 px-2"
            style={{ gridTemplateColumns: `repeat(${answers.length}, 1fr)` }}
          >
            {answers.map((_, key) => (
              <div
                key={key}
                className={clsx(
                  "flex flex-col justify-end self-end overflow-hidden rounded-md",
                  ANSWERS_COLORS[key],
                )}
                style={{ height: percentages[key] || "0%", minHeight: "4px" }}
              >
                <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
                  {responses[key] || 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 h-0">
        {isPuzzle ? (
          <div className="mx-auto mb-2 sm:mb-4 flex flex-1 flex-col gap-2 w-full max-w-2xl min-h-0 overflow-y-auto px-4">
            {answers.map((answer, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-emerald-500/20 p-4 font-bold text-white shadow-lg backdrop-blur-md"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-extrabold text-white">
                  {index + 1}
                </span>
                <span className="text-lg font-medium">{answer}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-7xl grid grid-cols-2 auto-rows-fr gap-2 px-2 text-xl font-extrabold text-white sm:text-2xl md:text-3xl flex-1 min-h-0 pb-4">
            {answers.map((answer, key) => (
              <AnswerButton
                key={key}
                className={clsx(ANSWERS_COLORS[key], {
                  "opacity-65": responses && !solutions.includes(key),
                })}
                label={ANSWERS_LABELS[key]}
                correct={solutions.includes(key)}
              >
                {answer}
              </AnswerButton>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Responses
