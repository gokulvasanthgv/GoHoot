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
import { useQuery } from "@tanstack/react-query"
import { managerConfigQuery } from "@razzia/web/features/manager/queries"
import { queryClient } from "@razzia/web/lib/query-client"

const ManagerConfigPage = () => {
  const { socket, isConnected } = useSocket()
  const { setGameId, setInviteCode, setStatus, setConfig, config } =
    useManagerStore()
  const { user } = useUserStore()
  const navigate = useNavigate()
  const configuration = useQuery({
    ...managerConfigQuery(user?.id ?? ""),
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (configuration.data) {
      setConfig(configuration.data)
    }
  }, [configuration.data, setConfig])

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

    if (user) {
      queryClient.setQueryData(managerConfigQuery(user.id).queryKey, data)
    }
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
      <Background variant="dashboard">
        <Loader className="h-23" />
      </Background>
    )
  }

  if (!config) {
    return null
  }

  return (
    <Background variant="dashboard">
      <Configurations data={config} />
    </Background>
  )
}

export const Route = createFileRoute("/manager/config")({
  component: ManagerConfigPage,
})
