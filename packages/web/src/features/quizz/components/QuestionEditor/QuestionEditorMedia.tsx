import type { QuestionMediaType } from "@razzia/common/types/game"
import { questionMediaValidator } from "@razzia/common/validators/quizz"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import QuestionMedia, { getYoutubeId } from "@razzia/web/components/QuestionMedia"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Image, ImageOff, Loader2, Music, Video } from "lucide-react"
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
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null)

  const hadnleChangeMediaType = (type: QuestionMediaType) => () => {
    const result = questionMediaValidator.safeParse({
      type,
      url: questionMedia?.url,
    })

    if (!result.success) {
      toast.error(t(result.error.issues[0].message))

      return
    }

    updateQuestion(currentIndex, { media: result.data })
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
    const type = youtubeId ? "video" : currentQuestion.media?.type
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
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelected(files[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
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

    fetch(url, {
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

  return (
    <div
      className={`relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-4 transition-all duration-200 ${
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
        <Card className="my-auto flex h-60 w-full max-w-xl flex-col items-center justify-center gap-3 border border-gray-100 bg-white shadow-lg">
          <Loader2 className="size-12 animate-spin text-blue-500" />
          <p className="animate-pulse text-sm font-semibold text-gray-600">
            Processing and uploading media...
          </p>
        </Card>
      ) : (
        <>
          {questionMedia?.url && (
            <QuestionMedia media={currentQuestion.media} alt="Question Media" />
          )}

          {!questionMedia?.url && (
            <Card
              className={`my-auto flex max-h-100 w-full max-w-xl flex-1 cursor-pointer flex-col items-center justify-center gap-4 border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md`}
              onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                // Prevent clicking on inner interactive elements from triggering file select
                if ((e.target as HTMLElement).closest(".no-click-trigger"))
                  return
                fileInputRef.current?.click()
              }}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <ImageOff className="size-14 stroke-gray-400" />
                <p className="text-base font-semibold text-gray-700">
                  Drag & drop media here, or{" "}
                  <span className="text-blue-600 underline">browse files</span>
                </p>
                <p className="text-xs text-gray-400">
                  Supports Images, Videos (max 50MB), or Audio
                </p>
              </div>

              <div className="no-click-trigger flex w-full max-w-md flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    Or enter external URL
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="flex w-full flex-col gap-1">
                  <div className="flex gap-2">
                    <Input
                      variant="sm"
                      className="w-full"
                      placeholder={t("quizz:question.mediaUrlPlaceholder")}
                      value={questionMedia?.url ?? ""}
                      onChange={handleChangeMedia}
                    />
                  </div>
                  <span className="text-[10px] text-center text-gray-400">
                    YouTube links will be automatically detected and embedded.
                  </span>
                </div>
              </div>

              <div className="no-click-trigger mt-1 flex flex-wrap justify-center gap-2">
                <Button
                  onClick={hadnleChangeMediaType("image")}
                  className="bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200"
                >
                  <div className="flex items-center gap-1.5">
                    <Image className="size-4" />
                    <span className="text-xs">
                      {t("quizz:question.media.image")}
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={hadnleChangeMediaType("video")}
                  className="bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200"
                >
                  <div className="flex items-center gap-1.5">
                    <Video className="size-4" />
                    <span className="text-xs">
                      {t("quizz:question.media.video")}
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={hadnleChangeMediaType("audio")}
                  className="bg-gray-100 px-3 py-1 font-medium text-gray-600 hover:bg-gray-200"
                >
                  <div className="flex items-center gap-1.5">
                    <Music className="size-4" />
                    <span className="text-xs">
                      {t("quizz:question.media.audio")}
                    </span>
                  </div>
                </Button>
              </div>
            </Card>
          )}

          {questionMedia?.url && (
            <div className="absolute bottom-4 flex gap-2">
              <Button
                className="rounded-sm bg-gray-200 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-300"
                onClick={() => fileInputRef.current?.click()}
              >
                Change File
              </Button>
              <Button
                className="rounded-sm bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200"
                onClick={handleRemoveMedia}
              >
                {t("common:delete")}
              </Button>
            </div>
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
