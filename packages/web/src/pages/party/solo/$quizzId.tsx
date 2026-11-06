import { api, unwrap } from "@razzia/web/lib/api"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import SortableList from "@razzia/web/components/SortableList"
import toast from "react-hot-toast"
import { EVENTS } from "@razzia/common/constants"
import type { QuizzWithId } from "@razzia/common/types/game"
import Background from "@razzia/web/components/Background"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import {
  CheckCircle,
  XCircle,
  Award,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { useEffect, useState } from "react"
import { motion } from "motion/react"

const ANSWER_COLORS = [
  "bg-red-500 hover:bg-red-600 border-red-600 text-white",
  "bg-blue-500 hover:bg-blue-600 border-blue-600 text-white",
  "bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white",
  "bg-green-500 hover:bg-green-600 border-green-600 text-white",
  "bg-purple-500 hover:bg-purple-600 border-purple-600 text-white",
  "bg-pink-500 hover:bg-pink-600 border-pink-600 text-white",
  "bg-indigo-500 hover:bg-indigo-600 border-indigo-600 text-white",
]

const SoloGamePage = () => {
  const { quizzId } = useParams({ from: "/party/solo/$quizzId" })
  const { socket, isConnected } = useSocket()
  const { user } = useUserStore()
  const navigate = useNavigate()

  const [quizz, setQuizz] = useState<QuizzWithId | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [puzzleItems, setPuzzleItems] = useState<
    Array<{ id: string; index: number; text: string }>
  >([])
  const [saving, setSaving] = useState(false)
  const [gameState, setGameState] = useState<"lobby" | "question" | "finished">(
    "lobby",
  )
  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [isAnswered, setIsAnswered] = useState(false)
  const [savedUserAnswers, setSavedUserAnswers] = useState<
    Record<number, number[] | null>
  >({})

  useEffect(() => {
    if (isConnected && quizzId) {
      void unwrap(api.solo[":id"].$get({ param: { id: quizzId } }))
        .then((data) => {
          setQuizz(data)
          setLoading(false)
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error
              ? failure.message
              : "errors:api.serverError",
          )
          setLoading(false)
        })
    }
  }, [isConnected, quizzId, socket])

  useEvent(EVENTS.QUIZZ.DATA, (data) => {
    if (data.id === quizzId) {
      setQuizz(data)
      setLoading(false)
    }
  })

  useEvent(EVENTS.QUIZZ.ERROR, (msg) => {
    setError(msg)
    setLoading(false)
  })

  const startQuiz = () => {
    if (!quizz) {
      return
    }

    setGameState("question")
    setCurrentIdx(0)
    setScore(0)
    setSavedUserAnswers({})
    loadQuestion(0)
  }

  const loadQuestion = (idx: number) => {
    if (!quizz) {
      return
    }

    setSelectedAnswers([])
    setIsAnswered(false)
    const question = quizz.questions[idx]

    if (question.type === "puzzle") {
      setPuzzleItems(
        (question.answers ?? [])
          .map((text, index) => ({ id: String(index), index, text }))
          .sort(() => Math.random() - 0.5),
      )
    }
  }

  const handleAnswerClick = (ansIdx: number) => {
    if (isAnswered || !quizz) {
      return
    }

    const q = quizz.questions[currentIdx]
    const sols = q.solutions ?? []

    const multiple = sols.length > 1
    let newSelection: number[] = []

    if (multiple) {
      if (selectedAnswers.includes(ansIdx)) {
        newSelection = selectedAnswers.filter((a) => a !== ansIdx)
      } else {
        newSelection = [...selectedAnswers, ansIdx]
      }

      setSelectedAnswers(newSelection)
    } else {
      newSelection = [ansIdx]
      setSelectedAnswers(newSelection)
      submitAnswer(newSelection)
    }
  }

  const submitMultipleAnswers = () => {
    submitAnswer(selectedAnswers)
  }

  const submitAnswer = (selection: number[]) => {
    setIsAnswered(true)

    if (!quizz) {
      return
    }

    const q = quizz.questions[currentIdx]
    const sols = q.solutions ?? []

    const isCorrect =
      q.type === "puzzle"
        ? selection.length === q.answers?.length &&
          selection.every((value, index) => value === index)
        : sols.length === selection.length &&
          selection.every((val) => sols.includes(val))
    let pointsEarned = 0

    if (isCorrect) {
      pointsEarned = q.doublePoints ? 2000 : 1000
      setScore((prev) => prev + pointsEarned)
    }

    setSavedUserAnswers((prev) => ({ ...prev, [currentIdx]: selection }))
  }

  const nextQuestion = () => {
    if (!quizz) {
      return
    }

    if (currentIdx + 1 < quizz.questions.length) {
      setCurrentIdx((prev) => prev + 1)
      loadQuestion(currentIdx + 1)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = () => {
    if (!quizz || !user || saving) {
      return
    }

    setSaving(true)
    void unwrap(
      api.solo[":id"].results.$post({
        param: { id: quizz.id },
        json: { answers: savedUserAnswers },
      }),
    )
      .then((result) => {
        setScore(result.players[0]?.points ?? 0)
        setGameState("finished")
      })
      .catch((failure: unknown) =>
        toast.error(
          failure instanceof Error ? failure.message : "Request failed",
        ),
      )
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <Background>
        <Loader className="h-20" />
      </Background>
    )
  }

  if (error || !quizz) {
    return (
      <Background>
        <Card className="max-w-sm p-6 text-center">
          <p className="mb-4 font-bold text-red-500">Error loading quiz</p>
          <Button onClick={() => navigate({ to: "/" })}>Go Back</Button>
        </Card>
      </Background>
    )
  }

  return (
    <Background>
      <div className="z-10 flex max-h-[calc(100dvh-160px)] w-full max-w-2xl touch-auto scrollbar-thin flex-col items-center overflow-y-auto p-4">
        {gameState === "lobby" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full justify-center text-center"
          >
            <Card className="flex w-full max-w-md flex-col items-center border border-gray-100 bg-white/95 p-6 shadow-2xl sm:p-8">
              <span className="bg-primary/10 text-primary mb-4 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
                Solo Mode
              </span>
              <h1 className="mb-2 text-2xl leading-tight font-extrabold text-gray-800 sm:text-3xl">
                {quizz.subject}
              </h1>
              <p className="mb-6 text-xs font-medium text-gray-500 sm:text-sm">
                {quizz.questions.length} Questions • Attempt in private
              </p>

              <div className="flex w-full max-w-xs gap-3">
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-200 sm:py-3 sm:text-sm"
                >
                  <ArrowLeft className="size-4" />
                  Exit
                </button>
                <Button
                  className="flex-1 py-2.5 text-xs shadow-lg sm:py-3 sm:text-sm"
                  onClick={startQuiz}
                >
                  Start
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {gameState === "question" && (
          <div className="flex w-full flex-col gap-4">
            <div className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg text-sm font-extrabold">
                  {currentIdx + 1}
                </span>
                <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  of {quizz.questions.length} Questions
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    Score
                  </span>
                  <p className="text-sm font-extrabold text-gray-700 sm:text-base">
                    {score} pts
                  </p>
                </div>
              </div>
            </div>

            <Card className="flex min-h-[180px] w-full flex-col justify-between border border-gray-100 bg-white/95 p-4 shadow-md sm:min-h-[260px] sm:p-6">
              <div className="flex flex-1 flex-col items-center justify-center py-2 sm:py-4">
                {quizz.questions[currentIdx].doublePoints && (
                  <span className="mb-3 animate-pulse rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-extrabold tracking-widest text-amber-600 uppercase">
                    🔥 Double Points
                  </span>
                )}
                <h2 className="mb-4 max-w-lg text-center text-lg leading-snug font-bold text-gray-800 sm:text-xl md:text-2xl">
                  {quizz.questions[currentIdx].question}
                </h2>

                {quizz.questions[currentIdx].media && (
                  <div className="mt-2 aspect-video max-h-[20dvh] w-full max-w-xs overflow-hidden rounded-lg border border-gray-200 shadow-sm sm:max-w-md">
                    <QuestionMedia
                      media={quizz.questions[currentIdx].media}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {quizz.questions[currentIdx].type !== "puzzle" &&
                quizz.questions[currentIdx].solutions &&
                (quizz.questions[currentIdx].solutions.length || 0) > 1 &&
                !isAnswered && (
                  <Button
                    className="mb-2 w-full py-2 text-sm shadow-md sm:mb-4 sm:py-2.5"
                    onClick={submitMultipleAnswers}
                  >
                    Submit Selection
                  </Button>
                )}
            </Card>

            {quizz.questions[currentIdx].type === "slide" && (
              <p className="rounded-xl bg-white/95 p-5 whitespace-pre-wrap text-gray-800">
                {quizz.questions[currentIdx].text}
              </p>
            )}
            {quizz.questions[currentIdx].type === "puzzle" ? (
              <div className="flex flex-col gap-3">
                <SortableList
                  items={puzzleItems}
                  onReorder={(items) => {
                    if (!isAnswered) {
                      setPuzzleItems(items)
                    }
                  }}
                  label={(_item, index) => `Move answer ${index + 1}`}
                  className="flex flex-col gap-2"
                  renderItem={(item, index, handle) => (
                    <div className="flex min-h-14 items-center gap-3 rounded-xl bg-white p-3 text-gray-800">
                      <span>{index + 1}</span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {item.text}
                      </span>
                      {!isAnswered && handle}
                    </div>
                  )}
                />
                {!isAnswered && (
                  <Button
                    onClick={() =>
                      submitAnswer(puzzleItems.map((item) => item.index))
                    }
                  >
                    Submit Order
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                {quizz.questions[currentIdx].answers?.map((ans, idx) => {
                  const isCorrectSol =
                    quizz.questions[currentIdx].solutions?.includes(idx)
                  const isUserSelected = selectedAnswers.includes(idx)
                  let colorClass = ANSWER_COLORS[idx % ANSWER_COLORS.length]

                  if (isAnswered) {
                    if (isCorrectSol) {
                      colorClass =
                        "bg-green-600 border-green-700 text-white shadow-green-200"
                    } else if (isUserSelected) {
                      colorClass =
                        "bg-red-600 border-red-700 text-white shadow-red-200"
                    } else {
                      colorClass =
                        "bg-gray-100 border-gray-200 text-gray-400 opacity-50"
                    }
                  } else if (isUserSelected) {
                    colorClass =
                      "bg-primary border-primary text-white scale-[1.02] shadow-md ring-2 ring-primary/20"
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleAnswerClick(idx)}
                      className={`flex items-center justify-between rounded-xl border-b-4 p-4 text-left text-base font-bold transition-all duration-150 active:scale-[0.98] ${colorClass}`}
                    >
                      <span>{ans}</span>
                      {isAnswered && isCorrectSol && (
                        <CheckCircle className="ml-2 size-5 shrink-0" />
                      )}
                      {isAnswered && isUserSelected && !isCorrectSol && (
                        <XCircle className="ml-2 size-5 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {(isAnswered || quizz.questions[currentIdx].type === "slide") && (
              <Button
                className="bg-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-white shadow-lg"
                disabled={saving}
                onClick={nextQuestion}
              >
                {currentIdx + 1 === quizz.questions.length
                  ? "Finish Quiz"
                  : "Next Question"}
                <ArrowRight className="size-5" />
              </Button>
            )}
          </div>
        )}

        {gameState === "finished" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full justify-center text-center"
          >
            <Card className="flex w-full max-w-md flex-col items-center border border-gray-100 bg-white/95 p-6 shadow-2xl sm:p-8">
              <Award className="mb-4 size-16 animate-bounce fill-amber-50 text-amber-500" />
              <h1 className="mb-2 text-2xl leading-tight font-extrabold text-gray-800 sm:text-3xl">
                Quiz Completed!
              </h1>
              <p className="mb-6 text-xs font-medium text-gray-500 sm:text-sm">
                Here is your solo performance summary
              </p>

              <div className="mb-6 w-full max-w-xs rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                <span className="block text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                  Final Score
                </span>
                <span className="text-2xl font-black text-gray-700 sm:text-3xl">
                  {score}
                </span>
                <span className="mt-1 block text-xs font-semibold text-gray-400">
                  points
                </span>
              </div>

              <Button
                className="w-full max-w-xs py-2.5 text-xs shadow-md sm:py-3 sm:text-sm"
                onClick={() => navigate({ to: "/" })}
              >
                Back to Dashboard
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </Background>
  )
}

export const Route = createFileRoute("/party/solo/$quizzId")({
  component: SoloGamePage,
})
