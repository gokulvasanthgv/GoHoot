import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import { type ChangeEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Settings } from "lucide-react"

const QuizzEditorHeader = () => {
  const { quizzId, subject, setSubject, questions, setGlobalTimer, wallpaper, setWallpaper, audio, setAudio } =
    useQuizzEditor()
  const { socket, clientId } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)

  const handleWallpaperUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.")
      return
    }

    setIsUploadingWallpaper(true)
    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId ?? "")}`

    fetch(url, {
      method: "POST",
      body: file,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Upload failed")
        return res.json()
      })
      .then((response: { success: boolean; url?: string; error?: string }) => {
        setIsUploadingWallpaper(false)
        if (response.success && response.url) {
          setWallpaper(response.url)
          toast.success("Wallpaper uploaded successfully")
        } else {
          toast.error(response.error || "Upload failed")
        }
      })
      .catch(() => {
        setIsUploadingWallpaper(false)
        toast.error("Upload failed")
      })
  }

  const handleAudioUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file.")
      return
    }

    setIsUploadingAudio(true)
    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId ?? "")}`

    fetch(url, {
      method: "POST",
      body: file,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Upload failed")
        return res.json()
      })
      .then((response: { success: boolean; url?: string; error?: string }) => {
        setIsUploadingAudio(false)
        if (response.success && response.url) {
          setAudio(response.url)
          toast.success("Audio uploaded successfully")
        } else {
          toast.error(response.error || "Upload failed")
        }
      })
      .catch(() => {
        setIsUploadingAudio(false)
        toast.error("Upload failed")
      })
  }

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
      socket.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, subject, questions, wallpaper, audio })
    } else {
      socket.emit(EVENTS.QUIZZ.SAVE, { subject, questions, wallpaper, audio })
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
        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 p-2.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition"
          title="Quiz Settings"
          type="button"
        >
          <Settings className="size-5" />
        </button>
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

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in fade-in duration-200 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
              <Settings className="size-5 text-indigo-600 animate-spin-slow" />
              <h3 className="text-lg font-bold text-gray-900">Quiz Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Quiz Wallpaper
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wallpaper || ""}
                    onChange={(e) => setWallpaper(e.target.value)}
                    placeholder="Wallpaper image URL..."
                    className="flex-1 rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
                  />
                  <label className="shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 cursor-pointer transition select-none active:scale-95">
                    {isUploadingWallpaper ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleWallpaperUpload}
                      className="hidden"
                      disabled={isUploadingWallpaper}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Background Music
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={audio || ""}
                    onChange={(e) => setAudio(e.target.value)}
                    placeholder="Background music URL..."
                    className="flex-1 rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
                  />
                  <label className="shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 cursor-pointer transition select-none active:scale-95">
                    {isUploadingAudio ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                      disabled={isUploadingAudio}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default QuizzEditorHeader
