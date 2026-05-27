import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import type { ChangeEvent } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QuizzEditorHeader = () => {
  const { quizzId, subject, setSubject, questions, setGlobalTimer, wallpaper } =
    useQuizzEditor()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleChangeSubject = (e: ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value)
  }

  const handleSetGlobalTimer = () => {
    const rawVal = prompt(
      "Enter a time limit in seconds for all questions (between 5 and 120):",
      "20",
    )
    if (rawVal === null) return

    const parsed = parseInt(rawVal, 10)
    if (isNaN(parsed) || parsed < 5 || parsed > 120) {
      toast.error(
        "Invalid timer duration. Please enter a number between 5 and 120.",
      )
      return
    }

    setGlobalTimer(parsed)
    toast.success(`Successfully set timer to ${parsed}s for all questions.`)
  }

  const handleSave = () => {
    if (quizzId) {
      socket.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, subject, questions, wallpaper })
    } else {
      socket.emit(EVENTS.QUIZZ.SAVE, { subject, questions, wallpaper })
    }
  }

  useEvent(EVENTS.QUIZZ.SAVE_SUCCESS, () => {
    toast.success(t("quizz:quizzSaved"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.UPDATE_SUCCESS, (_data) => {
    toast.success(t("quizz:quizzUpdated"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  return (
    <header className="z-20 flex h-14 items-center justify-between gap-4 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-6">
        <Input
          variant="sm"
          className="w-64"
          value={subject}
          onChange={handleChangeSubject}
          placeholder={t("quizz:titleQuizzPlaceholder")}
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="text-md border border-gray-200 bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
          onClick={handleSetGlobalTimer}
        >
          Set Global Timer
        </Button>
        <Button
          className="text-md bg-gray-200 px-4 py-2 font-semibold text-gray-600"
          onClick={() => navigate({ to: "/manager" })}
        >
          {t("common:exit")}
        </Button>
        <Button className="bg-primary text-md px-4 py-2" onClick={handleSave}>
          {t("common:save")}
        </Button>
      </div>
    </header>
  )
}

export default QuizzEditorHeader
