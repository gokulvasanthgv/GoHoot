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
      onClick={onClick}
      className={twMerge(
        clsx(
          "group relative flex h-36 cursor-pointer flex-col justify-between gap-1 rounded-lg border-2 border-gray-200 bg-white px-3 py-2",
          {
            "border-primary": isActive,
            "border-red-500 ring-2 ring-red-100": hasOversizedAnswers,
            "bg-red-50": isActive && hasOversizedAnswers,
          },
        ),
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-4">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-400">
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
        <p
          className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700"
          title={question.question}
        >
          {question.question || t("quizz:noQuestionYet")}
        </p>
      </div>

      <SlideMedia media={question.media} />

      <div className="grid grid-cols-2 gap-1">
        {(question.answers ?? []).map((_, i) => (
          <div
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
              <div className="ml-auto size-1.5 rounded-full bg-green-400" />
            )}
          </div>
        ))}
      </div>

      {canDelete && (
        <AlertDialog
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1.5 right-1.5 hidden rounded-sm bg-white p-1 text-gray-400 group-hover:block hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
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
