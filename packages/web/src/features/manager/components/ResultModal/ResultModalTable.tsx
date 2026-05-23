import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalTable = () => {
  const { questionResult, getPlayerPoints } = useResultModal()
  const { t } = useTranslation()

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 shadow-sm">
        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <th className="px-5 py-2.5">{t("manager:result.table.player")}</th>
          <th className="px-4 py-2.5">{t("manager:result.table.answered")}</th>
          <th className="px-4 py-2.5">
            {t("manager:result.table.correctIncorrect")}
          </th>
          <th className="px-4 py-2.5 text-right">
            {t("manager:result.table.points")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {questionResult.playerAnswers.map((pa, i) => {
          const isCorrect = (() => {
            const answerIds = pa.answerIds
            if (!answerIds || answerIds.length === 0) return false
            if (questionResult.type === "puzzle") {
              const totalAnswers = questionResult.answers?.length ?? 0
              if (answerIds.length !== totalAnswers) return false
              return answerIds.every((val, index) => val === index)
            }
            const solutions = questionResult.solutions || []
            return answerIds.every((id) => solutions.includes(id))
          })()

          return (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-5 py-2.5 font-medium">{pa.playerName}</td>
              <td className="px-4 py-2.5">
                {pa.answerIds && pa.answerIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {pa.answerIds.map((val) => {
                      const label =
                        questionResult.type === "puzzle"
                          ? `${val + 1}`
                          : ANSWERS_LABELS[val % ANSWERS_LABELS.length]
                      const color =
                        questionResult.type === "puzzle"
                          ? "bg-slate-500 text-white"
                          : ANSWERS_COLORS[val % ANSWERS_COLORS.length]
                      const text = questionResult.answers?.[val] || ""
                      return (
                        <span
                          key={val}
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white",
                            color,
                          )}
                        >
                          <span className="font-bold">{label}</span>
                          {text && (
                            <span className="max-w-30 truncate">{text}</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {isCorrect ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="size-3.5" />{" "}
                    {t("manager:result.table.correct")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <X className="size-3.5" />{" "}
                    {t("manager:result.table.incorrect")}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                {getPlayerPoints(pa.playerName)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default ResultModalTable
