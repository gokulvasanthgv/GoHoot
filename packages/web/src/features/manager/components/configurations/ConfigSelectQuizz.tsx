import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigSelectQuizz = () => {
  const { socket } = useSocket()
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

    socket.emit(EVENTS.GAME.CREATE, selected)
  }

  const compatible = quizzList.filter((q) => !q.incompatible)
  const incompatible = quizzList.filter((q) => q.incompatible)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quizzList.length > 0 && (
        <AlertDialog
          trigger={
            <Button className="mb-4 shrink-0 w-full" disabled={!selected}>
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
            <p className="text-xs font-bold uppercase tracking-wider text-red-500 mt-2">
              Incompatible Quizzes (Options &gt; 65 chars)
            </p>
            {incompatible.map((quizz) => (
              <button
                key={quizz.id}
                className="flex w-full items-center justify-between rounded-md p-3 outline outline-red-200 bg-red-50/20"
                onClick={handleSelect(quizz.id)}
              >
                <div className="text-left">
                  <p className="font-medium text-gray-800">{quizz.subject}</p>
                  <p className="text-[10px] text-red-500">Warning: Options exceed 65 characters.</p>
                </div>

                <div
                  className={clsx(
                    "size-5 rounded p-0.5 outline outline-offset-3 outline-red-200",
                    selected === quizz.id && "bg-red-500 border-red-600/80",
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
