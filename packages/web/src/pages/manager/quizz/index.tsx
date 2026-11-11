import QuizzEditorLayout from "@razzia/web/features/quizz/components/QuizzEditorLayout"
import { QuizzEditorProvider } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"

const QuizzEditorPage = () => (
  <QuizzEditorProvider>
    <QuizzEditorLayout />
  </QuizzEditorProvider>
)

export const Route = createFileRoute("/manager/quizz/")({
  component: QuizzEditorPage,
})
