import { EVENTS } from "@razzia/common/constants"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import ManagerAuthForm from "@razzia/web/features/manager/components/ManagerAuthForm"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import {
  applySession,
  signIn,
  signUp,
} from "@razzia/web/features/manager/queries"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ManagerAuthPage = () => {
  const { setConfig } = useManagerStore()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()

  useEffect(() => {
    if (!isConnected) {
      return
    }

    socket.emit(EVENTS.MANAGER.GET_CURRENT_USER)
  }, [isConnected, socket])

  useEvent(EVENTS.MANAGER.CURRENT_USER, (user) => {
    if (user) {
      useUserStore.getState().setUser(user)

      if (user.role !== "quizzer") {
        socket.emit(EVENTS.MANAGER.GET_CONFIG)
      }

      navigate({ to: "/" })
    } else {
      useUserStore.getState().setUser(null)
    }
  })

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    setConfig(data)
  })

  const handleSignIn = (credentials: {
    username: string
    password: string
  }) => {
    void signIn(credentials)
      .then((session) => {
        applySession(session)
        navigate({ to: "/" })
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

  const handleSignUp = (credentials: {
    username: string
    password: string
  }) => {
    void signUp(credentials)
      .then((session) => {
        applySession(session)
        navigate({ to: "/" })
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

  return <ManagerAuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} />
}

export const Route = createFileRoute("/(auth)/manager/")({
  component: ManagerAuthPage,
})
