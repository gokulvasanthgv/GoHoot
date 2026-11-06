import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import { useNavigate } from "@tanstack/react-router"
import { SquarePen, Trash2, Upload } from "lucide-react"
import { type ChangeEvent, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  quizzFilter?: { creatorId: string; username: string } | null
  onClearFilter?: () => void
}

const ConfigManageQuizz = ({ quizzFilter, onClearFilter }: Props) => {
  const { quizz } = useConfig()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  const filteredQuizz = quizzFilter
    ? quizz.filter((q) => q.creatorId === quizzFilter.creatorId)
    : quizz

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  const handleDelete = (id: string) => () => {
    socket.emit(EVENTS.QUIZZ.DELETE, id)
    toast.success(t("manager:quizz.deleted"))
  }

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data: unknown = JSON.parse(event.target?.result as string)
        socket.emit(EVENTS.QUIZZ.SAVE, data)
      } catch {
        toast.error("Invalid JSON file")
      }
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quizzFilter && (
        <div className="bg-primary/10 mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-amber-800">
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            Showing quizzes by {quizzFilter.username}
          </span>
          <button
            onClick={onClearFilter}
            className="hover:text-primary min-h-11 shrink-0 px-2 underline transition"
          >
            Show All
          </button>
        </div>
      )}
      <div className="mb-4 flex shrink-0 gap-2">
        <Button
          className="min-h-11 min-w-0 flex-1"
          onClick={() => navigate({ to: "/manager/quizz" })}
        >
          {t("manager:quizz.create")}
        </Button>
        <Button
          className="min-h-11 min-w-11 shrink-0 bg-gray-200 px-3 text-gray-600"
          onClick={() => fileInputRef.current?.click()}
          title={t("manager:quizz.import")}
        >
          <Upload className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {filteredQuizz.map((q) => (
          <div
            key={q.id}
            className="flex min-h-16 w-full items-center justify-between gap-3 rounded-md py-2 pr-1.5 pl-3 outline outline-gray-300"
          >
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {q.subject}
            </p>
            <div className="flex shrink-0 gap-0.5">
              <button
                aria-label={`Edit quiz ${q.subject}`}
                className="flex size-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-600/10"
                onClick={() =>
                  navigate({
                    to: "/manager/quizz/$quizzId",
                    params: { quizzId: q.id },
                  })
                }
              >
                <SquarePen className="size-4" />
              </button>

              <AlertDialog
                trigger={
                  <button
                    aria-label={`Delete quiz ${q.subject}`}
                    className="flex size-11 items-center justify-center rounded-lg hover:bg-red-600/10"
                  >
                    <Trash2 className="size-4 stroke-red-500" />
                  </button>
                }
                title={t("manager:quizz.delete")}
                description={t("manager:quizz.deleteConfirm", {
                  name: q.subject,
                })}
                confirmLabel={t("common:delete")}
                onConfirm={handleDelete(q.id)}
              />
            </div>
          </div>
        ))}
        {filteredQuizz.length === 0 && (
          <p className="my-8 text-center text-gray-500">
            {quizzFilter
              ? "No quizzes found for this user"
              : t("manager:quizz.none")}
          </p>
        )}
      </div>
    </div>
  )
}

export default ConfigManageQuizz
