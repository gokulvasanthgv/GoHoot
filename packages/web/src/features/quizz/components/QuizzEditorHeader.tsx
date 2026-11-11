import { authFetch } from "@razzia/web/lib/api"
import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import { type ChangeEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Settings, Timer, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { saveQuiz, updateQuiz } from "@razzia/web/features/manager/queries"
import {
  mediaUrlValidator,
  quizzValidator,
} from "@razzia/common/validators/quizz"

const QuizzEditorHeader = () => {
  const {
    quizzId,
    subject,
    setSubject,
    questions,
    setGlobalTimer,
    wallpaper,
    setWallpaper,
    audio,
    setAudio,
    focusAnswer,
  } = useQuizzEditor()
  const { clientId } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)

  const handleWallpaperUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.")

      return
    }

    setIsUploadingWallpaper(true)
    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId)}`

    authFetch(url, {
      method: "POST",
      body: file,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Upload failed")
        }

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

    if (!file) {
      return
    }

    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file.")

      return
    }

    setIsUploadingAudio(true)
    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId)}`

    authFetch(url, {
      method: "POST",
      body: file,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Upload failed")
        }

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

  const handleSetGlobalTimer = () => {
    // oxlint-disable-next-line no-alert -- Preserve the existing global timer shortcut.
    const rawVal = prompt(
      "Enter a time limit in seconds for all questions (between 5 and 120):",
      "20",
    )

    if (rawVal === null) {
      return
    }

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
    const parsed = quizzValidator.safeParse({
      subject,
      questions,
      wallpaper,
      audio,
    })

    if (!parsed.success) {
      const oversizedAnswer = parsed.error.issues.find(
        (issue) => issue.message === "errors:quizz.answerTooLong",
      )

      if (
        oversizedAnswer &&
        typeof oversizedAnswer.path[1] === "number" &&
        typeof oversizedAnswer.path[3] === "number"
      ) {
        focusAnswer(oversizedAnswer.path[1], oversizedAnswer.path[3])
      }

      toast.error(t(oversizedAnswer?.message ?? parsed.error.issues[0].message))

      return
    }

    void (quizzId ? updateQuiz(quizzId, parsed.data) : saveQuiz(parsed.data))
      .then(() => {
        toast.success(t(quizzId ? "quizz:quizzUpdated" : "quizz:quizzSaved"))
        navigate({ to: "/manager/config" })
      })
      .catch((failure: unknown) =>
        toast.error(
          t(
            failure instanceof Error
              ? failure.message
              : "errors:api.serverError",
          ),
        ),
      )
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
    <header className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white p-2 shadow-sm sm:px-4">
      <Button
        type="button"
        aria-label={t("common:exit")}
        title={t("common:exit")}
        className="min-h-11 min-w-11 shrink-0 bg-gray-100 px-2 text-base text-gray-700 hover:bg-gray-200 lg:px-3"
        onClick={() => navigate({ to: "/manager" })}
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
        <span className="hidden lg:inline">{t("common:exit")}</span>
      </Button>
      <textarea
        rows={2}
        className="field-sizing-content max-h-20 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-gray-300 px-2 py-2 text-base leading-snug font-semibold [overflow-wrap:anywhere] text-gray-900 outline-none focus:border-indigo-500 lg:max-w-96 lg:px-3"
        value={subject}
        onChange={(event) =>
          setSubject(event.target.value.replace(/[\r\n]+/gu, " "))
        }
        aria-label={t("quizz:editor.quizTitle")}
        placeholder={t("quizz:titleQuizzPlaceholder")}
      />

      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            aria-label="Quiz Settings"
            title="Quiz Settings"
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 lg:ml-auto"
            type="button"
          >
            <Settings className="size-5" aria-hidden="true" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <Dialog.Title className="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-4 py-3 text-lg font-bold text-gray-900 sm:px-6">
              <Settings className="size-5 text-indigo-600" aria-hidden="true" />
              Quiz Settings
            </Dialog.Title>

            <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-wallpaper-url"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Quiz Wallpaper
                </label>
                <div className="flex gap-2">
                  <input
                    id="quiz-wallpaper-url"
                    type="url"
                    value={wallpaper || ""}
                    onChange={(e) => setWallpaper(e.target.value)}
                    placeholder="Wallpaper image URL..."
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-base text-gray-700 outline-none focus:border-indigo-500"
                  />
                  <label className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 focus-within:ring-2 focus-within:ring-indigo-500 hover:bg-indigo-100">
                    {isUploadingWallpaper ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Upload quiz wallpaper"
                      onChange={handleWallpaperUpload}
                      className="sr-only"
                      disabled={isUploadingWallpaper}
                    />
                  </label>
                </div>
                {wallpaper &&
                  mediaUrlValidator.safeParse(wallpaper).success && (
                    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      <img
                        src={wallpaper}
                        alt="Quiz wallpaper"
                        className="aspect-video max-h-36 w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t(
                          "quizz:editor.removeWallpaper",
                          "Remove wallpaper",
                        )}
                        className="absolute top-1 right-1 grid size-11 place-items-center rounded-lg bg-slate-950/80 text-white"
                        onClick={() => setWallpaper("")}
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-music-url"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Background Music
                </label>
                <div className="flex gap-2">
                  <input
                    id="quiz-music-url"
                    type="url"
                    value={audio || ""}
                    onChange={(e) => setAudio(e.target.value)}
                    placeholder="Background music URL..."
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-base text-gray-700 outline-none focus:border-indigo-500"
                  />
                  <label className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 focus-within:ring-2 focus-within:ring-indigo-500 hover:bg-indigo-100">
                    {isUploadingAudio ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="audio/*"
                      aria-label="Upload background music"
                      onChange={handleAudioUpload}
                      className="sr-only"
                      disabled={isUploadingAudio}
                    />
                  </label>
                </div>
              </div>
              <Button
                type="button"
                className="min-h-11 w-full border border-gray-200 bg-gray-100 px-3 py-2 text-base text-gray-700 hover:bg-gray-200 lg:hidden"
                onClick={handleSetGlobalTimer}
              >
                <Timer className="size-4 shrink-0" aria-hidden="true" />
                Set Global Timer
              </Button>
            </div>

            <div className="flex shrink-0 justify-end border-t border-gray-100 px-4 py-3 sm:px-6">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Done
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Button
        type="button"
        className="hidden min-h-11 border border-gray-200 bg-gray-100 px-4 py-2 text-base text-gray-700 hover:bg-gray-200 lg:block"
        onClick={handleSetGlobalTimer}
      >
        Set Global Timer
      </Button>
      <Button
        type="button"
        className="min-h-11 shrink-0 bg-indigo-600 px-3 py-2 text-base lg:px-4"
        onClick={handleSave}
      >
        {t("common:save")}
      </Button>
    </header>
  )
}

export default QuizzEditorHeader
