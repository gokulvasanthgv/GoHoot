import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import PinInput from "@razzia/web/components/PinInput"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const Room = () => {
  const { socket, isConnected } = useSocket()
  const { join } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()

  const navigate = useNavigate()

  const handleJoin = () => {
    socket.emit(EVENTS.PLAYER.JOIN, invitation.replace(/\s/gu, ""))
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (payload) => {
    if (typeof payload === "string") {
      join(payload)

      return
    }

    const { gameId, alreadyJoined, username } = payload
    if (alreadyJoined && username) {
      join(gameId)
      const store = usePlayerStore.getState()
      store.login(username)
      navigate({ to: "/party/$gameId", params: { gameId } })
    } else {
      join(gameId)
    }
  })

  useEffect(() => {
    if (!isConnected || !pin || hasJoinedRef.current) {
      return
    }

    socket.emit("player:join", pin)
    hasJoinedRef.current = true
  }, [pin, isConnected, socket])

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8 bg-white/95 backdrop-blur-md shadow-2xl border border-gray-150 rounded-2xl flex flex-col items-center">
      <p className="mb-4 text-center font-bold text-gray-700 text-lg uppercase tracking-wide">
        {t("game:pinLabel") || "PIN Code"}
      </p>
      <PinInput value={invitation} onChange={setInvitation} className="w-full justify-center max-w-xs" />
      <Button className="mt-6 w-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-98" onClick={handleJoin}>
        {t("common:submit") || "Join"}
      </Button>
    </Card>
  )
}

export default Room
