import { EVENTS } from "@razzia/common/constants"
import type { GameResult, QuizzWithId } from "@razzia/common/types/game"
import Background from "@razzia/web/components/Background"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Loader from "@razzia/web/components/Loader"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useUserStore } from "@razzia/web/features/game/stores/user"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { CheckCircle, XCircle, Award, ArrowRight, ArrowLeft } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { motion } from "motion/react"
import { v7 as uuid } from "uuid"

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

  const [gameState, setGameState] = useState<"lobby" | "question" | "finished">("lobby")
  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [isAnswered, setIsAnswered] = useState(false)
  const [savedUserAnswers, setSavedUserAnswers] = useState<Record<number, number[] | null>>({})

  useEffect(() => {
    if (isConnected && quizzId) {
      socket.emit(EVENTS.QUIZZ.GET_SOLO, quizzId)
    }
  }, [isConnected, quizzId, socket])

  useEvent(EVENTS.QUIZZ.DATA, (data) => {
    if (data && data.id === quizzId) {
      setQuizz(data)
      setLoading(false)
    }
  })

  useEvent(EVENTS.QUIZZ.ERROR, (msg) => {
    setError(msg)
    setLoading(false)
  })

  const startQuiz = () => {
    if (!quizz) return
    setGameState("question")
    setCurrentIdx(0)
    setScore(0)
    setSavedUserAnswers({})
    loadQuestion(0)
  }

  const loadQuestion = (idx: number) => {
    if (!quizz) return
    setSelectedAnswers([])
    setIsAnswered(false)
  }

  const handleAnswerClick = (ansIdx: number) => {
    if (isAnswered || !quizz) return
    const q = quizz.questions[currentIdx]
    const sols = q.solutions || []

    const multiple = sols.length > 1
    let newSelection: number[] = []

    if (multiple) {
      if (selectedAnswers.includes(ansIdx)) {
        newSelection = selectedAnswers.filter(a => a !== ansIdx)
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
    if (!quizz) return
    const q = quizz.questions[currentIdx]
    const sols = q.solutions || []

    const isCorrect = sols.length === selection.length && selection.every(val => sols.includes(val))
    let pointsEarned = 0
    if (isCorrect) {
      pointsEarned = q.doublePoints ? 2000 : 1000
      setScore(prev => prev + pointsEarned)
    }

    setSavedUserAnswers(prev => ({ ...prev, [currentIdx]: selection }))
  }

  const nextQuestion = () => {
    if (!quizz) return
    if (currentIdx + 1 < quizz.questions.length) {
      setCurrentIdx(prev => prev + 1)
      loadQuestion(currentIdx + 1)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setGameState("finished")
    if (!quizz || !user) return

    const result: GameResult = {
      id: "solo-" + uuid(),
      quizzId: quizz.id,
      subject: quizz.subject,
      date: new Date().toISOString(),
      players: [
        {
          username: user.username,
          points: score,
          rank: 1,
          userId: user.id
        }
      ],
      questions: quizz.questions.map((q, idx) => {
        const userSel = savedUserAnswers[idx] || null
        return {
          ...q,
          playerAnswers: [
            {
              playerName: user.username,
              answerIds: userSel,
              userId: user.id
            }
          ]
        }
      }),
      mode: "classic",
      creatorId: user.id
    }

    socket.emit(EVENTS.RESULTS.SAVE_SOLO, result)
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
        <Card className="p-6 text-center max-w-sm">
          <p className="text-red-500 font-bold mb-4">Error loading quiz</p>
          <Button onClick={() => navigate({ to: "/" })}>Go Back</Button>
        </Card>
      </Background>
    )
  }

  return (
    <Background>
      <div className="z-10 flex w-full max-w-2xl flex-col items-center p-4 overflow-y-auto max-h-[calc(100dvh-160px)] touch-auto scrollbar-thin">
        {gameState === "lobby" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center flex justify-center"
          >
            <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl bg-white/95 border border-gray-100 flex flex-col items-center">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                Solo Mode
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 leading-tight mb-2">
                {quizz.subject}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 font-medium">
                {quizz.questions.length} Questions • Attempt in private
              </p>

              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="size-4" />
                  Exit
                </button>
                <Button className="flex-1 py-2.5 sm:py-3 text-xs sm:text-sm shadow-lg" onClick={startQuiz}>
                  Start
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {gameState === "question" && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between w-full bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary text-sm font-extrabold">
                  {currentIdx + 1}
                </span>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  of {quizz.questions.length} Questions
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Score</span>
                  <p className="text-sm sm:text-base font-extrabold text-gray-700">{score} pts</p>
                </div>
              </div>
            </div>

            <Card className="w-full p-4 sm:p-6 shadow-md bg-white/95 border border-gray-100 min-h-[180px] sm:min-h-[260px] flex flex-col justify-between">
              <div className="flex flex-col items-center flex-1 justify-center py-2 sm:py-4">
                {quizz.questions[currentIdx].doublePoints && (
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-3 animate-pulse">
                    🔥 Double Points
                  </span>
                )}
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center text-gray-800 leading-snug max-w-lg mb-4">
                  {quizz.questions[currentIdx].question}
                </h2>

                {quizz.questions[currentIdx].media && (
                  <div className="w-full max-w-xs sm:max-w-md max-h-[20dvh] aspect-video rounded-lg overflow-hidden border border-gray-200 shadow-sm mt-2">
                    <img
                      src={quizz.questions[currentIdx].media?.url}
                      className="w-full h-full object-contain bg-black/5"
                      alt="Question attachment"
                    />
                  </div>
                )}
              </div>

              {quizz.questions[currentIdx].solutions && (quizz.questions[currentIdx].solutions?.length || 0) > 1 && !isAnswered && (
                <Button className="mb-2 sm:mb-4 w-full shadow-md py-2 sm:py-2.5 text-sm" onClick={submitMultipleAnswers}>
                  Submit Selection
                </Button>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {quizz.questions[currentIdx].answers?.map((ans, idx) => {
                const isCorrectSol = quizz.questions[currentIdx].solutions?.includes(idx)
                const isUserSelected = selectedAnswers.includes(idx)
                let colorClass = ANSWER_COLORS[idx % ANSWER_COLORS.length]

                if (isAnswered) {
                  if (isCorrectSol) {
                    colorClass = "bg-green-600 border-green-700 text-white shadow-green-200"
                  } else if (isUserSelected) {
                    colorClass = "bg-red-600 border-red-700 text-white shadow-red-200"
                  } else {
                    colorClass = "bg-gray-100 border-gray-200 text-gray-400 opacity-50"
                  }
                } else if (isUserSelected) {
                  colorClass = "bg-primary border-primary text-white scale-[1.02] shadow-md ring-2 ring-primary/20"
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleAnswerClick(idx)}
                    className={`flex items-center justify-between p-4 rounded-xl border-b-4 font-bold text-base transition-all duration-150 text-left active:scale-[0.98] ${colorClass}`}
                  >
                    <span>{ans}</span>
                    {isAnswered && isCorrectSol && <CheckCircle className="size-5 shrink-0 ml-2" />}
                    {isAnswered && isUserSelected && !isCorrectSol && <XCircle className="size-5 shrink-0 ml-2" />}
                  </button>
                )
              })}
            </div>

            {isAnswered && (
              <Button className="w-full py-3 shadow-lg flex items-center justify-center gap-2 mt-2 bg-primary text-white" onClick={nextQuestion}>
                {currentIdx + 1 === quizz.questions.length ? "Finish Quiz" : "Next Question"}
                <ArrowRight className="size-5" />
              </Button>
            )}
          </div>
        )}

        {gameState === "finished" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center flex justify-center"
          >
            <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl bg-white/95 border border-gray-100 flex flex-col items-center">
              <Award className="size-16 text-amber-500 fill-amber-50 mb-4 animate-bounce" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 leading-tight mb-2">
                Quiz Completed!
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 font-medium">
                Here is your solo performance summary
              </p>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 w-full max-w-xs mb-6 text-center">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Final Score</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-700">{score}</span>
                <span className="text-xs text-gray-400 font-semibold block mt-1">points</span>
              </div>

              <Button className="w-full max-w-xs py-2.5 sm:py-3 text-xs sm:text-sm shadow-md" onClick={() => navigate({ to: "/" })}>
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
