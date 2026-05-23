import Room from "@razzia/web/features/game/components/join/Room"
import Username from "@razzia/web/features/game/components/join/Username"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerAuthPage = () => {
  const navigate = useNavigate()
  const { isConnected, connect } = useSocket()
  const { player } = usePlayerStore()
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

  useEvent("game:errorMessage", (message) => {
    toast.error(t(message))
  })

  if (player) {
    return <Username />
  }

  return <Room />
}

export const Route = createFileRoute("/(auth)/")({
  component: PlayerAuthPage,
})
