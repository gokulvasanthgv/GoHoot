import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { SFX } from "@razzia/web/features/game/utils/constants"
import useScreenSize from "@razzia/web/hooks/useScreenSize"
import clsx from "clsx"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import useSound from "use-sound"
import { useTranslation } from "react-i18next"
import { Download } from "lucide-react"
import { exportResultsToXlsx } from "@razzia/web/features/manager/utils/exportResults"

interface Props {
  data: ManagerStatusDataMap["FINISHED"]
}

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)

  const [sfxtThree] = useSound(SFX.PODIUM.THREE, { volume: 0.1 })
  const [sfxSecond] = useSound(SFX.PODIUM.SECOND, { volume: 0.1 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX.PODIUM.SNEAR_ROOL, {
    volume: 0.1,
  })
  const [sfxFirst] = useSound(SFX.PODIUM.FIRST, { volume: 0.1 })

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

const Medal = ({ rank }: { rank: number }) => {
  const color = medalColor[rank - 1]

  return (
    <div
      className={clsx(
        "relative flex aspect-square size-20 items-center justify-center overflow-hidden rounded-full border-8 text-5xl font-extrabold text-white drop-shadow-sm md:size-26 md:border-10 md:text-6xl",
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
          className="h-full w-full"
        />
      )}

      {apparition >= 3 && top.length >= 3 && (
        <div className="pointer-events-none absolute min-h-dvh w-full overflow-hidden">
          <div className="spotlight"></div>
        </div>
      )}
      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-between min-h-0 select-none pb-4">
        <h2 className="anim-show text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white drop-shadow-lg leading-tight shrink-0">
          {subject}
        </h2>

        {result && (
          <button
            onClick={() => exportResultsToXlsx(result)}
            className="z-40 mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-700 active:scale-95 shrink-0"
          >
            <Download className="size-4" />
            {t("manager:result.export")}
          </button>
        )}

        <div className="flex-1 w-full flex items-end justify-center min-h-0 mt-4 overflow-visible shrink">
          <div
            style={{ gridTemplateColumns: `repeat(${top.length}, 1fr)` }}
            className="grid w-full max-w-4xl h-[45vh] sm:h-[50vh] md:h-[55vh] items-end justify-center overflow-visible"
          >
            {top[1] && (
              <div
                className={clsx(
                  "z-20 flex h-[65%] w-full translate-y-full flex-col items-center justify-center gap-2 opacity-0 transition-all",
                  { "translate-y-0! opacity-100": apparition >= 2 },
                )}
              >
                <p
                  className={clsx(
                    "overflow-visible text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold whitespace-nowrap text-white drop-shadow-lg",
                    {
                      "anim-balanced": apparition >= 4,
                    },
                  )}
                >
                  {top[1].username}
                </p>
                <div className="bg-primary flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 sm:pt-6 text-center shadow-2xl">
                  <Medal rank={2} />
                  <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow-sm">
                    {top[1].points}
                  </p>
                </div>
              </div>
            )}

            <div
              className={clsx(
                "z-30 flex h-[80%] w-full translate-y-full flex-col items-center gap-2 opacity-0 transition-all",
                {
                  "translate-y-0! opacity-100": apparition >= 3,
                },
                {
                  "md:min-w-64": top.length < 2,
                },
              )}
            >
              <p
                className={clsx(
                  "overflow-visible text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold whitespace-nowrap text-white opacity-0 drop-shadow-lg",
                  { "anim-balanced opacity-100": apparition >= 4 },
                )}
              >
                {top[0].username}
              </p>
              <div className="bg-primary flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 sm:pt-6 text-center shadow-2xl">
                <Medal rank={1} />
                <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow-sm">
                  {top[0].points}
                </p>
              </div>
            </div>

            {top[2] && (
              <div
                className={clsx(
                  "z-10 flex h-[50%] w-full translate-y-full flex-col items-center gap-2 opacity-0 transition-all",
                  {
                    "translate-y-0! opacity-100": apparition >= 1,
                  },
                )}
              >
                <p
                  className={clsx(
                    "overflow-visible text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold whitespace-nowrap text-white drop-shadow-lg",
                    {
                      "anim-balanced": apparition >= 4,
                    },
                  )}
                >
                  {top[2].username}
                </p>
                <div className="bg-primary flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 sm:pt-6 text-center shadow-2xl">
                  <Medal rank={3} />

                  <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow-sm">
                    {top[2].points}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

export default Podium
