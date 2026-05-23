import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import { exportResultsToXlsx } from "@razzia/web/features/manager/utils/exportResults"

const ResultModalHeader = () => {
  const { result, questionIndex, total, goNext, goPrev, onClose } =
    useResultModal()
  const { t } = useTranslation()

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-3">
      <h2 className="flex-1 truncate text-base font-bold text-gray-900 flex items-center gap-2">
        <span>{result.subject}</span>
        {result.mode && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
            result.mode === "accuracy"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-indigo-50 text-indigo-700 border-indigo-200"
          }`}>
            {result.mode === "accuracy" ? "Accuracy Mode" : "Classic Mode"}
          </span>
        )}
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => exportResultsToXlsx(result)}
          className="mr-2 flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700"
        >
          <Download className="size-3.5" />
          {t("manager:result.export")}
        </button>
        <span className="text-sm text-gray-400">
          {questionIndex + 1}
          {t("manager:result.paginationOf")}
          {total}
        </span>
        <button
          disabled={questionIndex === 0}
          onClick={goPrev}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          disabled={questionIndex === total - 1}
          onClick={goNext}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          onClick={onClose}
          className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}

export default ResultModalHeader
