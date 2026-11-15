import { useTranslation } from "react-i18next"

const shapes = [
  { name: "triangle", path: "M16 3 L27.3 22.6 H4.7 Z" },
  { name: "diamond", path: "M16 3 L29 16 L16 29 L3 16 Z" },
  { name: "circle", path: "M29 16 A13 13 0 1 0 3 16 A13 13 0 1 0 29 16 Z" },
  { name: "hexagon", path: "M29 16 L22.5 27.3 H9.5 L3 16 L9.5 4.7 H22.5 Z" },
  { name: "plus", path: "M3 16 H29 M16 3 V29" },
  { name: "square", path: "M6.8 6.8 H25.2 V25.2 H6.8 Z" },
  { name: "pentagon", path: "M16 3 L28.4 12 L23.6 26.5 H8.4 L3.6 12 Z" },
] as const

export const useAnswerShapeName = () => {
  const { t } = useTranslation()

  return (index: number) =>
    t(`game:answerShapes.${shapes[index]?.name ?? "triangle"}`)
}

const AnswerShape = ({
  index,
  className,
}: {
  index: number
  className?: string
}) => (
  <svg
    aria-hidden="true"
    data-answer-shape={shapes[index]?.name}
    className={className}
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
  >
    <path d={shapes[index]?.path} />
  </svg>
)

export default AnswerShape
