import type { Question } from "@razzia/common/types/game"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Timer, Layout, AlignLeft, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion =
    (key: string) => (value: string | number | boolean) => {
      updateQuestion(currentIndex, { [key]: value })
    }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as
      "quiz" | "slide" | "puzzle" | "true_or_false"
    const updates: Partial<Question> = { type: newType }

    if (newType === "slide") {
      updates.answers = undefined
      updates.solutions = undefined
    } else if (newType === "true_or_false") {
      updates.answers = ["True", "False"]
      updates.solutions = [0]
    } else if (
      !currentQuestion.answers ||
      currentQuestion.answers.length === 0 ||
      currentQuestion.type === "true_or_false"
    ) {
      updates.answers = ["", ""]
      updates.solutions = [0]
    }

    updateQuestion(currentIndex, updates)
  }

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <ConfigSection title="Question Type">
        <ConfigField>
          <ConfigField.Label
            icon={<Layout className="size-4" />}
            label="Type"
            unit=""
          />
          <select
            aria-label="Question type"
            value={currentQuestion.type || "quiz"}
            onChange={handleTypeChange}
            className="min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white p-2 text-base text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
          >
            <option value="quiz">Quiz Question</option>
            <option value="true_or_false">True or False</option>
            <option value="puzzle">Puzzle Question</option>
            <option value="slide">Information Slide</option>
          </select>
          <ConfigField.Description>
            Select how players interact with this question step.
          </ConfigField.Description>
        </ConfigField>

        {currentQuestion.type === "slide" && (
          <ConfigField>
            <ConfigField.Label
              icon={<AlignLeft className="size-4" />}
              label="Slide Text"
              unit=""
            />
            <textarea
              aria-label="Slide text"
              value={currentQuestion.text || ""}
              onChange={(e) => handleUpdateQuestion("text")(e.target.value)}
              className="h-24 w-full resize-y rounded-lg border border-gray-200 p-2 text-base text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
              placeholder="Enter slide content..."
            />
            <ConfigField.Description>
              Write the body text of the presentation slide.
            </ConfigField.Description>
          </ConfigField>
        )}
      </ConfigSection>

      {currentQuestion.type !== "slide" && (
        <ConfigSection title={t("quizz:question.config.timings")}>
          <ConfigField>
            <ConfigField.Label
              icon={<Clock className="size-4" />}
              label={t("quizz:question.config.questionDisplay")}
            />
            <ConfigNumberInput
              label={t("quizz:question.config.questionDisplay")}
              value={currentQuestion.cooldown}
              min={3}
              onChange={handleUpdateQuestion("cooldown")}
            />
            <ConfigField.Description>
              {t("quizz:question.config.questionDisplayHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigField>
            <ConfigField.Label
              icon={<Timer className="size-4" />}
              label={t("quizz:question.config.answerTime")}
            />
            <ConfigNumberInput
              label={t("quizz:question.config.answerTime")}
              value={currentQuestion.time}
              min={5}
              onChange={handleUpdateQuestion("time")}
            />
            <ConfigField.Description>
              {t("quizz:question.config.answerTimeHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigField>
            <ConfigField.Label
              icon={<Sparkles className="size-4 text-indigo-500" />}
              label="Points Modifier"
            />
            <div className="mt-2.5 flex items-center">
              <label className="relative inline-flex min-h-11 cursor-pointer items-center select-none">
                <input
                  type="checkbox"
                  checked={Boolean(currentQuestion.doublePoints)}
                  onChange={(e) =>
                    handleUpdateQuestion("doublePoints")(e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="relative h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                <span className="ml-3 text-sm font-semibold text-gray-700">
                  Double Points
                </span>
              </label>
            </div>
            <ConfigField.Description>
              Award 2x score multiplier for correct answers.
            </ConfigField.Description>
          </ConfigField>
        </ConfigSection>
      )}
    </section>
  )
}

export default QuestionEditorConfig
