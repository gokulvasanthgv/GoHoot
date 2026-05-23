import { EVENTS } from "@razzia/common/constants"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import Fire from "@razzia/web/features/game/components/icons/Fire"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const AnimatedPoints = ({ from, to }: { from: number; to: number }) => {
  const spring = useSpring(from, { stiffness: 1000, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from)

  useEffect(() => {
    spring.set(to)
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return unsubscribe
  }, [to, spring, display])

  return <span className="drop-shadow-md">{displayValue}</span>
}

const StreakBadge = ({ streak }: { streak: number }) => (
  <AnimatePresence>
    {streak >= 2 && (
      <motion.div
        key="streak"
        initial={{ opacity: 0, scale: 0.5, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.5, x: -10 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="ml-2 flex items-center gap-1 rounded-full bg-amber-700 p-1"
      >
        <Fire className="size-7" />
      </motion.div>
    )}
  </AnimatePresence>
)

const Leaderboard = ({
  data: { oldLeaderboard, leaderboard, previousQuestions },
}: Props) => {
  const { socket } = useSocket()
  const { gameId } = useManagerStore()
  const [displayedLeaderboard, setDisplayedLeaderboard] =
    useState(oldLeaderboard)
  const [isAnimating, setIsAnimating] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    setDisplayedLeaderboard(oldLeaderboard)
    setIsAnimating(false)

    const timer = setTimeout(() => {
      setIsAnimating(true)
      setDisplayedLeaderboard(leaderboard)
    }, 1600)

    return () => {
      clearTimeout(timer)
    }
  }, [oldLeaderboard, leaderboard])

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 min-h-0 select-none">
      {previousQuestions && previousQuestions.length > 0 && (
        <div className="mb-4 flex flex-col items-center gap-2 shrink-0">
          <select
            id="previous-questions-select"
            className="focus:ring-primary max-w-xl cursor-pointer rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-xl font-bold text-white focus:ring-2 focus:outline-none"
            value=""
            onChange={(e) => {
              const val = e.target.value
              if (val !== "") {
                const index = parseInt(val, 10)
                socket.emit(EVENTS.MANAGER.GO_TO_QUESTION, {
                  gameId: gameId ?? "",
                  index,
                })
              }
            }}
          >
            <option value="" disabled>
              {t("game:goToQuestion")}
            </option>
            {previousQuestions.map((q) => (
              <option key={q.index} value={q.index}>
                {q.index + 1}. {q.question}
              </option>
            ))}
          </select>
        </div>
      )}
      <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-extrabold text-white drop-shadow-md shrink-0">
        {t("game:leaderboard")}
      </h2>
      <div className="flex w-full flex-col gap-3 max-w-3xl justify-center shrink min-h-0">
        <AnimatePresence mode="popLayout">
          {displayedLeaderboard.map(({ id, username, points, streak }) => (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: 50,
                transition: { duration: 0.2 },
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 350,
                  damping: 25,
                },
              }}
              className="bg-primary flex w-full justify-between items-center rounded-2xl py-3.5 px-6 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white shadow-lg"
            >
              <span className="flex items-center gap-2 drop-shadow-md">
                {username}
                <StreakBadge streak={streak} />
              </span>
              {isAnimating ? (
                <AnimatedPoints
                  from={oldLeaderboard.find((u) => u.id === id)?.points ?? 0}
                  to={leaderboard.find((u) => u.id === id)?.points ?? 0}
                />
              ) : (
                <span className="drop-shadow-md">{points}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

export default Leaderboard
