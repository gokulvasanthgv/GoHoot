import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMode from "@razzia/web/features/game/components/QuestionMode"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const Prepared = ({ data: { questionNumber, type, multiSelect } }: Props) => {
  const { t } = useTranslation()

  return (
    <section className="conductor-compact:shrink-0 conductor-compact:basis-auto relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-3 px-4 py-3 text-center text-white">
      <p className="text-base font-bold text-slate-200 sm:text-xl">
        {t("game:questionPrefix")}
        {questionNumber}
      </p>
      <h2 className="conductor-compact:text-2xl text-3xl font-extrabold drop-shadow-lg sm:text-5xl">
        {t("game:getReady")}
      </h2>
      <QuestionMode
        key={questionNumber}
        type={type}
        multiSelect={multiSelect}
        animated
      />
    </section>
  )
}

export default Prepared
