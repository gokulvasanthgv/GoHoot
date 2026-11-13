import { EVENTS } from "@razzia/common/constants"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useEffect } from "react"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const {
    gameId,
    status,
    reset,
    restoreGame,
    applyGameStatus,
    applyGameSettings,
  } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  useEvent(EVENTS.PLAYER.SUCCESS_RECONNECT, (game) => {
    if (game.gameId === gameIdParam) {
      restoreGame(game)
      setQuestionStates(game.currentQuestion)
    }
  })

  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
    }
  }, [isConnected, gameIdParam, socket])

  useEvent(EVENTS.GAME.STATUS, (update) => {
    if (update.gameId === gameIdParam && update.name in GAME_STATE_COMPONENTS) {
      applyGameStatus(update)
    }
  })

  useEvent(EVENTS.GAME.SETTINGS, (settings) => {
    if (settings.gameId === gameIdParam) {
      applyGameSettings(settings)
    }
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    navigate({ to: "/" })
    reset()
    setQuestionStates(null)
    toast.error(t(message))
  })

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS, status.name)
      ? GAME_STATE_COMPONENTS[status.name]
      : null

  if (!status || gameId !== gameIdParam) {
    return <GameWrapper statusName={undefined} />
  }

  return (
    <GameWrapper statusName={status.name}>
      {CurrentComponent && <CurrentComponent data={status.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/$gameId")({
  component: PlayerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.PLAYER.LEAVE, { gameId })
  },
})
