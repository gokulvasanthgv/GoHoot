import { MAX_ANSWER_LENGTH } from "@razzia/common/constants"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import {
  getAnswerInputId,
  getAnswerLength,
  getOversizedAnswerIndexes,
} from "@razzia/web/features/quizz/utils/answer-validation"
import clsx from "clsx"
import { Check, Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorAnswers = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  if (currentQuestion.type === "slide") {
    return getOversizedAnswerIndexes(currentQuestion).length > 0 ? (
      <div className="z-10 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{t("quizz:answerLength.unusedSlideOptions")}</p>
        <button
          type="button"
          onClick={() =>
            updateQuestion(currentIndex, {
              answers: undefined,
              solutions: undefined,
            })
          }
          className="mt-2 min-h-11 rounded-lg bg-white px-3 py-2 font-semibold ring-1 ring-red-200 hover:bg-red-100"
        >
          {t("quizz:answerLength.removeUnusedOptions")}
        </button>
      </div>
    ) : null
  }

  const isTrueOrFalse = currentQuestion.type === "true_or_false"

  const updateAnswer = (index: number, value: string) => {
    if (isTrueOrFalse) {
      return
    }

    const next = [...(currentQuestion.answers ?? [])]
    next[index] = value
    updateQuestion(currentIndex, { answers: next })
  }

  const answersList =
    currentQuestion.answers ?? (isTrueOrFalse ? ["True", "False"] : [])

  const addAnswer = () => {
    if (answersList.length >= 7 || isTrueOrFalse) {
      return
    }

    updateQuestion(currentIndex, { answers: [...answersList, ""] })
  }

  const removeAnswer = () => {
    if (answersList.length <= 2 || isTrueOrFalse) {
      return
    }

    const next = answersList.slice(0, -1)
    const maxIndex = next.length - 1
    const nextSolution = (currentQuestion.solutions ?? []).filter(
      (s) => s <= maxIndex,
    )

    updateQuestion(currentIndex, {
      answers: next,
      solutions: nextSolution.length > 0 ? nextSolution : [0],
    })
  }

  const toggleSolution = (index: number) => {
    if (isTrueOrFalse) {
      updateQuestion(currentIndex, { solutions: [index] })

      return
    }

    const current = currentQuestion.solutions ?? []

    if (current.includes(index)) {
      const next = current.filter((s) => s !== index)
      updateQuestion(currentIndex, {
        solutions: next.length > 0 ? next : [index],
      })
    } else {
      updateQuestion(currentIndex, { solutions: [...current, index] })
    }
  }

  return (
    <div className="@container z-10 flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="rounded-lg bg-white px-2 py-1 text-sm font-semibold text-gray-500">
          {answersList.length}
          {t("quizz:answersCountSuffix")}
        </div>
        <div className="flex gap-2">
          <button
            aria-label={t("quizz:answerLength.removeLastOption")}
            onClick={removeAnswer}
            disabled={answersList.length <= 2 || isTrueOrFalse}
            className="flex size-7 items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <button
            aria-label={t("quizz:answerLength.addOption")}
            onClick={addAnswer}
            disabled={answersList.length >= 7 || isTrueOrFalse}
            className="flex size-7 items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {isTrueOrFalse &&
        getOversizedAnswerIndexes(currentQuestion).length > 0 && (
          <button
            type="button"
            onClick={() =>
              updateQuestion(currentIndex, { answers: ["True", "False"] })
            }
            className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            {t("quizz:answerLength.resetTrueFalse")}
          </button>
        )}

      <div className="grid min-w-0 grid-cols-1 gap-3 @lg:grid-cols-2">
        {answersList.map((answer, i) => {
          const isSelected = (currentQuestion.solutions ?? []).includes(i)
          const isPuzzle = currentQuestion.type === "puzzle"
          const length = getAnswerLength(answer)
          const isTooLong = length > MAX_ANSWER_LENGTH
          const inputId = getAnswerInputId(currentQuestion.id, i)
          const optionLabel = isPuzzle ? `${i + 1}` : ANSWERS_LABELS[i]

          return (
            <div
              key={i}
              id={`${inputId}-option`}
              className={clsx(
                "flex min-w-0 flex-col gap-3 rounded-2xl p-4",
                ANSWERS_COLORS[i],
                isTooLong && "ring-2 ring-red-600 ring-offset-2",
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <label
                  htmlFor={inputId}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md bg-black/20 text-sm font-bold text-white md:size-8 md:text-base"
                >
                  <span aria-hidden="true">{optionLabel}</span>
                  <span className="sr-only">
                    {t("quizz:answerLength.optionLabel", {
                      option: optionLabel,
                    })}
                  </span>
                </label>
                <span
                  id={`${inputId}-count`}
                  className={clsx(
                    "rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                    isTooLong
                      ? "bg-white text-red-700"
                      : "bg-black/15 text-white",
                  )}
                >
                  {length}/{MAX_ANSWER_LENGTH}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                <textarea
                  id={inputId}
                  rows={3}
                  className="min-h-16 w-full min-w-0 resize-y rounded-md bg-transparent leading-relaxed font-semibold [overflow-wrap:anywhere] text-white placeholder-white/70 outline-none focus-visible:ring-2 focus-visible:ring-white"
                  placeholder={
                    isPuzzle ? `Step ${i + 1}` : t("quizz:addAnswerPlaceholder")
                  }
                  value={answer}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  maxLength={MAX_ANSWER_LENGTH}
                  readOnly={isTrueOrFalse}
                  aria-invalid={isTooLong}
                  aria-describedby={
                    isTooLong
                      ? `${inputId}-count ${inputId}-error`
                      : `${inputId}-count`
                  }
                />
                {!isPuzzle && (
                  <button
                    type="button"
                    aria-label={t("quizz:answerLength.markCorrect", {
                      option: optionLabel,
                    })}
                    aria-pressed={isSelected}
                    onClick={() => toggleSolution(i)}
                    className={clsx(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected
                        ? "border-white bg-white text-green-600"
                        : "border-white/60 bg-transparent",
                    )}
                  >
                    {isSelected && <Check className="size-4 stroke-5" />}
                  </button>
                )}
              </div>
              {isTooLong && (
                <p
                  id={`${inputId}-error`}
                  className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed font-semibold text-red-800"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
                  />
                  <span>
                    {t("quizz:answerLength.excess", {
                      count: length - MAX_ANSWER_LENGTH,
                      limit: MAX_ANSWER_LENGTH,
                    })}
                  </span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default QuestionEditorAnswers
