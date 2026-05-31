import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  onOpenQuizzes?: (userId: string, username: string) => void
}

const ConfigUsers = ({ onOpenQuizzes }: Props) => {
  const { socket } = useSocket()
  const { users } = useConfig()
  const { user: currentUser } = useUserStore()
  const { t } = useTranslation()

  const handleRoleChange = (userId: string, newRole: "admin" | "quizmaster" | "analyst" | "quizzer") => {
    socket.emit(EVENTS.MANAGER.UPDATE_USER_ROLE, { userId, role: newRole })
    toast.success(t("manager:users.roleUpdated") || "User role updated successfully")
  }

  const handleDelete = (userId: string) => () => {
    socket.emit(EVENTS.MANAGER.DELETE_USER, userId)
    toast.success(t("manager:users.deleted") || "User deleted successfully")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {users?.map((u) => (
          <div
            key={u.id}
            className="flex w-full items-center justify-between rounded-md px-3 py-2.5 outline outline-gray-300 bg-white"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-800">{u.username}</p>
              <p className="text-[10px] text-gray-400">
                Created: {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <select
                value={u.role}
                disabled={u.id === currentUser?.id || u.username === "admin"}
                onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                className="rounded border border-gray-300 p-1 text-sm bg-white font-medium text-gray-700 focus:outline-none"
              >
                <option value="admin">Admin</option>
                <option value="quizmaster">Quizmaster</option>
                <option value="analyst">Analyst</option>
                <option value="quizzer">Quizzer</option>
              </select>

              {currentUser?.role === "admin" && u.id !== currentUser?.id && (
                <button
                  onClick={() => onOpenQuizzes?.(u.id, u.username)}
                  className="px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition shrink-0"
                >
                  Open Quizzes
                </button>
              )}

              {u.id !== currentUser?.id && u.username !== "admin" ? (
                <AlertDialog
                  trigger={
                    <button className="rounded-sm p-2 hover:bg-red-600/10 transition">
                      <Trash2 className="size-4 stroke-red-500" />
                    </button>
                  }
                  title={t("manager:users.deleteTitle") || "Delete User"}
                  description={t("manager:users.deleteConfirm", { name: u.username }) || `Are you sure you want to delete user ${u.username}?`}
                  confirmLabel={t("common:delete") || "Delete"}
                  onConfirm={handleDelete(u.id)}
                />
              ) : (
                <div className="size-8 shrink-0" />
              )}
            </div>
          </div>
        ))}

        {(!users || users.length === 0) && (
          <p className="my-8 text-center text-gray-500">
            No registered users found
          </p>
        )}
      </div>
    </div>
  )
}

export default ConfigUsers
