import QuestionEditorAnswers from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorAnswers"
import QuestionEditorConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig"
import QuestionEditorMedia from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorMedia"
import QuestionEditorTitle from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorTitle"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { ChevronDown, Image, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const QuestionEditor = () => {
  const { currentQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<"settings" | "media" | null>(null)
  const settingsOpen = expanded === "settings"
  const mediaOpen = expanded === "media"

  return (
    <main className="mx-auto grid w-full min-w-0 flex-1 content-start gap-3 px-3 pb-5 lg:gap-4 lg:overflow-y-auto lg:px-4 lg:pt-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 xl:col-start-1">
        <QuestionEditorTitle />
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-1 xl:hidden">
        <button
          type="button"
          aria-label={t("quizz:editor.questionSettings")}
          aria-expanded={settingsOpen}
          aria-controls="question-settings"
          onClick={() => setExpanded(settingsOpen ? null : "settings")}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 text-left text-sm font-semibold text-gray-800"
        >
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          <span>{t("quizz:editor.settings")}</span>
          <ChevronDown
            className={clsx(
              "ml-auto size-4 shrink-0",
              settingsOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          aria-label={t("quizz:editor.questionMedia")}
          aria-expanded={mediaOpen}
          aria-controls="question-media"
          onClick={() => setExpanded(mediaOpen ? null : "media")}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 text-left text-sm font-semibold text-gray-800 lg:hidden"
        >
          <Image className="size-4 shrink-0" aria-hidden="true" />
          <span>{t("quizz:editor.media")}</span>
          {currentQuestion.media?.url && (
            <span className="size-2 shrink-0 rounded-full bg-indigo-600" />
          )}
          <ChevronDown
            className={clsx(
              "ml-auto size-4 shrink-0",
              mediaOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id="question-settings"
        className={clsx(
          "min-w-0 self-start xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:block",
          !settingsOpen && "hidden",
        )}
      >
        <QuestionEditorConfig />
      </div>

      <div
        id="question-media"
        className={clsx(
          "min-w-0 lg:block xl:col-start-1",
          !mediaOpen && "hidden",
        )}
      >
        <QuestionEditorMedia />
      </div>

      <div className="min-w-0 xl:col-start-1">
        <QuestionEditorAnswers />
      </div>
    </main>
  )
}

export default QuestionEditor
