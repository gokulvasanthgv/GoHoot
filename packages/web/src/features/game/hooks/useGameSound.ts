import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import useSound from "use-sound"

export const useGameSoundsEnabled = () => {
  const manager = useIsManagerScreen()
  const managerSounds = useManagerStore((state) => state.soundsEnabled)
  const playerSounds = usePlayerStore((state) => state.soundsEnabled)

  return manager ? managerSounds : playerSounds
}

export default function useGameSound(
  source: string,
  options: { volume: number },
) {
  const enabled = useGameSoundsEnabled()
  const enabledRef = useRef(enabled)
  const [play, { stop }] = useSound(source, options)

  useLayoutEffect(() => {
    enabledRef.current = enabled

    if (!enabled) {
      stop()
    }
  }, [enabled, stop])

  useEffect(() => () => stop(), [stop])

  // Settings changes should not replay the cue for the current phase.
  const playCue = useCallback(() => {
    if (enabledRef.current) {
      play()
    }
  }, [play])

  return [playCue, { stop }] as const
}
