import { MAX_ANSWER_LENGTH, MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
import { getYoutubeId } from "@razzia/web/components/QuestionMedia"
import AlertDialog from "@razzia/web/components/AlertDialog"
import { type QuestionWithId } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { getOversizedAnswerIndexes } from "@razzia/web/features/quizz/utils/answer-validation"
import clsx from "clsx"
import { Music, Trash2, Video } from "lucide-react"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

const SlideMedia = ({ media }: { media?: QuestionMedia }) => {
  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img src={media.url} className="mx-auto max-h-14 w-auto rounded-md" />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    const youtubeId = getYoutubeId(media.url)

    if (youtubeId) {
      return (
        <img
          src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
          className="mx-auto max-h-14 w-auto rounded-md"
        />
      )
    }

    return <Video className="mx-auto size-10 text-gray-400" />
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return <Music className="mx-auto size-10 text-gray-400" />
  }

  return null
}

interface Props {
  question: QuestionWithId
  index: number
  isActive: boolean
  canDelete: boolean
  onClick: () => void
  onDelete: () => void
}

const QuizzEditorCard = ({
  question,
  index,
  isActive,
  canDelete,
  onClick,
  onDelete,
}: Props) => {
  const { t } = useTranslation()
  const oversizedAnswers = getOversizedAnswerIndexes(question)
  const hasOversizedAnswers = oversizedAnswers.length > 0
  const lengthWarning = t("quizz:answerLength.questionWarning", {
    number: index + 1,
    limit: MAX_ANSWER_LENGTH,
  })

  return (
    <div
      id={`question-card-${question.id}`}
      className={twMerge(
        clsx(
          "group relative flex min-w-0 items-center rounded-lg border-2 border-gray-200 bg-white lg:h-36",
          {
            "border-primary": isActive,
            "border-red-500 ring-2 ring-red-100": hasOversizedAnswers,
            "bg-red-50": isActive && hasOversizedAnswers,
          },
        ),
      )}
    >
      <button
        type="button"
        aria-current={isActive ? "step" : undefined}
        onClick={onClick}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1 rounded-lg px-2 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 lg:h-full lg:justify-between lg:px-3"
      >
        <span
          className={clsx(
            "flex min-w-0 items-center gap-2",
            canDelete && "lg:pr-5",
          )}
        >
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-500 lg:text-xs">
            {index + 1}
            {hasOversizedAnswers && (
              <span
                role="img"
                aria-label={lengthWarning}
                title={lengthWarning}
                className="size-2.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
              />
            )}
          </span>
          <span
            className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere] text-gray-700 lg:truncate lg:text-xs"
            title={question.question}
          >
            {question.question || t("quizz:noQuestionYet")}
          </span>
        </span>

        <span className="hidden lg:block">
          <SlideMedia media={question.media} />
        </span>

        <span className="hidden grid-cols-2 gap-1 lg:grid">
          {(question.answers ?? []).map((_, i) => (
            <span
              key={i}
              title={
                oversizedAnswers.includes(i)
                  ? t("quizz:answerLength.optionWarning", {
                      option: i + 1,
                      limit: MAX_ANSWER_LENGTH,
                    })
                  : undefined
              }
              className={clsx(
                "flex h-4 flex-1 items-center rounded-md border border-gray-300 px-0.5",
                {
                  "border-red-500 bg-red-100": oversizedAnswers.includes(i),
                },
              )}
            >
              {(question.solutions ?? []).includes(i) && (
                <span className="ml-auto size-1.5 rounded-full bg-green-400" />
              )}
            </span>
          ))}
        </span>
      </button>

      {canDelete && (
        <AlertDialog
          trigger={
            <button
              type="button"
              aria-label={t("quizz:question.deleteQuestion")}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 lg:absolute lg:top-1 lg:right-1 lg:bg-white lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 lg:pointer-fine:size-7 lg:pointer-fine:opacity-0"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          }
          title={t("quizz:question.deleteQuestion")}
          description={t("quizz:question.deleteQuestionConfirm")}
          confirmLabel={t("common:delete")}
          onConfirm={onDelete}
        />
      )}
    </div>
  )
}

export default QuizzEditorCard
