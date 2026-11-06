import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"

import { useNavigate } from "@tanstack/react-router"
import { type KeyboardEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { joinGame } from "@razzia/web/features/manager/queries"
import toast from "react-hot-toast"

const Username = () => {
  const { socket } = useSocket()
  const { gameId, inviteCode, login, setStatus } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const { t } = useTranslation()

  const handleLogin = () => {
    if (!gameId) {
      return
    }

    if (!inviteCode) {
      return
    }

    void joinGame(inviteCode, username)
      .then(({ gameId: joinedGameId, ticket }) => {
        if (ticket) {
          socket.emit(EVENTS.PLAYER.LOGIN, { ticket })
        } else {
          login(username)
          navigate({ to: "/party/$gameId", params: { gameId: joinedGameId } })
        }
      })
      .catch((failure: unknown) =>
        toast.error(
          t(
            failure instanceof Error
              ? failure.message
              : "errors:api.serverError",
          ),
        ),
      )
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (joinedGameId) => {
    setStatus(STATUS.WAIT, { text: "game:waitingForPlayers" })
    login(username)

    navigate({ to: "/party/$gameId", params: { gameId: joinedGameId } })
  })

  return (
    <Card>
      <Input
        className="text-center"
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4" onClick={handleLogin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
