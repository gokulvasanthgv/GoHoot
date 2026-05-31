import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { RotateCcw, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigTrash = () => {
  const { socket } = useSocket()
  const { trash } = useConfig()
  const { user: currentUser } = useUserStore()
  const { t } = useTranslation()

  const handleRestore = (id: string) => () => {
    socket.emit(EVENTS.QUIZZ.RESTORE, id)
    toast.success(t("manager:quizz.restored") || "Quiz restored successfully")
  }

  const handleDeletePermanently = (id: string) => () => {
    socket.emit(EVENTS.QUIZZ.DELETE_PERMANENTLY, id)
    toast.success(t("manager:quizz.permanentlyDeleted") || "Quiz permanently deleted along with its assets")
  }

  const formatDate = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return `${d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {trash?.map((q) => (
          <div
            key={q.id}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 outline outline-gray-300 bg-white"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-800">{q.subject}</p>
              {q.deletedAt && (
                <p className="text-[10px] text-gray-400">
                  Deleted: {formatDate(q.deletedAt)}
                </p>
              )}
            </div>

            <div className="flex gap-1 shrink-0">
              <button
                className="rounded-sm p-2 text-gray-600 hover:bg-gray-100 transition"
                onClick={handleRestore(q.id)}
                title={t("manager:quizz.restore") || "Restore Quiz"}
              >
                <RotateCcw className="size-4" />
              </button>

              {currentUser?.role === "admin" && (
                <AlertDialog
                  trigger={
                    <button className="rounded-sm p-2 hover:bg-red-600/10 transition" title="Delete Permanently">
                      <Trash2 className="size-4 stroke-red-500" />
                    </button>
                  }
                  title={t("manager:quizz.deletePermanentTitle") || "Delete Quiz Permanently"}
                  description={t("manager:quizz.deletePermanentConfirm", { name: q.subject }) || `Are you sure you want to permanently delete ${q.subject}? This will permanently remove the quiz and all its uploaded media assets.`}
                  confirmLabel={t("common:delete") || "Delete"}
                  onConfirm={handleDeletePermanently(q.id)}
                />
              )}
            </div>
          </div>
        ))}

        {(!trash || trash.length === 0) && (
          <p className="my-8 text-center text-gray-500">
            {t("manager:quizz.trashEmpty") || "Trash is empty"}
          </p>
        )}
      </div>
    </div>
  )
}

export default ConfigTrash
