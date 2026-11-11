import { authFetch } from "@razzia/web/lib/api"
import type { QuestionMediaType } from "@razzia/common/types/game"
import { questionMediaValidator } from "@razzia/common/validators/quizz"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import QuestionMedia, {
  getYoutubeId,
} from "@razzia/web/components/QuestionMedia"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Loader2 } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import ImageCropperModal from "./ImageCropperModal"

const QuestionEditorMedia = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const questionMedia = currentQuestion.media
  const { t } = useTranslation()
  const { clientId } = useSocket()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null)

  const handleChangeMediaType = (e: ChangeEvent<HTMLSelectElement>) => {
    if (questionMedia?.url) {
      updateQuestion(currentIndex, {
        media: { ...questionMedia, type: e.target.value as QuestionMediaType },
      })
    }
  }

  const handleRemoveMedia = () => {
    if (!questionMedia) {
      return
    }

    updateQuestion(currentIndex, { media: undefined })
  }

  const handleChangeMedia = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value

    if (!url) {
      updateQuestion(currentIndex, { media: undefined })

      return
    }

    const youtubeId = getYoutubeId(url)
    const type = youtubeId ? "video" : (questionMedia?.type ?? "image")
    updateQuestion(currentIndex, {
      media: { url, type },
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const { files } = e.dataTransfer

    if (files.length > 0) {
      handleFileSelected(files[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target

    if (files && files.length > 0) {
      handleFileSelected(files[0])
    }
  }

  const handleFileSelected = (file: File) => {
    const filename = file.name.toLowerCase()
    const IMAGE_EXTENSIONS = [
      ".png",
      ".jpg",
      ".jpeg",
      ".jpe",
      ".webp",
      ".heic",
      ".heif",
      ".tiff",
      ".tif",
      ".bmp",
      ".jfif",
      ".gif",
      ".svg",
      ".psd",
      ".ico",
      ".tga",
      ".dds",
      ".avif",
      ".raw",
      ".cr2",
      ".nef",
      ".orf",
      ".sr2",
      ".dng",
    ]
    const isImage =
      file.type.startsWith("image/") ||
      IMAGE_EXTENSIONS.some((ext) => filename.endsWith(ext))

    const BROWSER_RENDERABLE_EXTENSIONS = [
      ".png",
      ".jpg",
      ".jpeg",
      ".jpe",
      ".webp",
      ".bmp",
      ".jfif",
      ".avif",
    ]
    const isBrowserRenderable = BROWSER_RENDERABLE_EXTENSIONS.some((ext) =>
      filename.endsWith(ext),
    )

    // Crop window before upload, only for formats browser can display natively (excluding SVG/GIF)
    if (
      isImage &&
      isBrowserRenderable &&
      !filename.endsWith(".svg") &&
      !filename.endsWith(".gif")
    ) {
      setPendingCropFile(file)
    } else {
      uploadFile(file)
    }
  }

  const uploadFile = (file: File) => {
    let mediaType: QuestionMediaType | null = null
    const filename = file.name.toLowerCase()
    const IMAGE_EXTENSIONS = [
      ".png",
      ".jpg",
      ".jpeg",
      ".jpe",
      ".webp",
      ".heic",
      ".heif",
      ".tiff",
      ".tif",
      ".bmp",
      ".jfif",
      ".gif",
      ".svg",
      ".psd",
      ".ico",
      ".tga",
      ".dds",
      ".avif",
      ".raw",
      ".cr2",
      ".nef",
      ".orf",
      ".sr2",
      ".dng",
    ]
    const isImage =
      file.type.startsWith("image/") ||
      IMAGE_EXTENSIONS.some((ext) => filename.endsWith(ext))

    if (isImage) {
      mediaType = "image"
    } else if (file.type.startsWith("video/")) {
      mediaType = "video"

      if (file.size > 50 * 1024 * 1024) {
        toast.error("Video files must not exceed 50MB")

        return
      }
    } else if (file.type.startsWith("audio/")) {
      mediaType = "audio"
    }

    if (!mediaType) {
      toast.error(
        "Unsupported file type. Please upload an image, video, or audio file.",
      )

      return
    }

    setIsUploading(true)

    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId)}`

    authFetch(url, {
      method: "POST",
      body: file,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Upload failed with status: ${res.status}`)
        }

        return res.json()
      })
      .then((response: { success: boolean; url?: string; error?: string }) => {
        setIsUploading(false)

        if (response.success && response.url) {
          updateQuestion(currentIndex, {
            media: {
              type: mediaType,
              url: response.url,
            },
          })
          toast.success("Media uploaded successfully")
        } else {
          toast.error(response.error ? t(response.error) : "Upload failed")
        }
      })
      .catch((err: unknown) => {
        setIsUploading(false)
        console.error("Upload error:", err)
        toast.error("Upload failed")
      })
  }

  const hasPreview =
    !isEditingUrl && questionMediaValidator.safeParse(questionMedia).success

  return (
    <div
      className={`relative flex min-w-0 flex-col items-center gap-3 rounded-xl transition-all duration-200 ${
        isDragging
          ? "rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/30"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,audio/*,.heic,.heif,.tiff,.tif,.bmp,.jfif,.psd,.ico,.tga,.dds,.avif"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <Card className="flex min-h-36 w-full max-w-xl flex-col items-center justify-center gap-3 border border-gray-100 bg-white p-3 text-center shadow-lg">
          <Loader2 className="size-12 animate-spin text-blue-500" />
          <p className="animate-pulse text-sm font-semibold text-gray-600">
            Processing and uploading media...
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex w-full max-w-xl flex-col gap-3 border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-gray-700">
                {t("quizz:editor.mediaUrl")}
                <Input
                  type="url"
                  className="min-h-11 w-full min-w-0 scroll-mt-24 text-base"
                  placeholder={t("quizz:question.mediaUrlPlaceholder")}
                  value={questionMedia?.url ?? ""}
                  onFocus={() => setIsEditingUrl(true)}
                  onBlur={() => setIsEditingUrl(false)}
                  onChange={handleChangeMedia}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-gray-700">
                {t("quizz:editor.mediaType")}
                <select
                  value={questionMedia?.type ?? "image"}
                  onChange={handleChangeMediaType}
                  disabled={!questionMedia?.url}
                  className="min-h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-base disabled:bg-gray-100"
                >
                  <option value="image">
                    {t("quizz:question.media.image")}
                  </option>
                  <option value="video">
                    {t("quizz:question.media.video")}
                  </option>
                  <option value="audio">
                    {t("quizz:question.media.audio")}
                  </option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-11 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
              >
                {t("quizz:editor.browseMedia")}
              </Button>
              {questionMedia?.url && (
                <Button
                  type="button"
                  className="min-h-11 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                  onClick={handleRemoveMedia}
                >
                  {t("common:delete")}
                </Button>
              )}
              <span className="hidden text-sm text-gray-600 lg:inline">
                Drop an image, video, or audio file here
              </span>
            </div>
          </Card>
          {hasPreview && (
            <QuestionMedia
              media={questionMedia}
              alt="Question Media"
              className="max-h-[clamp(8rem,42dvh,24rem)] max-w-full object-contain"
            />
          )}
        </>
      )}

      {pendingCropFile && (
        <ImageCropperModal
          file={pendingCropFile}
          onCancel={() => setPendingCropFile(null)}
          onSave={(croppedFile) => {
            setPendingCropFile(null)
            uploadFile(croppedFile)
          }}
        />
      )}
    </div>
  )
}

export default QuestionEditorMedia
