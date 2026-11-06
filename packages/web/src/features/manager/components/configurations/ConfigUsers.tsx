import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import { useUserStore, type User } from "@razzia/web/features/game/stores/user"
import { Trash2 } from "lucide-react"
import { useState } from "react"
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

  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const handleRoleChange = (userId: string, newRole: User["role"]) => {
    socket.emit(EVENTS.MANAGER.UPDATE_USER_ROLE, { userId, role: newRole })
    toast.success(
      t("manager:users.roleUpdated", {
        defaultValue: "User role updated successfully",
      }),
    )
  }

  const handleDelete = (userId: string) => () => {
    socket.emit(EVENTS.MANAGER.DELETE_USER, userId)
    toast.success(
      t("manager:users.deleted", { defaultValue: "User deleted successfully" }),
    )
  }

  const handleAdminResetPassword = (userId: string) => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")

      return
    }

    socket.emit(EVENTS.MANAGER.ADMIN_RESET_PASSWORD, { userId, newPassword })
  }

  useEvent("manager:adminPasswordResetSuccess", () => {
    toast.success("User password has been reset successfully")
    setResettingUserId(null)
    setNewPassword("")
  })

  return (
    <div className="@container min-w-0">
      <ul className="space-y-3">
        {users?.map((u) => (
          <li
            key={u.id}
            className="min-w-0 rounded-xl border border-gray-200 bg-white"
          >
            <div className="grid min-w-0 gap-4 p-4 @3xl:grid-cols-[minmax(12rem,1fr)_minmax(0,30rem)] @3xl:items-center">
              <div className="min-w-0">
                <p className="text-base font-semibold [overflow-wrap:anywhere] text-gray-800 sm:text-lg">
                  {u.username}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Created:{" "}
                  <time dateTime={u.createdAt}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </time>
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                <div className="col-span-2 min-w-0 sm:w-40">
                  <label
                    htmlFor={`role-${u.id}`}
                    className="mb-1 block text-xs font-medium text-gray-500"
                  >
                    Role
                  </label>
                  <select
                    id={`role-${u.id}`}
                    aria-label={`Role for ${u.username}`}
                    value={u.role}
                    disabled={
                      u.id === currentUser?.id || u.username === "admin"
                    }
                    onChange={(e) =>
                      handleRoleChange(u.id, e.target.value as User["role"])
                    }
                    className="focus-visible:outline-primary min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="quizmaster">Quizmaster</option>
                    <option value="analyst">Analyst</option>
                    <option value="quizzer">Quizzer</option>
                  </select>
                </div>

                {currentUser?.role === "admin" && u.id !== currentUser.id && (
                  <>
                    <button
                      onClick={() => onOpenQuizzes?.(u.id, u.username)}
                      className="bg-primary/10 hover:bg-primary/20 focus-visible:outline-primary min-h-11 min-w-0 rounded-lg px-3 py-2 text-sm leading-5 font-semibold text-amber-800 transition focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Open Quizzes
                    </button>
                    <button
                      onClick={() => {
                        setResettingUserId(
                          resettingUserId === u.id ? null : u.id,
                        )
                        setNewPassword("")
                      }}
                      aria-expanded={resettingUserId === u.id}
                      aria-controls={`reset-password-${u.id}`}
                      className="focus-visible:outline-primary min-h-11 min-w-0 rounded-lg bg-indigo-50 px-3 py-2 text-sm leading-5 font-semibold text-indigo-600 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Reset Password
                    </button>
                  </>
                )}

                {u.id !== currentUser?.id && u.username !== "admin" ? (
                  <AlertDialog
                    trigger={
                      <button
                        aria-label={`Delete user ${u.username}`}
                        className="focus-visible:outline-primary col-span-2 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-2"
                      >
                        <Trash2 className="size-4 stroke-red-500" />
                        <span className="sm:sr-only">Delete User</span>
                      </button>
                    }
                    title={t("manager:users.deleteTitle", {
                      defaultValue: "Delete User",
                    })}
                    description={t("manager:users.deleteConfirm", {
                      name: u.username,
                      defaultValue:
                        "Are you sure you want to delete user {{name}}?",
                    })}
                    confirmLabel={t("common:delete") || "Delete"}
                    onConfirm={handleDelete(u.id)}
                  />
                ) : null}
              </div>
            </div>

            {resettingUserId === u.id && (
              <form
                id={`reset-password-${u.id}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  handleAdminResetPassword(u.id)
                }}
                className="grid min-w-0 grid-cols-2 gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
              >
                <label className="col-span-2 min-w-0 text-sm font-medium text-gray-700 sm:col-span-1">
                  New password (min 8 characters)
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="focus-visible:outline-primary mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
                  />
                </label>
                <button
                  type="submit"
                  className="focus-visible:outline-primary min-h-11 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResettingUserId(null)
                    setNewPassword("")
                  }}
                  className="focus-visible:outline-primary min-h-11 rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Cancel
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {(!users || users.length === 0) && (
        <p className="my-8 text-center text-gray-500">
          No registered users found
        </p>
      )}
    </div>
  )
}

export default ConfigUsers
