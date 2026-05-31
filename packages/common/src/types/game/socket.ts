import { EVENTS } from "@razzia/common/constants"
import type {
  GameResult,
  GameUpdateQuestion,
  Player,
  QuizzWithId,
} from "@razzia/common/types/game"
import type { Status, StatusDataMap } from "@razzia/common/types/game/status"
import type { ManagerConfig } from "@razzia/common/types/manager"
import { Server as ServerIO, Socket as SocketIO } from "socket.io"

export type Server = ServerIO<ClientToServerEvents, ServerToClientEvents>

export type Socket = SocketIO<ClientToServerEvents, ServerToClientEvents>

export interface Message<K extends keyof StatusDataMap = keyof StatusDataMap> {
  gameId?: string
  status: K
  data: StatusDataMap[K]
}

export interface MessageWithoutStatus<T = unknown> {
  gameId?: string
  data: T
}

export interface MessageGameId {
  gameId?: string
}

export interface ServerToClientEvents {
  connect: () => void

  // Game events
  [EVENTS.GAME.STATUS]: (_data: {
    name: Status
    data: StatusDataMap[Status]
    wallpaper?: string
    audio?: string
  }) => void
  [EVENTS.GAME.SUCCESS_ROOM]: (_data: string | {
    gameId: string
    alreadyJoined: boolean
    username?: string
  }) => void
  [EVENTS.GAME.SUCCESS_JOIN]: (_gameId: string) => void
  [EVENTS.GAME.TOTAL_PLAYERS]: (_count: number) => void
  [EVENTS.GAME.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.GAME.START_COOLDOWN]: () => void
  [EVENTS.GAME.COOLDOWN]: (_count: number) => void
  [EVENTS.GAME.RESET]: (_message: string) => void
  [EVENTS.GAME.UPDATE_QUESTION]: (_data: {
    current: number
    total: number
  }) => void
  [EVENTS.GAME.PLAYER_ANSWER]: (_count: number) => void

  // Player events
  [EVENTS.PLAYER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    player: { username: string; points: number }
    currentQuestion: GameUpdateQuestion
    wallpaper?: string
    audio?: string
  }) => void
  [EVENTS.PLAYER.UPDATE_LEADERBOARD]: (_data: { leaderboard: Player[] }) => void

  // Manager events
  [EVENTS.MANAGER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    inviteCode?: string
    status: { name: Status; data: StatusDataMap[Status] }
    players: Player[]
    currentQuestion: GameUpdateQuestion
    wallpaper?: string
    audio?: string
  }) => void
  [EVENTS.MANAGER.CONFIG]: (_config: ManagerConfig) => void
  [EVENTS.QUIZZ.DATA]: (_quizz: QuizzWithId) => void
  [EVENTS.MANAGER.GAME_CREATED]: (_data: {
    gameId: string
    inviteCode: string
  }) => void
  [EVENTS.MANAGER.STATUS_UPDATE]: (_data: {
    status: Status
    data: StatusDataMap[Status]
  }) => void
  [EVENTS.MANAGER.NEW_PLAYER]: (_player: Player) => void
  [EVENTS.MANAGER.REMOVE_PLAYER]: (_playerId: string) => void
  [EVENTS.MANAGER.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.MANAGER.PLAYER_KICKED]: (_playerId: string) => void
  [EVENTS.MANAGER.UNAUTHORIZED]: () => void
  [EVENTS.MANAGER.CURRENT_USER]: (_user: { id: string; username: string; role: "admin" | "quizmaster" | "analyst" | "quizzer" } | null) => void
  [EVENTS.QUIZZ.TRASH_DATA]: (_trash: any[]) => void
  [EVENTS.RESULTS.PLAYER_DASHBOARD_DATA]: (_data: { attended: any[]; available?: any[] }) => void

  // Quizz events
  [EVENTS.QUIZZ.SAVE_SUCCESS]: (_data: { id: string }) => void
  [EVENTS.QUIZZ.UPDATE_SUCCESS]: (_data: { id: string }) => void
  [EVENTS.QUIZZ.ERROR]: (_message: string) => void

  // Results events
  [EVENTS.RESULTS.DATA]: (_result: GameResult) => void
}

export interface ClientToServerEvents {
  // Manager actions
  [EVENTS.GAME.CREATE]: (_quizzId: string) => void
  [EVENTS.MANAGER.AUTH]: (_password: string) => void
  [EVENTS.MANAGER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.LEAVE]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.KICK_PLAYER]: (_message: {
    gameId: string
    playerId: string
  }) => void
  [EVENTS.MANAGER.START_GAME]: (_message: {
    gameId: string
    mode?: "classic" | "accuracy"
    options?: {
      shuffleQuestions?: boolean
      doubleTime?: boolean
      shuffleAnswers?: boolean
      hideTextOnClient?: boolean
    }
  }) => void
  [EVENTS.MANAGER.ABORT_QUIZ]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.NEXT_QUESTION]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.SHOW_LEADERBOARD]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.GO_TO_QUESTION]: (_message: {
    gameId: string
    index: number
  }) => void
  [EVENTS.MANAGER.END_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.GET_CONFIG]: () => void
  [EVENTS.MANAGER.LOGOUT]: () => void
  [EVENTS.MANAGER.UPDATE_SETTINGS]: (_settings: { defaultWallpaper?: string; defaultAudio?: string }) => void
  [EVENTS.MANAGER.UPDATE_GAME_SETTINGS]: (_message: { gameId: string; wallpaper?: string; audio?: string }) => void
  [EVENTS.MANAGER.SIGN_UP]: (_credentials: { username: string; password: string }) => void
  [EVENTS.MANAGER.SIGN_IN]: (_credentials: { username: string; password: string }) => void
  [EVENTS.MANAGER.GET_USERS]: () => void
  [EVENTS.MANAGER.UPDATE_USER_ROLE]: (_data: { userId: string; role: "admin" | "quizmaster" | "analyst" | "quizzer" }) => void
  [EVENTS.MANAGER.DELETE_USER]: (_userId: string) => void
  [EVENTS.MANAGER.GET_CURRENT_USER]: () => void

  // Quizz actions
  [EVENTS.QUIZZ.GET]: (_id: string) => void
  [EVENTS.QUIZZ.SAVE]: (_quizz: unknown) => void
  [EVENTS.QUIZZ.UPDATE]: (_data: QuizzWithId) => void
  [EVENTS.QUIZZ.DELETE]: (_id: string) => void
  [EVENTS.QUIZZ.UPLOAD_MEDIA]: (
    _payload: { filename: string; fileType: string; data: Buffer },
    _callback: (_response: {
      success: boolean
      url?: string
      error?: string
    }) => void,
  ) => void
  [EVENTS.QUIZZ.GET_TRASH]: () => void
  [EVENTS.QUIZZ.RESTORE]: (_id: string) => void
  [EVENTS.QUIZZ.DELETE_PERMANENTLY]: (_id: string) => void
  [EVENTS.QUIZZ.GET_SOLO]: (_id: string) => void

  // Player actions
  [EVENTS.PLAYER.JOIN]: (_inviteCode: string) => void
  [EVENTS.PLAYER.LOGIN]: (
    _message: MessageWithoutStatus<{ username: string }>,
  ) => void
  [EVENTS.PLAYER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.PLAYER.LEAVE]: (_message: { gameId: string }) => void
  [EVENTS.PLAYER.SELECTED_ANSWER]: (
    _message: MessageWithoutStatus<{ answerKey: number | number[] }>,
  ) => void

  // Results actions
  [EVENTS.RESULTS.GET]: (_id: string) => void
  [EVENTS.RESULTS.DELETE]: (_id: string) => void
  [EVENTS.RESULTS.SAVE_SOLO]: (_result: GameResult) => void
  [EVENTS.RESULTS.PLAYER_DASHBOARD]: () => void

  // Common
  disconnect: () => void
}
