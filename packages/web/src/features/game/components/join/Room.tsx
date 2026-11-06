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
  const { join, setInviteCode } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()

  const navigate = useNavigate()

  const handleJoin = () => {
    setInviteCode(invitation.replace(/\s/gu, ""))
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
    setInviteCode(pin)
    hasJoinedRef.current = true
  }, [pin, isConnected, socket, setInviteCode])

  return (
    <Card className="border-gray-150 flex w-full max-w-sm flex-col items-center rounded-2xl border bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-8">
      <p className="mb-4 text-center text-lg font-bold tracking-wide text-gray-700 uppercase">
        {t("game:pinLabel") || "PIN Code"}
      </p>
      <PinInput
        value={invitation}
        onChange={setInvitation}
        className="w-full max-w-xs justify-center"
      />
      <Button
        className="mt-6 w-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-98"
        onClick={handleJoin}
      >
        {t("common:submit") || "Join"}
      </Button>
    </Card>
  )
}

export default Room
