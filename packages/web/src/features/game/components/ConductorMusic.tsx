import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { useEffect } from "react"
import useSound from "use-sound"

const MusicTrack = ({
  source,
  volume,
  enabled,
}: {
  source: string
  volume: number
  enabled: boolean
}) => {
  const [, { sound }] = useSound(source, {
    volume,
    interrupt: true,
    loop: true,
  })

  useEffect(() => {
    if (!sound || !enabled) {
      return
    }

    sound.play()

    return () => {
      sound.stop()
    }
  }, [sound, enabled])

  useEffect(() => {
    sound?.volume(volume)
  }, [sound, volume])

  return null
}

const ConductorMusic = ({ enabled = true }: { enabled?: boolean }) => {
  const isManager = useIsManagerScreen()
  const { audio, volume, isMuted } = useManagerStore()
  const source = audio || SFX.ANSWERS.MUSIC

  if (!isManager) {
    return null
  }

  // Remount when settings change, including while the previous track is loading.
  return (
    <MusicTrack
      key={source}
      source={source}
      volume={isMuted ? 0 : volume}
      enabled={enabled}
    />
  )
}

export default ConductorMusic
