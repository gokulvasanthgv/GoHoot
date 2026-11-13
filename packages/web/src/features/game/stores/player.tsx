import type { StatusDataMap } from "@razzia/common/types/game/status"
import type { ServerToClientEvents } from "@razzia/common/types/game/socket"
import type { EVENTS } from "@razzia/common/constants"
import {
  createStatus,
  type Status,
} from "@razzia/web/features/game/utils/createStatus"
import { create } from "zustand"

interface PlayerState {
  username?: string
  points?: number
}

interface PlayerStore<T> {
  inviteCode: string | null
  setInviteCode: (_inviteCode: string) => void
  gameId: string | null
  player: PlayerState | null
  status: Status<T> | null
  wallpaper: string | null
  audio: string | null

  login: (_username: string) => void
  join: (_gameId: string) => void
  updatePoints: (_points: number) => void

  restoreGame: ServerToClientEvents[typeof EVENTS.PLAYER.SUCCESS_RECONNECT]
  applyGameStatus: ServerToClientEvents[typeof EVENTS.GAME.STATUS]
  applyGameSettings: ServerToClientEvents[typeof EVENTS.GAME.SETTINGS]

  reset: () => void
}

const initialState = {
  inviteCode: null,
  gameId: null,
  player: null,
  status: null,
  wallpaper: null,
  audio: null,
}

export const usePlayerStore = create<PlayerStore<StatusDataMap>>((set) => ({
  ...initialState,
  setInviteCode: (inviteCode) => set({ inviteCode }),

  login: (username) =>
    set((state) => ({
      player: { ...state.player, username },
    })),

  join: (gameId) => {
    set((state) => ({
      gameId,
      player: { ...state.player, points: 0 },
      status: null,
      wallpaper: null,
      audio: null,
    }))

    if (gameId) {
      localStorage.setItem("active_game_id", gameId)
      document.cookie = `active_game_id=${encodeURIComponent(gameId)}; path=/; max-age=31536000; SameSite=Lax`
    }
  },

  updatePoints: (points) =>
    set((state) => ({
      player: { ...state.player, points },
    })),

  restoreGame: ({ gameId, status, player, wallpaper, audio }) =>
    set({
      gameId,
      status: createStatus(status.name, status.data),
      player,
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

  reset: () => {
    localStorage.removeItem("active_game_id")
    document.cookie = "active_game_id=; path=/; max-age=-1; SameSite=Lax"
    set(initialState)
  },
}))
