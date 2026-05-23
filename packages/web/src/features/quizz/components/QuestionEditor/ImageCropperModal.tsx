import Button from "@razzia/web/components/Button"
import { Loader2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"

interface ImageCropperModalProps {
  file: File
  onCancel: () => void
  onSave: (croppedFile: File) => void
}

interface Crop {
  x: number
  y: number
  width: number
  height: number
}

const ImageCropperModal = ({
  file,
  onCancel,
  onSave,
}: ImageCropperModalProps) => {
  const [imgSrc, setImgSrc] = useState<string>("")
  // Default to Free Style
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeHandle, setActiveHandle] = useState<string | null>(null)

  const [crop, setCrop] = useState<Crop>({
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  })

  const imageRef = useRef<HTMLImageElement>(null)
  const dragSession = useRef<{
    handle: string
    startX: number
    startY: number
    startCrop: Crop
    imgWidth: number
    imgHeight: number
  } | null>(null)

  // Load image as Data URL (extremely stable across React render cycles)
  useEffect(() => {
    let active = true
    const reader = new FileReader()
    reader.onload = () => {
      if (active) {
        setImgSrc(reader.result as string)
      }
    }
    reader.onerror = () => {
      toast.error("Failed to read image file")
    }
    reader.readAsDataURL(file)

    return () => {
      active = false
    }
  }, [file])

  // Center and scale crop box based on selected aspect ratio
  const initializeCrop = (imgW: number, imgH: number, ratio: number | null) => {
    if (!ratio) {
      setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })

      return
    }

    const displayRatio = imgW / imgH
    let w = 0.8
    let h = 0.8

    if (displayRatio > ratio) {
      // Image is wider than crop aspect ratio (height dominates clamp)
      h = 0.8
      w = (h * ratio) / displayRatio
    } else {
      // Image is taller than crop aspect ratio (width dominates clamp)
      w = 0.8
      h = (w * displayRatio) / ratio
    }

    setCrop({
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      width: w,
      height: h,
    })
  }

  const handleImageLoad = () => {
    if (!imageRef.current) {
      return
    }

    const img = imageRef.current
    initializeCrop(img.offsetWidth, img.offsetHeight, aspectRatio)
  }

  // Adjust crop box when aspect ratio changes
  useEffect(() => {
    if (!imageRef.current) {
      return
    }

    const img = imageRef.current
    initializeCrop(img.offsetWidth, img.offsetHeight, aspectRatio)
  }, [aspectRatio])

  // Pointer Down triggers active handle drag session
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!imageRef.current) {
      return
    }

    const img = imageRef.current
    const rect = img.getBoundingClientRect()

    dragSession.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      imgWidth: rect.width,
      imgHeight: rect.height,
    }

    setActiveHandle(handle)
  }

  // Handle pointermove and pointerup globally on window for perfect responsiveness
  useEffect(() => {
    if (!activeHandle) {
      return
    }

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!dragSession.current) {
        return
      }

      const { handle, startX, startY, startCrop, imgWidth, imgHeight } =
        dragSession.current
      const dx = (e.clientX - startX) / imgWidth
      const dy = (e.clientY - startY) / imgHeight

      let nextCrop = { ...startCrop }

      if (handle === "move") {
        nextCrop.x = Math.max(
          0,
          Math.min(1 - startCrop.width, startCrop.x + dx),
        )
        nextCrop.y = Math.max(
          0,
          Math.min(1 - startCrop.height, startCrop.y + dy),
        )
      } else if (!aspectRatio) {
        // Free Style resizing - each handle moves independently
        let x1 = startCrop.x
        let y1 = startCrop.y
        let x2 = startCrop.x + startCrop.width
        let y2 = startCrop.y + startCrop.height

        // 5% minimum size
        const minSize = 0.05

        if (handle === "top-left") {
          x1 = Math.max(0, Math.min(x2 - minSize, startCrop.x + dx))
          y1 = Math.max(0, Math.min(y2 - minSize, startCrop.y + dy))
        } else if (handle === "top-right") {
          x2 = Math.max(
            x1 + minSize,
            Math.min(1, startCrop.x + startCrop.width + dx),
          )
          y1 = Math.max(0, Math.min(y2 - minSize, startCrop.y + dy))
        } else if (handle === "bottom-left") {
          x1 = Math.max(0, Math.min(x2 - minSize, startCrop.x + dx))
          y2 = Math.max(
            y1 + minSize,
            Math.min(1, startCrop.y + startCrop.height + dy),
          )
        } else if (handle === "bottom-right") {
          x2 = Math.max(
            x1 + minSize,
            Math.min(1, startCrop.x + startCrop.width + dx),
          )
          y2 = Math.max(
            y1 + minSize,
            Math.min(1, startCrop.y + startCrop.height + dy),
          )
        } else if (handle === "top") {
          y1 = Math.max(0, Math.min(y2 - minSize, startCrop.y + dy))
        } else if (handle === "bottom") {
          y2 = Math.max(
            y1 + minSize,
            Math.min(1, startCrop.y + startCrop.height + dy),
          )
        } else if (handle === "left") {
          x1 = Math.max(0, Math.min(x2 - minSize, startCrop.x + dx))
        } else if (handle === "right") {
          x2 = Math.max(
            x1 + minSize,
            Math.min(1, startCrop.x + startCrop.width + dx),
          )
        }

        nextCrop = {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
        }
      } else {
        // Aspect Ratio Locked Resizing
        const targetRatio = aspectRatio * (imgHeight / imgWidth)
        const isCorner = [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ].includes(handle)

        if (isCorner) {
          let ax = startCrop.x
          let ay = startCrop.y
          let signX = 1
          let signY = 1

          if (handle === "top-left") {
            ax = startCrop.x + startCrop.width
            ay = startCrop.y + startCrop.height
            signX = -1
            signY = -1
          } else if (handle === "top-right") {
            ax = startCrop.x
            ay = startCrop.y + startCrop.height
            signX = 1
            signY = -1
          } else if (handle === "bottom-left") {
            ax = startCrop.x + startCrop.width
            ay = startCrop.y
            signX = -1
            signY = 1
          } else if (handle === "bottom-right") {
            ax = startCrop.x
            ay = startCrop.y
            signX = 1
            signY = 1
          }

          const mx = handle.includes("left")
            ? startCrop.x + dx
            : startCrop.x + startCrop.width + dx
          const my = handle.includes("top")
            ? startCrop.y + dy
            : startCrop.y + startCrop.height + dy

          const w = (mx - ax) * signX
          const h = (my - ay) * signY

          const k = (w * targetRatio + h) / (targetRatio * targetRatio + 1)
          let w_proj = k * targetRatio
          let h_proj = k

          const maxW = signX === 1 ? 1 - ax : ax
          const maxH = signY === 1 ? 1 - ay : ay

          w_proj = Math.max(0.05, Math.min(maxW, w_proj))
          h_proj = w_proj / targetRatio

          if (h_proj > maxH) {
            h_proj = maxH
            w_proj = h_proj * targetRatio
          }

          nextCrop = {
            x: signX === 1 ? ax : ax - w_proj,
            y: signY === 1 ? ay : ay - h_proj,
            width: w_proj,
            height: h_proj,
          }
        } else {
          // Edge Resizing with Locked Aspect Ratio (resizes symmetrically)
          const centerX = startCrop.x + startCrop.width / 2
          const centerY = startCrop.y + startCrop.height / 2

          if (handle === "top" || handle === "bottom") {
            const ay =
              handle === "top" ? startCrop.y + startCrop.height : startCrop.y
            const signY = handle === "top" ? -1 : 1

            let h = startCrop.height + dy * signY
            const maxH = signY === 1 ? 1 - ay : ay
            h = Math.max(0.05, Math.min(maxH, h))

            let w = h * targetRatio
            const maxW = 2 * Math.min(centerX, 1 - centerX)

            if (w > maxW) {
              w = maxW
              h = w / targetRatio
            }

            nextCrop = {
              x: centerX - w / 2,
              y: signY === 1 ? ay : ay - h,
              width: w,
              height: h,
            }
          } else {
            // Left or right
            const ax =
              handle === "left" ? startCrop.x + startCrop.width : startCrop.x
            const signX = handle === "left" ? -1 : 1

            let w = startCrop.width + dx * signX
            const maxW = signX === 1 ? 1 - ax : ax
            w = Math.max(0.05, Math.min(maxW, w))

            let h = w / targetRatio
            const maxH = 2 * Math.min(centerY, 1 - centerY)

            if (h > maxH) {
              h = maxH
              w = h * targetRatio
            }

            nextCrop = {
              x: signX === 1 ? ax : ax - w,
              y: centerY - h / 2,
              width: w,
              height: h,
            }
          }
        }
      }

      setCrop(nextCrop)
    }

    const handleWindowPointerUp = () => {
      setActiveHandle(null)
      dragSession.current = null
    }

    window.addEventListener("pointermove", handleWindowPointerMove)
    window.addEventListener("pointerup", handleWindowPointerUp)

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove)
      window.removeEventListener("pointerup", handleWindowPointerUp)
    }
  }, [activeHandle, aspectRatio])

  // Draw crop area on canvas and emit saved file
  const handleSave = () => {
    if (!imageRef.current) {
      return
    }

    setIsProcessing(true)

    const img = new Image()
    img.src = imgSrc

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")

        const ctx = canvas.getContext("2d")

        if (!ctx) {
          throw new Error("Could not get 2D context")
        }

        const sx = crop.x * img.naturalWidth
        const sy = crop.y * img.naturalHeight
        const sWidth = crop.width * img.naturalWidth
        const sHeight = crop.height * img.naturalHeight

        canvas.width = sWidth
        canvas.height = sHeight

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight)

        const outputMime = file.type || "image/png"

        canvas.toBlob(
          (blob) => {
            setIsProcessing(false)

            if (blob) {
              const croppedFile = new File([blob], file.name, {
                type: outputMime,
                lastModified: Date.now(),
              })
              onSave(croppedFile)
            } else {
              toast.error("Failed to generate cropped image")
            }
          },
          outputMime,
          0.92,
        )
      } catch (err) {
        setIsProcessing(false)
        console.error("Canvas crop error:", err)
        toast.error("Failed to crop image")
      }
    }

    img.onerror = () => {
      setIsProcessing(false)
      toast.error("Failed to load image for cropping")
    }
  }

  const ratios = [
    { label: "Free Style", value: null },
    { label: "16:9", value: 16 / 9 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:2", value: 3 / 2 },
    { label: "1:1", value: 1 / 1 },
  ]

  if (typeof document === "undefined") {
    return null
  }

  // Render via React Portal to body so it sits outside stack contexts and overlays options
  return createPortal(
    <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md duration-200">
      <div className="animate-in zoom-in-95 relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl duration-200">
        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Crop Image</h3>
            <p className="text-xs text-gray-400">
              Drag corners or edges to resize. Drag center to reposition.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-950 p-6">
          {imgSrc && (
            <div className="relative h-fit max-h-[calc(90vh-14rem)] w-fit max-w-[calc(100%-2.5rem)] overflow-visible select-none">
              <img
                ref={imageRef}
                src={imgSrc}
                alt="Crop preview"
                className="pointer-events-none block max-h-[calc(90vh-14rem)] max-w-full select-none"
                onLoad={handleImageLoad}
                onError={() => {
                  toast.error(
                    "Format not supported for preview. Uploading original file directly...",
                  )
                  onSave(file)
                }}
              />

              {/* Overlay Backdrop Mask */}
              <div className="absolute inset-0 touch-none select-none">
                {/* 4 dark outer panels */}
                <div
                  className="pointer-events-none absolute bg-black/60"
                  style={{
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${crop.y * 100}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/60"
                  style={{
                    top: `${(crop.y + crop.height) * 100}%`,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/60"
                  style={{
                    top: `${crop.y * 100}%`,
                    bottom: `${(1 - crop.y - crop.height) * 100}%`,
                    left: 0,
                    width: `${crop.x * 100}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/60"
                  style={{
                    top: `${crop.y * 100}%`,
                    bottom: `${(1 - crop.y - crop.height) * 100}%`,
                    left: `${(crop.x + crop.width) * 100}%`,
                    right: 0,
                  }}
                />

                {/* Highlighted Crop Box */}
                <div
                  className="absolute cursor-move border border-white"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                    boxShadow:
                      "0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5)",
                  }}
                  onPointerDown={(e) => handlePointerDown(e, "move")}
                >
                  {/* Grid Lines */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                    <div className="col-span-1 row-span-3 border-r border-dashed border-white" />
                    <div className="col-span-1 row-span-3 border-r border-dashed border-white" />
                    <div className="col-span-3 row-span-1 border-b border-dashed border-white" />
                    <div className="col-span-3 row-span-1 border-b border-dashed border-white" />
                  </div>

                  {/* Corner resizing circles */}
                  <div
                    className="absolute -top-2 -left-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "top-left")}
                  />
                  <div
                    className="absolute -top-2 -right-2 h-4 w-4 cursor-nesw-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "top-right")}
                  />
                  <div
                    className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "bottom-left")}
                  />
                  <div
                    className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "bottom-right")}
                  />

                  {/* Edge resizing bars */}
                  <div
                    className="absolute -top-1.5 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "top")}
                  />
                  <div
                    className="absolute -bottom-1.5 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "bottom")}
                  />
                  <div
                    className="absolute top-1/2 -left-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "left")}
                  />
                  <div
                    className="absolute top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-blue-500 bg-white shadow-md transition-transform before:absolute before:-inset-3 before:rounded-full before:content-[''] hover:scale-110 active:scale-125"
                    onPointerDown={(e) => handlePointerDown(e, "right")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex flex-none flex-col justify-between gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4 md:flex-row md:items-center">
          {/* Aspect Ratio Presets */}
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs font-bold tracking-wider text-gray-500 uppercase">
              Aspect:
            </span>
            <div className="flex gap-1 rounded-lg bg-gray-200/60 p-1">
              {ratios.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setAspectRatio(r.value)}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    aspectRatio === r.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-200/40 hover:text-gray-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={onCancel}
              disabled={isProcessing}
              className="cursor-pointer bg-transparent px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200/60"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isProcessing}
              className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cropping...
                </>
              ) : (
                "Save & Upload"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ImageCropperModal
