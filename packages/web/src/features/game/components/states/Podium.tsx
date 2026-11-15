import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { SFX } from "@razzia/web/features/game/utils/constants"
import useScreenSize from "@razzia/web/hooks/useScreenSize"
import clsx from "clsx"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import useGameSound from "@razzia/web/features/game/hooks/useGameSound"
import { useTranslation } from "react-i18next"
import { Download } from "lucide-react"
import { exportResultsToXlsx } from "@razzia/web/features/manager/utils/exportResults"

interface Props {
  data: ManagerStatusDataMap["FINISHED"]
}

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)

  const [sfxtThree] = useGameSound(SFX.PODIUM.THREE, { volume: 0.1 })
  const [sfxSecond] = useGameSound(SFX.PODIUM.SECOND, { volume: 0.1 })
  const [sfxRool, { stop: sfxRoolStop }] = useGameSound(SFX.PODIUM.SNEAR_ROOL, {
    volume: 0.1,
  })
  const [sfxFirst] = useGameSound(SFX.PODIUM.FIRST, { volume: 0.1 })

  useEffect(() => {
    const actions: Partial<Record<number, () => void>> = {
      4: () => {
        sfxRoolStop()
        sfxFirst()
      },
      3: sfxRool,
      2: sfxSecond,
      1: sfxtThree,
    }

    actions[apparition]?.()
  }, [apparition, sfxFirst, sfxSecond, sfxtThree, sfxRool, sfxRoolStop])

  useEffect(() => {
    if (topLength < 3) {
      setApparition(4)

      return
    }

    if (apparition >= 4) {
      return
    }

    const interval = setInterval(() => {
      setApparition((value) => value + 1)
    }, 2000)

    return () => clearInterval(interval)
  }, [apparition, topLength])

  return apparition
}

const medalColor = [
  {
    background: "bg-yellow-500",
    border: "border-yellow-600",
  },
  {
    background: "bg-gray-400",
    border: "border-gray-200",
  },
  {
    background: "bg-amber-700",
    border: "border-amber-800",
  },
]

const podiumOrder = [
  { rank: 2, revealAt: 2 },
  { rank: 1, revealAt: 3 },
  { rank: 3, revealAt: 1 },
]

const Medal = ({ rank }: { rank: number }) => {
  const color = medalColor[rank - 1]

  return (
    <div
      className={clsx(
        "conductor-podium-medal relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white drop-shadow-sm",
        color.background,
        color.border,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <div className="absolute top-[30%] left-1/2 h-6 w-[160%] -translate-x-1/2 -rotate-40 bg-white/25" />
        <div className="absolute top-[70%] left-1/2 h-3 w-[160%] -translate-x-1/2 -rotate-40 bg-white/25" />
      </div>
      <p
        className="relative z-10"
        style={{ textShadow: "2px 2px rgba(0,0,0, 0.25)" }}
      >
        {rank}
      </p>
    </div>
  )
}

const Podium = ({ data: { subject, top, result } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const { t } = useTranslation()

  const { width, height } = useScreenSize()

  return (
    <>
      {apparition >= 4 && (
        <ReactConfetti
          width={width}
          height={height}
          className="pointer-events-none h-full w-full"
        />
      )}

      {apparition >= 3 && top.length >= 3 && (
        <div className="pointer-events-none absolute min-h-dvh w-full overflow-hidden">
          <div className="spotlight"></div>
        </div>
      )}
      <section className="conductor-podium">
        <div className="flex w-full flex-col items-center gap-3">
          <h2 className="conductor-podium-title anim-show max-w-full text-center leading-tight font-extrabold [overflow-wrap:anywhere] text-white drop-shadow-lg">
            {subject}
          </h2>
          {result && (
            <button
              onClick={() => exportResultsToXlsx(result)}
              className="z-40 flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-700 active:scale-95"
            >
              <Download className="size-4" />
              {t("manager:result.export")}
            </button>
          )}
        </div>

        <ol className="conductor-podium-list">
          {podiumOrder.map(({ rank, revealAt }) => {
            const player = top.at(rank - 1)

            if (!player) {
              return null
            }

            const visible = apparition >= revealAt

            return (
              <li
                key={rank}
                value={rank}
                data-podium-rank={rank}
                aria-hidden={!visible}
                className={clsx(
                  "conductor-podium-card transition-[translate,opacity] duration-500 motion-reduce:transition-none",
                  visible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-6 opacity-0",
                )}
              >
                <p
                  className={clsx(
                    "conductor-podium-name",
                    rank === 1 && apparition < 4 && "invisible",
                  )}
                >
                  {player.username}
                </p>
                <div className="conductor-podium-step bg-primary rounded-t-2xl rounded-b-md shadow-2xl">
                  <Medal rank={rank} />
                  <p className="font-extrabold text-white drop-shadow-sm">
                    {player.points}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}

export default Podium
