import { EVENTS } from "@razzia/common/constants"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/manager/quizz")({
  component: RouteComponent,
})

function RouteComponent() {
  const { socket, isConnected } = useSocket()
  const { config, setConfig } = useManagerStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isConnected && !config) {
      socket.emit(EVENTS.MANAGER.GET_CONFIG)
    }
  }, [isConnected, config, socket])

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
  })

  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    navigate({ to: "/manager" })
  })

  if (!config) {
    return (
      <div className="flex h-svh items-center justify-center bg-gray-50">
        <Loader className="text-background max-h-23" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {!isConnected && (
        <div className="absolute top-0 right-0 left-0 z-50 animate-pulse bg-amber-500 py-1.5 text-center text-xs font-semibold text-white shadow-md">
          Connection lost. Reconnecting to server... Unsaved changes will sync
          once reconnected.
        </div>
      )}
      <Outlet />
    </div>
  )
}
