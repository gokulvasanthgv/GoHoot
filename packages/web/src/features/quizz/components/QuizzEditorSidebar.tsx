import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import Button from "@razzia/web/components/Button"
import QuizzEditorCard from "@razzia/web/features/quizz/components/QuizzEditorCard"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const QuizzEditorSidebar = () => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    wallpaper,
    setWallpaper,
  } = useQuizzEditor()
  const { clientId } = useSocket()
  const { t } = useTranslation()

  const [isUploading, setIsUploading] = useState(false)
  const isDragging = useRef(false)

  const handleSlideClick = (index: number) => () => {
    if (!isDragging.current) {
      setCurrentIndex(index)
    }
  }

  const handleDelete = (index: number) => () => {
    removeQuestion(index)
  }

  const handleDragEnd = (result: DropResult) => {
    isDragging.current = false

    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      return
    }

    reorderQuestions(result.source.index, result.destination.index)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.")
      return
    }

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
          setWallpaper(response.url)
          toast.success("Wallpaper uploaded successfully")
        } else {
          toast.error(response.error || "Upload failed")
        }
      })
      .catch(() => {
        setIsUploading(false)
        toast.error("Upload failed")
      })
  }

  return (
    <aside className="z-10 m-3 flex w-72 shrink-0 flex-col gap-2 overflow-auto rounded-xl bg-white p-3 shadow-sm">
      <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
          Quiz Wallpaper
        </label>
        {wallpaper ? (
          <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-md border border-gray-200 bg-white">
            <img
              src={wallpaper}
              alt="Quiz wallpaper"
              className="h-full w-full object-cover"
            />
            <button
              onClick={() => setWallpaper("")}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition active:scale-90"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={wallpaper}
            onChange={(e) => setWallpaper(e.target.value)}
            placeholder="Paste image URL..."
          />
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <button
              type="button"
              className="w-full rounded-md bg-gray-200 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-300 transition duration-150 disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload Image"}
            </button>
          </div>
        </div>
      </div>

      <DragDropContext
        onDragStart={() => {
          isDragging.current = true
        }}
        onDragEnd={handleDragEnd}
      >
        <Droppable droppableId="questions">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-col gap-2"
            >
              {questions.map((q, index) => (
                <Draggable key={q.id} draggableId={q.id} index={index}>
                  {(draggableProvided, snapshot) => (
                    <div
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      {...draggableProvided.dragHandleProps}
                      className={clsx(snapshot.isDragging && "shadow-lg")}
                    >
                      <QuizzEditorCard
                        question={q}
                        index={index}
                        isActive={currentIndex === index}
                        canDelete={questions.length > 1}
                        onClick={handleSlideClick(index)}
                        onDelete={handleDelete(index)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button
        onClick={addQuestion}
        className="bg text-md mt-1 mb-8 flex items-center justify-center gap-1 bg-gray-200 text-gray-600"
      >
        <Plus className="size-6" />
        {t("quizz:addQuestion")}
      </Button>
    </aside>
  )
}

export default QuizzEditorSidebar
