import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
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

const GameMusic = ({
  enabled = true,
  customSource,
}: {
  enabled?: boolean
  customSource?: string | null
}) => {
  const manager = useIsManagerScreen()
  const managerAudio = useManagerStore((state) => state.audio)
  const playerAudio = usePlayerStore((state) => state.audio)
  const playerMusicEnabled = usePlayerStore((state) => state.musicEnabled)
  const volume = useManagerStore((state) => (state.isMuted ? 0 : state.volume))
  const gameAudio =
    customSource === undefined
      ? manager
        ? managerAudio
        : playerAudio
      : customSource
  const source = gameAudio || SFX.ANSWERS.MUSIC

  if (!manager && !playerMusicEnabled) {
    return null
  }

  return (
    <MusicTrack
      key={source}
      source={source}
      volume={manager ? volume : 0.2}
      enabled={enabled}
    />
  )
}

export default GameMusic
