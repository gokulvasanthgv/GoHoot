import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Timer, Layout, AlignLeft, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion = (key: string) => (value: string | number | boolean) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as "quiz" | "slide" | "puzzle" | "true_or_false"
    const updates: any = { type: newType }
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
    <aside className="z-10 m-3 flex w-68 shrink-0 flex-col gap-6 self-start overflow-auto rounded-xl bg-white p-4 shadow-sm">
      <ConfigSection title="Question Type">
        <ConfigField>
          <ConfigField.Label
            icon={<Layout className="size-4" />}
            label="Type"
            unit=""
          />
          <select
            value={currentQuestion.type || "quiz"}
            onChange={handleTypeChange}
            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
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
              value={currentQuestion.text || ""}
              onChange={(e) => handleUpdateQuestion("text")(e.target.value)}
              className="h-24 w-full resize-none rounded-lg border border-gray-200 p-2 text-sm text-gray-700 outline-none hover:border-gray-300 focus:border-indigo-500"
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
            <div className="flex items-center mt-2.5">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!currentQuestion.doublePoints}
                  onChange={(e) => handleUpdateQuestion("doublePoints")(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-semibold text-gray-700">Double Points</span>
              </label>
            </div>
            <ConfigField.Description>
              Award 2x score multiplier for correct answers.
            </ConfigField.Description>
          </ConfigField>
        </ConfigSection>
      )}
    </aside>
  )
}

export default QuestionEditorConfig
