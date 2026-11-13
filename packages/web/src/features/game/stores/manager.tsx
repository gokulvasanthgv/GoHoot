import type { Player } from "@razzia/common/types/game"
import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import type { ServerToClientEvents } from "@razzia/common/types/game/socket"
import type { EVENTS } from "@razzia/common/constants"
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
  openLobby: ServerToClientEvents[typeof EVENTS.MANAGER.GAME_CREATED]
  restoreGame: ServerToClientEvents[typeof EVENTS.MANAGER.SUCCESS_RECONNECT]
  applyGameStatus: ServerToClientEvents[typeof EVENTS.GAME.STATUS]
  applyGameSettings: ServerToClientEvents[typeof EVENTS.GAME.SETTINGS]
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

  openLobby: ({ gameId, inviteCode, wallpaper, audio }) =>
    set({
      gameId,
      inviteCode,
      status: createStatus(STATUS.SHOW_ROOM, {
        text: "game:waitingForPlayers",
        inviteCode,
      }),
      players: [],
      wallpaper: wallpaper ?? null,
      audio: audio ?? null,
    }),
  restoreGame: ({ gameId, inviteCode, status, players, wallpaper, audio }) =>
    set({
      gameId,
      inviteCode: inviteCode ?? null,
      status: createStatus(status.name, status.data),
      players,
      wallpaper: wallpaper ?? null,
      audio: audio ?? null,
    }),
  applyGameStatus: ({ name, data, wallpaper, audio }) =>
    set({
      status: createStatus(name, data),
      wallpaper: wallpaper ?? null,
      audio: audio ?? null,
    }),
  applyGameSettings: ({ wallpaper, audio }) =>
    set({ wallpaper: wallpaper ?? null, audio: audio ?? null }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),

  reset: () => set(initialState),
}))
