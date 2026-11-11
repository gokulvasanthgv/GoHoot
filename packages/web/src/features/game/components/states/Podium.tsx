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
        "conductor-compact:size-[clamp(2.5rem,8vw,4rem)] conductor-compact:border-4 conductor-compact:text-[clamp(1.25rem,4vw,2rem)] relative flex aspect-square size-20 items-center justify-center overflow-hidden rounded-full border-8 text-5xl font-extrabold text-white drop-shadow-sm md:size-26 md:border-10 md:text-6xl",
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
      <section className="conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:justify-center conductor-compact:px-2 conductor-compact:py-3 relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-between pb-4 select-none">
        <h2 className="anim-show conductor-compact:text-[clamp(1.5rem,5vw,2.5rem)] max-w-full shrink-0 text-center text-3xl leading-tight font-extrabold [overflow-wrap:anywhere] text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl">
          {subject}
        </h2>

        {result && (
          <button
            onClick={() => exportResultsToXlsx(result)}
            className="conductor-compact:min-h-11 z-40 mt-3 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-700 active:scale-95"
          >
            <Download className="size-4" />
            {t("manager:result.export")}
          </button>
        )}

        <div className="conductor-compact:flex-none mt-4 flex min-h-0 w-full flex-1 shrink items-end justify-center overflow-visible">
          <div
            style={{
              gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))`,
            }}
            className="conductor-compact:h-auto conductor-compact:max-w-2xl conductor-compact:gap-1.5 grid h-[45vh] w-full max-w-4xl items-end justify-center overflow-visible sm:h-[50vh] md:h-[55vh]"
          >
            {top[1] && (
              <div
                className={clsx(
                  "conductor-compact:h-auto z-20 flex h-[65%] w-full translate-y-full flex-col items-center justify-center gap-2 opacity-0 transition-all",
                  { "translate-y-0! opacity-100": apparition >= 2 },
                )}
              >
                <p
                  className={clsx(
                    "conductor-compact:w-full conductor-compact:text-sm conductor-compact:whitespace-normal conductor-compact:[overflow-wrap:anywhere] overflow-visible text-center text-xl font-extrabold whitespace-nowrap text-white drop-shadow-lg sm:text-2xl md:text-3xl lg:text-4xl",
                    {
                      "anim-balanced": apparition >= 4,
                    },
                  )}
                >
                  {top[1].username}
                </p>
                <div className="bg-primary conductor-compact:h-auto conductor-compact:min-h-24 conductor-compact:rounded-xl conductor-compact:px-1 conductor-compact:py-2 flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 text-center shadow-2xl sm:pt-6">
                  <Medal rank={2} />
                  <p className="conductor-compact:text-base text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl md:text-4xl">
                    {top[1].points}
                  </p>
                </div>
              </div>
            )}

            <div
              className={clsx(
                "conductor-compact:h-auto z-30 flex h-[80%] w-full translate-y-full flex-col items-center gap-2 opacity-0 transition-all",
                {
                  "translate-y-0! opacity-100": apparition >= 3,
                },
                {
                  "conductor-compact:min-w-0 md:min-w-64": top.length < 2,
                },
              )}
            >
              <p
                className={clsx(
                  "conductor-compact:w-full conductor-compact:text-sm conductor-compact:whitespace-normal conductor-compact:[overflow-wrap:anywhere] overflow-visible text-center text-xl font-extrabold whitespace-nowrap text-white opacity-0 drop-shadow-lg sm:text-2xl md:text-3xl lg:text-4xl",
                  { "anim-balanced opacity-100": apparition >= 4 },
                )}
              >
                {top[0].username}
              </p>
              <div className="bg-primary conductor-compact:h-auto conductor-compact:min-h-28 conductor-compact:rounded-xl conductor-compact:px-1 conductor-compact:py-2 flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 text-center shadow-2xl sm:pt-6">
                <Medal rank={1} />
                <p className="conductor-compact:text-lg text-3xl font-extrabold text-white drop-shadow-sm sm:text-4xl md:text-5xl">
                  {top[0].points}
                </p>
              </div>
            </div>

            {top[2] && (
              <div
                className={clsx(
                  "conductor-compact:h-auto z-10 flex h-[50%] w-full translate-y-full flex-col items-center gap-2 opacity-0 transition-all",
                  {
                    "translate-y-0! opacity-100": apparition >= 1,
                  },
                )}
              >
                <p
                  className={clsx(
                    "conductor-compact:w-full conductor-compact:text-sm conductor-compact:whitespace-normal conductor-compact:[overflow-wrap:anywhere] overflow-visible text-center text-xl font-extrabold whitespace-nowrap text-white drop-shadow-lg sm:text-2xl md:text-3xl lg:text-4xl",
                    {
                      "anim-balanced": apparition >= 4,
                    },
                  )}
                >
                  {top[2].username}
                </p>
                <div className="bg-primary conductor-compact:h-auto conductor-compact:min-h-20 conductor-compact:rounded-xl conductor-compact:px-1 conductor-compact:py-2 flex h-full w-full flex-col items-center gap-2 rounded-t-2xl pt-4 text-center shadow-2xl sm:pt-6">
                  <Medal rank={3} />

                  <p className="conductor-compact:text-base text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl md:text-4xl">
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
