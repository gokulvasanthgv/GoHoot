import { EVENTS } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { useEvent } from "@razzia/web/features/game/contexts/socket-context"
import QuestionHeading from "@razzia/web/features/game/components/QuestionHeading"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { useState } from "react"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_START"]
}

const Start = ({ data: { time, subject } }: Props) => {
  const [showTitle, setShowTitle] = useState(true)
  const [cooldown, setCooldown] = useState(time)

  const [sfxBoump] = useSound(SFX.BOUMP_SOUND, {
    volume: 0.2,
  })

  useEvent(EVENTS.GAME.START_COOLDOWN, () => {
    sfxBoump()
    setShowTitle(false)
  })

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    sfxBoump()
    setCooldown(sec)
  })

  return (
    <section className="conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:px-3 conductor-compact:py-4 relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      {showTitle ? (
        <QuestionHeading question={subject} className="anim-show w-full px-2" />
      ) : (
        <div className="live-countdown relative grid aspect-square place-items-center">
          <div
            className="anim-show bg-primary absolute inset-0 rounded-2xl transition-transform"
            style={{
              transform: `rotate(${45 * (time - cooldown)}deg)`,
            }}
          ></div>
          <span className="relative leading-none font-bold text-white drop-shadow-md">
            {cooldown}
          </span>
        </div>
      )}
    </section>
  )
}

export default Start
