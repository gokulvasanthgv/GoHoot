import type { Player } from "@razzia/common/types/game"
import type { StatusDataMap } from "@razzia/common/types/game/status"
import type { ManagerConfig } from "@razzia/common/types/manager"
import {
  createStatus,
  type Status,
} from "@razzia/web/features/game/utils/createStatus"
import { create } from "zustand"

interface ManagerStore<T> {
  config: ManagerConfig | null

  gameId: string | null
  inviteCode: string | null
  status: Status<T> | null
  players: Player[]
  wallpaper: string | null
  audio: string | null
  volume: number
  isMuted: boolean

  setConfig: (_config: ManagerConfig) => void
  setGameId: (_gameId: string | null) => void
  setInviteCode: (_inviteCode: string | null) => void
  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  resetStatus: () => void
  setPlayers: (_players: Player[]) => void
  setWallpaper: (_wallpaper: string | null) => void
  setAudio: (_audio: string | null) => void
  setVolume: (_volume: number) => void
  setIsMuted: (_isMuted: boolean) => void

  reset: () => void
}

const initialState = {
  config: null,
  gameId: null,
  inviteCode: null,
  status: null,
  players: [],
  wallpaper: null,
  audio: null,
  volume: 0.2,
  isMuted: false,
}

export const useManagerStore = create<ManagerStore<StatusDataMap>>((set) => ({
  ...initialState,

  setConfig: (config) => set({ config }),

  setGameId: (gameId) => set({ gameId }),
  setInviteCode: (inviteCode) => set({ inviteCode }),

  setStatus: (name, data) => set({ status: createStatus(name, data) }),
  resetStatus: () => set({ status: null }),

  setPlayers: (players) => set({ players }),
  setWallpaper: (wallpaper) => set({ wallpaper }),
  setAudio: (audio) => set({ audio }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),

  reset: () => set(initialState),
}))
