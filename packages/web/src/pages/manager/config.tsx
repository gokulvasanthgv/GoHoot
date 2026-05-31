import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import Background from "@razzia/web/components/Background"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import Configurations from "@razzia/web/features/manager/components/configurations"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

const ManagerConfigPage = () => {
  const { socket, isConnected } = useSocket()
  const { setGameId, setInviteCode, setStatus, setConfig, config } = useManagerStore()
  const { user } = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isConnected && user === null) {
      navigate({ to: "/manager" })
    }
  }, [isConnected, user, navigate])

  useEffect(() => {
    if (isConnected && user && !config) {
      socket.emit(EVENTS.MANAGER.GET_CONFIG)
    }
  }, [isConnected, user, config, socket])

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
  })

  useEvent(EVENTS.MANAGER.GAME_CREATED, ({ gameId, inviteCode }) => {
    setGameId(gameId)
    setInviteCode(inviteCode)
    setStatus(STATUS.SHOW_ROOM, {
      text: "game:waitingForPlayers",
      inviteCode,
    })
    navigate({ to: "/party/manager/$gameId", params: { gameId } })
  })

  if (!isConnected || (user && !config)) {
    return (
      <Background>
        <Loader className="h-23" />
      </Background>
    )
  }

  if (!config) {
    return null
  }

  return (
    <Background>
      <Configurations data={config} />
    </Background>
  )
}

export const Route = createFileRoute("/manager/config")({
  component: ManagerConfigPage,
})
