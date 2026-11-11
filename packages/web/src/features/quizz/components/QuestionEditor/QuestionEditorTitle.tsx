import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"

const QuestionEditorTitle = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  return (
    <div className="z-10 rounded-xl bg-white shadow-sm">
      <textarea
        rows={2}
        className="block field-sizing-content max-h-48 min-h-16 w-full resize-none scroll-mt-24 rounded-xl border border-gray-200 px-3 py-3 text-base font-semibold [overflow-wrap:anywhere] text-gray-800 placeholder:text-gray-500 focus-visible:border-indigo-500 focus-visible:outline-none lg:resize-y lg:px-4 lg:text-center lg:text-xl"
        aria-label={t("quizz:question.placeholder")}
        placeholder={t("quizz:question.placeholder")}
        value={currentQuestion.question}
        onChange={(e) =>
          updateQuestion(currentIndex, { question: e.target.value })
        }
      />
    </div>
  )
}

export default QuestionEditorTitle
