import background from "@razzia/web/assets/background.png"
import QuestionEditor from "@razzia/web/features/quizz/components/QuestionEditor"
import QuizzEditorHeader from "@razzia/web/features/quizz/components/QuizzEditorHeader"
import QuizzEditorSidebar from "@razzia/web/features/quizz/components/QuizzEditorSidebar"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { getOversizedAnswerIndexes } from "@razzia/web/features/quizz/utils/answer-validation"
import clsx from "clsx"
import { ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const QuizzEditorLayout = () => {
  const { questions, currentIndex, setCurrentIndex } = useQuizzEditor()
  const { t } = useTranslation()
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const questionsButton = useRef<HTMLButtonElement>(null)
  const hasWarnings = questions.some(
    (question) => getOversizedAnswerIndexes(question).length > 0,
  )

  const closeQuestionList = (destination: "question" | "answer") => {
    setQuestionsOpen(false)

    if (
      destination === "question" &&
      questionsButton.current?.getClientRects().length
    ) {
      requestAnimationFrame(() => {
        questionsButton.current?.focus({ preventScroll: true })
        questionsButton.current?.scrollIntoView({ block: "nearest" })
      })
    }
  }

  const goToQuestion = (index: number) => {
    setCurrentIndex(index)
    setQuestionsOpen(false)
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-gray-50 lg:h-dvh">
      <img
        src={background}
        alt=""
        className="pointer-events-none fixed inset-0 hidden size-full object-cover lg:block"
      />
      <QuizzEditorHeader />
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <nav
          aria-label={t("quizz:editor.questions")}
          className="mx-3 my-3 flex min-w-0 items-stretch gap-2 lg:hidden"
        >
          <button
            ref={questionsButton}
            type="button"
            aria-expanded={questionsOpen}
            aria-controls="quiz-question-list"
            onClick={() => setQuestionsOpen(!questionsOpen)}
            className="flex min-h-11 min-w-0 flex-1 scroll-mt-24 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-800"
          >
            <List className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("quizz:editor.questions")}</span>
            <span className="shrink-0 text-gray-500 tabular-nums">
              {currentIndex + 1}/{questions.length}
            </span>
            {hasWarnings && (
              <span
                role="img"
                aria-label={t("quizz:editor.answerWarnings")}
                className="size-2 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
              />
            )}
            <ChevronDown
              className={clsx(
                "ml-auto size-4 shrink-0",
                questionsOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label={t("quizz:editor.previousQuestion")}
            disabled={currentIndex === 0}
            onClick={() => goToQuestion(currentIndex - 1)}
            className="grid min-h-11 w-11 shrink-0 place-items-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("quizz:editor.nextQuestion")}
            disabled={currentIndex === questions.length - 1}
            onClick={() => goToQuestion(currentIndex + 1)}
            className="grid min-h-11 w-11 shrink-0 place-items-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </nav>
        <QuizzEditorSidebar
          open={questionsOpen}
          onQuestionSelected={closeQuestionList}
        />
        <QuestionEditor />
      </div>
    </div>
  )
}

export default QuizzEditorLayout
