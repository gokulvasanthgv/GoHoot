import Room from "@razzia/web/features/game/components/join/Room"
import Username from "@razzia/web/features/game/components/join/Username"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import PlayerDashboard from "@razzia/web/features/game/components/PlayerDashboard"
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { EVENTS } from "@razzia/common/constants"

const PlayerAuthPage = () => {
  const navigate = useNavigate()
  const { isConnected, connect, socket } = useSocket()
  const { player } = usePlayerStore()
  const { user, setUser } = useUserStore()
  const { t } = useTranslation()

  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const matches = new RegExp(
        `(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`,
      ).exec(document.cookie)

      return matches ? decodeURIComponent(matches[1]) : null
    }

    const activeGameId =
      localStorage.getItem("active_game_id") || getCookie("active_game_id")

    if (activeGameId) {
      navigate({ to: "/party/$gameId", params: { gameId: activeGameId } })
    }
  }, [navigate])

  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [connect, isConnected])

  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.MANAGER.GET_CURRENT_USER)
    }
  }, [isConnected, socket])

  useEvent(EVENTS.MANAGER.CURRENT_USER, (currentUser) => {
    setUser(currentUser)
  })

  useEvent("game:errorMessage", (message) => {
    toast.error(t(message))
  })

  if (user) {
    return <PlayerDashboard />
  }

  if (player) {
    return <Username />
  }

  return (
    <div className="relative z-10 flex flex-col items-center gap-4">
      <Room />
      <Link
        to="/manager"
        className="cursor-pointer text-sm font-semibold text-white/80 underline transition hover:text-white"
      >
        Sign In / Sign Up
      </Link>
    </div>
  )
}

export const Route = createFileRoute("/(auth)/")({
  component: PlayerAuthPage,
})
