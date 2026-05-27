import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useConfig } from "@razzia/web/features/manager/contexts/config-context"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigSettings = () => {
  const { socket, clientId } = useSocket()
  const config = useConfig()
  const { t } = useTranslation()

  const [wallpaper, setWallpaper] = useState(config.defaultWallpaper ?? "")
  const [audio, setAudio] = useState(config.defaultAudio ?? "")
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  const handleFileUpload = (type: "wallpaper" | "audio") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === "wallpaper" && !file.type.startsWith("image/")) {
      toast.error("Please upload an image file.")
      return
    }

    if (type === "audio" && !file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file.")
      return
    }

    const setIsUploading = type === "wallpaper" ? setUploadingWallpaper : setUploadingAudio
    setIsUploading(true)

    const url = `/uploads?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&clientId=${encodeURIComponent(clientId ?? "")}`

    fetch(url, {
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
        setIsUploading(false)
        if (response.success && response.url) {
          if (type === "wallpaper") {
            setWallpaper(response.url)
          } else {
            setAudio(response.url)
          }
          toast.success("File uploaded successfully")
        } else {
          toast.error(response.error || "Upload failed")
        }
      })
      .catch(() => {
        setIsUploading(false)
        toast.error("Upload failed")
      })
  }

  const handleSave = () => {
    socket.emit(EVENTS.MANAGER.UPDATE_SETTINGS, {
      defaultWallpaper: wallpaper,
      defaultAudio: audio,
    })
    toast.success(t("manager:settings.saved"))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between">
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-0.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            {t("manager:settings.defaultWallpaper")}
          </label>
          <div className="flex flex-col gap-2">
            <Input
              variant="sm"
              value={wallpaper}
              onChange={(e) => setWallpaper(e.target.value)}
              placeholder="Paste wallpaper URL..."
              className="w-full"
            />
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileUpload("wallpaper")}
                disabled={uploadingWallpaper}
              />
              <button
                type="button"
                className="w-full rounded-md bg-gray-200 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-300 transition duration-150 disabled:opacity-50"
              >
                {uploadingWallpaper ? t("manager:settings.uploading") : t("manager:settings.upload")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            {t("manager:settings.defaultAudio")}
          </label>
          <div className="flex flex-col gap-2">
            <Input
              variant="sm"
              value={audio}
              onChange={(e) => setAudio(e.target.value)}
              placeholder="Paste audio URL..."
              className="w-full"
            />
            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileUpload("audio")}
                disabled={uploadingAudio}
              />
              <button
                type="button"
                className="w-full rounded-md bg-gray-200 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-300 transition duration-150 disabled:opacity-50"
              >
                {uploadingAudio ? t("manager:settings.uploading") : t("manager:settings.upload")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Button className="mt-4 shrink-0" onClick={handleSave}>
        {t("manager:settings.save")}
      </Button>
    </div>
  )
}

export default ConfigSettings
