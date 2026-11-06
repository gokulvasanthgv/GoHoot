import { api, unwrap, unwrapEmpty } from "@razzia/web/lib/api"
import { queryClient } from "@razzia/web/lib/query-client"
import { setToken } from "@razzia/web/lib/session"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { socketClient } from "@razzia/web/features/game/contexts/socket-context"
import type { SessionResponse } from "@razzia/common/types/auth"
import { queryOptions } from "@tanstack/react-query"
import type { QuizzValidated } from "@razzia/common/validators/quizz"

export const managerConfigQuery = (userId: string) =>
  queryOptions({
    queryKey: ["manager-config", userId],
    queryFn: () => unwrap(api.config.$get()),
  })

export const quizzQuery = (id: string) =>
  queryOptions({
    queryKey: ["quizz", id],
    queryFn: () => unwrap(api.quizz[":id"].$get({ param: { id } })),
  })

export const resultQuery = (id: string) =>
  queryOptions({
    queryKey: ["result", id],
    queryFn: () => unwrap(api.results[":id"].$get({ param: { id } })),
  })

export const createGame = (quizzId: string) =>
  unwrap(api.games.$post({ json: { quizzId } }))

export const saveQuiz = (json: QuizzValidated) =>
  unwrap(api.quizz.$post({ json })).then((result) => {
    void queryClient.invalidateQueries({ queryKey: ["manager-config"] })

    return result
  })

export const updateQuiz = (id: string, json: QuizzValidated) =>
  unwrap(api.quizz[":id"].$patch({ param: { id }, json })).then((result) => {
    void queryClient.invalidateQueries({ queryKey: ["manager-config"] })
    void queryClient.invalidateQueries({ queryKey: ["quizz", id] })

    return result
  })

export const deleteQuiz = (id: string) =>
  unwrapEmpty(api.quizz[":id"].$delete({ param: { id } })).then(() =>
    queryClient.invalidateQueries({ queryKey: ["manager-config"] }),
  )

export const applySession = (session: SessionResponse): void => {
  const previous = useUserStore.getState().user
  setToken(session.token)

  if (previous?.id !== session.user?.id) {
    queryClient.clear()
    useManagerStore.getState().reset()
  }

  useUserStore.getState().setUser(session.user)
  socketClient.disconnect()
  socketClient.connect()
}

export const signIn = (json: { username: string; password: string }) =>
  unwrap(api.auth.signin.$post({ json }))

export const signUp = (json: { username: string; password: string }) =>
  unwrap(api.auth.signup.$post({ json }))

export const logout = () => unwrap(api.auth.logout.$post()).then(applySession)

export const joinGame = (inviteCode: string, username: string) =>
  unwrap(api.games.join.$post({ json: { inviteCode, username } }))
