import { useIsManagerScreen } from "@razzia/web/features/game/contexts/game-screen-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { Music, Slash, Volume2, VolumeX } from "lucide-react"
import { useTranslation } from "react-i18next"

const iconButton =
  "relative grid size-10 shrink-0 place-items-center rounded-lg text-white hover:bg-white/15 focus-visible:outline-2 active:scale-95 conductor-compact:size-11"

const GameAudioControls = () => {
  const manager = useIsManagerScreen()
  const volume = useManagerStore((state) => state.volume)
  const setVolume = useManagerStore((state) => state.setVolume)
  const managerMusic = useManagerStore((state) => !state.isMuted)
  const setManagerMusicMuted = useManagerStore((state) => state.setIsMuted)
  const playerMusic = usePlayerStore((state) => state.musicEnabled)
  const setPlayerMusic = usePlayerStore((state) => state.setMusicEnabled)
  const managerSounds = useManagerStore((state) => state.soundsEnabled)
  const setManagerSounds = useManagerStore((state) => state.setSoundsEnabled)
  const playerSounds = usePlayerStore((state) => state.soundsEnabled)
  const setPlayerSounds = usePlayerStore((state) => state.setSoundsEnabled)
  const music = manager ? managerMusic : playerMusic
  const sounds = manager ? managerSounds : playerSounds
  const { t } = useTranslation()
  const musicLabel = t(music ? "game:muteMusic" : "game:unmuteMusic")
  const soundsLabel = t(sounds ? "game:muteSounds" : "game:unmuteSounds")
  const SoundIcon = sounds ? Volume2 : VolumeX

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-950/70 px-1 text-white backdrop-blur-sm">
      <button
        type="button"
        className={iconButton}
        aria-label={musicLabel}
        title={musicLabel}
        onClick={() =>
          manager ? setManagerMusicMuted(music) : setPlayerMusic(!music)
        }
      >
        <Music aria-hidden="true" className="size-5" />
        {!music && <Slash aria-hidden="true" className="absolute size-5" />}
      </button>
      {manager && (
        <input
          type="range"
          aria-label={t("game:musicVolume")}
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value)
            setVolume(next)

            if (next > 0 && !music) {
              setManagerMusicMuted(false)
            }
          }}
          className="conductor-compact:h-8 conductor-compact:w-15 conductor-compact:appearance-auto conductor-compact:bg-transparent h-1 w-20 cursor-pointer appearance-none rounded-lg bg-white/30 accent-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
      )}
      <button
        type="button"
        className={iconButton}
        aria-label={soundsLabel}
        title={soundsLabel}
        onClick={() => (manager ? setManagerSounds : setPlayerSounds)(!sounds)}
      >
        <SoundIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}

export default GameAudioControls
