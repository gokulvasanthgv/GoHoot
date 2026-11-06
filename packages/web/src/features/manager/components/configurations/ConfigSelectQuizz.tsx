import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import { createGame } from "@razzia/web/features/manager/queries"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { STATUS } from "@razzia/common/types/game/status"
import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigSelectQuizz = () => {
  const navigate = useNavigate()
  const create = useMutation({
    mutationFn: createGame,
    onSuccess: ({ gameId, inviteCode }) => {
      const store = useManagerStore.getState()
      store.setGameId(gameId)
      store.setInviteCode(inviteCode)
      store.setStatus(STATUS.SHOW_ROOM, {
        text: "game:waitingForPlayers",
        inviteCode,
      })
      navigate({ to: "/party/manager/$gameId", params: { gameId } })
    },
    onError: (error: Error) => toast.error(t(error.message)),
  })
  const { quizz: quizzList } = useConfig()
  const [selected, setSelected] = useState<string | null>(null)
  const { t } = useTranslation()

  const handleSelect = (id: string) => () => {
    if (selected === id) {
      setSelected(null)
    } else {
      setSelected(id)
    }
  }

  const handleSubmit = () => {
    if (!selected) {
      toast.error(t("manager:quizz.pleaseSelect"))

      return
    }

    if (!create.isPending) {
      create.mutate(selected)
    }
  }

  const compatible = quizzList.filter((q) => !q.incompatible)
  const incompatible = quizzList.filter((q) => q.incompatible)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quizzList.length > 0 && (
        <AlertDialog
          trigger={
            <Button className="mb-4 w-full shrink-0" disabled={!selected}>
              {t("manager:quizz.startGame")}
            </Button>
          }
          title="Start Quiz"
          description="Are you sure you want to start this quiz? This will initialize the session and allow players to join."
          confirmLabel="Start"
          onConfirm={handleSubmit}
        />
      )}
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-0.5">
        {compatible.length > 0 && (
          <div className="space-y-2">
            {compatible.map((quizz) => (
              <button
                key={quizz.id}
                className="flex w-full items-center justify-between rounded-md p-3 outline outline-gray-300"
                onClick={handleSelect(quizz.id)}
              >
                {quizz.subject}

                <div
                  className={clsx(
                    "size-5 rounded p-0.5 outline outline-offset-3 outline-gray-300",
                    selected === quizz.id && "bg-primary border-primary/80",
                  )}
                >
                  {selected === quizz.id && (
                    <Check className="size-full stroke-4 text-white" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {incompatible.length > 0 && (
          <div className="space-y-2">
            <p className="mt-2 text-xs font-bold tracking-wider text-red-500 uppercase">
              Incompatible Quizzes (Options &gt; 65 chars)
            </p>
            {incompatible.map((quizz) => (
              <button
                key={quizz.id}
                className="flex w-full items-center justify-between rounded-md bg-red-50/20 p-3 outline outline-red-200"
                onClick={handleSelect(quizz.id)}
              >
                <div className="text-left">
                  <p className="font-medium text-gray-800">{quizz.subject}</p>
                  <p className="text-[10px] text-red-500">
                    Warning: Options exceed 65 characters.
                  </p>
                </div>

                <div
                  className={clsx(
                    "size-5 rounded p-0.5 outline outline-offset-3 outline-red-200",
                    selected === quizz.id && "border-red-600/80 bg-red-500",
                  )}
                >
                  {selected === quizz.id && (
                    <Check className="size-full stroke-4 text-white" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!quizzList.length && (
          <div className="my-8 text-center text-gray-500">
            <p>{t("manager:quizz.notFound")}</p>
            <p className="text-sm">{t("manager:quizz.pleaseCreate")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfigSelectQuizz
