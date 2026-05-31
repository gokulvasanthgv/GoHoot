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
import Background from "@razzia/web/components/Background"

const PlayerAuthPage = () => {
  const navigate = useNavigate()
  const { isConnected, connect, socket } = useSocket()
  const { player } = usePlayerStore()
  const { user, setUser } = useUserStore()
  const { t } = useTranslation()

  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"
      ))
      return matches ? decodeURIComponent(matches[1]) : null
    }

    const activeGameId = localStorage.getItem("active_game_id") || getCookie("active_game_id")
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
    <div className="flex flex-col items-center gap-4 z-10 relative">
      <Room />
      <Link
        to="/manager"
        className="text-white/80 hover:text-white text-sm font-semibold underline transition cursor-pointer"
      >
        Sign In / Sign Up
      </Link>
    </div>
  )
}

export const Route = createFileRoute("/(auth)/")({
  component: PlayerAuthPage,
})
