import SortableList from "@razzia/web/components/SortableList"
import Button from "@razzia/web/components/Button"
import QuizzEditorCard from "@razzia/web/features/quizz/components/QuizzEditorCard"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { getOversizedAnswerIndexes } from "@razzia/web/features/quizz/utils/answer-validation"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Props {
  open: boolean
  onQuestionSelected: (_destination: "question" | "answer") => void
}

const QuizzEditorSidebar = ({ open, onQuestionSelected }: Props) => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    focusAnswer,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const flaggedQuestions = questions.flatMap((question, index) => {
    const oversizedAnswers = getOversizedAnswerIndexes(question)

    return oversizedAnswers.length
      ? [{ index, answerIndex: oversizedAnswers[0] }]
      : []
  })

  const handleNextFlaggedQuestion = () => {
    const next =
      flaggedQuestions.find((question) => question.index > currentIndex) ??
      flaggedQuestions.at(0)

    if (next) {
      onQuestionSelected("answer")
      focusAnswer(next.index, next.answerIndex)
    }
  }

  const handleSlideClick = (index: number) => () => {
    setCurrentIndex(index)
    onQuestionSelected("question")
  }

  const handleAdd = () => {
    addQuestion()
    onQuestionSelected("question")
  }

  const handleDelete = (index: number) => () => {
    removeQuestion(index)
  }

  return (
    <aside
      id="quiz-question-list"
      aria-label={t("quizz:editor.questions")}
      className={clsx(
        "mx-3 mb-3 shrink-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:m-3 lg:flex lg:w-60 lg:overflow-y-auto lg:border-0 lg:p-3 xl:w-72",
        open ? "flex" : "hidden",
      )}
    >
      <Button
        type="button"
        onClick={handleAdd}
        className="flex min-h-11 items-center justify-center gap-1 bg-gray-100 text-base text-gray-700 hover:bg-gray-200"
      >
        <Plus className="size-5" aria-hidden="true" />
        {t("quizz:addQuestion")}
      </Button>

      {flaggedQuestions.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 shadow-sm lg:sticky lg:top-0 lg:z-20">
          <p role="status" className="text-sm font-semibold">
            {t("quizz:answerLength.flaggedQuestions", {
              count: flaggedQuestions.length,
            })}
          </p>
          <button
            type="button"
            onClick={handleNextFlaggedQuestion}
            className="mt-2 min-h-11 w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            {t("quizz:answerLength.nextFlaggedQuestion")}
          </button>
        </div>
      )}

      <SortableList
        items={questions}
        label={(_question, index) => `Move question ${index + 1}`}
        className="flex shrink-0 flex-col gap-2"
        onReorder={(_next, from, to) => reorderQuestions(from, to)}
        renderItem={(question, index, handle) => (
          <div className="flex min-w-0 items-center gap-1">
            {handle}
            <div className="min-w-0 flex-1">
              <QuizzEditorCard
                question={question}
                index={index}
                isActive={currentIndex === index}
                canDelete={questions.length > 1}
                onClick={handleSlideClick(index)}
                onDelete={handleDelete(index)}
              />
            </div>
          </div>
        )}
      />
    </aside>
  )
}

export default QuizzEditorSidebar
