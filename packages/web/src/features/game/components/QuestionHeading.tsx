import clsx from "clsx"

interface Props {
  question: string
  className?: string
}

const QuestionHeading = ({ question, className }: Props) => (
  <h2
    data-question-length={
      question.length < 50 ? "short" : question.length < 100 ? "medium" : "long"
    }
    className={clsx(
      "live-question text-center leading-tight font-extrabold text-white drop-shadow-lg",
      className,
    )}
  >
    {question}
  </h2>
)

export default QuestionHeading
