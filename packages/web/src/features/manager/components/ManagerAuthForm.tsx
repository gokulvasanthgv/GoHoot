import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { type KeyboardEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { motion } from "motion/react"
import { EVENTS } from "@razzia/common/constants"

interface Props {
  onSignIn: (_credentials: { username: string; password: string }) => void
  onSignUp: (_credentials: { username: string; password: string }) => void
}

const ManagerAuthForm = ({ onSignIn, onSignUp }: Props) => {
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { t } = useTranslation(["manager", "common"])
  const { socket } = useSocket()

  const handleSubmit = () => {
    if (!username.trim() || password.length < 4) {
      toast.error(t("errors:auth.invalidInput") || "Invalid username or password (min 4 characters)")
      return
    }

    if (isSignUpMode) {
      onSignUp({ username, password })
    } else {
      onSignIn({ username, password })
    }
  }

  const handleForgotPasswordSubmit = () => {
    if (!username.trim()) {
      toast.error("Username is required")
      return
    }
    socket.emit("manager:forgotPassword", { username })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      if (isForgotPasswordMode) {
        handleForgotPasswordSubmit()
      } else {
        handleSubmit()
      }
    }
  }

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
  })

  useEvent("manager:forgotPasswordSuccess", (res: any) => {
    if (res.success) {
      toast.success("Password reset requested. Admin has been notified.")
      setIsForgotPasswordMode(false)
      setUsername("")
    } else {
      toast.error(t(res.error) || "User not found or request failed")
    }
  })

  if (isForgotPasswordMode) {
    return (
      <Card className="w-full max-w-sm overflow-hidden p-6 shadow-2xl backdrop-blur-md bg-white/95">
        <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">Forgot Password</h3>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Enter your username to request a password reset from the administrator.
        </p>

        <motion.div
          layout
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t("manager:username", "Username")}
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("manager:username", "Username")}
              className="w-full"
            />
          </div>

          <Button className="mt-4 w-full shadow-lg" onClick={handleForgotPasswordSubmit}>
            Request Reset
          </Button>

          <button
            type="button"
            onClick={() => setIsForgotPasswordMode(false)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 mt-2 text-center"
          >
            Back to Sign In
          </button>
        </motion.div>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm overflow-hidden p-6 shadow-2xl backdrop-blur-md bg-white/95">
      <div className="flex border-b border-gray-100 mb-6 bg-gray-50 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setIsSignUpMode(false)}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-md transition-all duration-200 ${
            !isSignUpMode ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {t("manager:signIn", "Sign In")}
        </button>
        <button
          type="button"
          onClick={() => setIsSignUpMode(true)}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-md transition-all duration-200 ${
            isSignUpMode ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {t("manager:signUp", "Sign Up")}
        </button>
      </div>

      <motion.div
        layout
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {t("manager:username", "Username")}
          </label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("manager:username", "Username")}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t("manager:password") || "Password"}
            </label>
            {!isSignUpMode && (
              <button
                type="button"
                onClick={() => setIsForgotPasswordMode(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("manager:passwordPlaceholder") || "••••••••"}
            className="w-full"
          />
        </div>

        <Button className="mt-4 w-full shadow-lg" onClick={handleSubmit}>
          {isSignUpMode ? t("manager:signUp", "Sign Up") : t("manager:signIn", "Sign In")}
        </Button>
      </motion.div>
    </Card>
  )
}

export default ManagerAuthForm
