package com.gohoot.android

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

internal val wireJson = Json { ignoreUnknownKeys = true }
internal val roles = listOf("admin", "quizmaster", "analyst", "quizzer")
internal const val uploadLimit = 100L * 1024 * 1024

@Serializable
internal data class User(val id: String, val username: String, val role: String, val createdAt: String? = null) {
    val canHost get() = role == "admin" || role == "quizmaster"
    val canReport get() = canHost || role == "analyst"
    val admin get() = role == "admin"
}

@Serializable
internal data class Session(
    val token: String,
    val clientId: String,
    val expiresAt: Long,
    val user: User? = null,
)

@Serializable
internal data class Media(val type: String? = null, val url: String = "")

@Serializable
internal data class Question(
    val question: String = "",
    val type: String = "quiz",
    val text: String? = null,
    val media: Media? = null,
    val answers: List<String>? = null,
    val solutions: List<Int>? = null,
    val cooldown: Int = 5,
    val time: Int = 20,
    val doublePoints: Boolean? = null,
    val playerAnswers: List<RecordedAnswer> = emptyList(),
) {
    val choices get() = answers.orEmpty()
    val correctChoices get() = solutions.orEmpty()

    fun check(selection: List<Int>): Boolean = when (type) {
        "slide" -> false
        "puzzle" -> selection == choices.indices.toList()
        else -> selection.isNotEmpty() && selection.size == correctChoices.size &&
            selection.toSet() == correctChoices.toSet()
    }

    fun forSave(): Question = copy(
        question = question.trim(),
        answers = choices.map(String::trim).takeUnless { type == "slide" },
        solutions = correctChoices.takeUnless { type == "slide" || type == "puzzle" },
        text = text.takeIf { type == "slide" },
        media = media?.copy(url = media.url.trim())?.takeIf { it.url.isNotEmpty() },
        playerAnswers = emptyList(),
    )
}

@Serializable
internal data class Quiz(
    val id: String? = null,
    val subject: String = "",
    val questions: List<Question> = emptyList(),
    val wallpaper: String? = null,
    val audio: String? = null,
    val incompatible: Boolean = false,
) {
    fun forSave() = copy(
        id = null,
        subject = subject.trim(),
        questions = questions.map(Question::forSave),
        wallpaper = wallpaper?.trim(),
        audio = audio?.trim(),
        incompatible = false,
    )
}

@Serializable
internal data class QuizSummary(
    val id: String,
    val subject: String,
    val incompatible: Boolean = false,
    val creatorId: String? = null,
    val deletedAt: String? = null,
)

@Serializable
internal data class Player(
    val username: String,
    val id: String? = null,
    val clientId: String? = null,
    val connected: Boolean = true,
    val points: Int = 0,
    val rank: Int? = null,
    val userId: String? = null,
)

@Serializable
internal data class RecordedAnswer(
    val playerName: String,
    val answerIds: List<Int>? = null,
    val userId: String? = null,
    val correct: Boolean? = null,
    val points: Int? = null,
)

@Serializable
internal data class ResultSummary(
    val id: String,
    val subject: String,
    val date: String,
    val playerCount: Int,
    val mode: String? = null,
)

@Serializable
internal data class GameResult(
    val id: String,
    val subject: String,
    val date: String,
    val players: List<Player>,
    val questions: List<Question>,
    val mode: String? = null,
)

@Serializable
internal data class AttendedQuestion(
    val question: String,
    val type: String = "quiz",
    val correct: Boolean = false,
    val points: Int? = null,
    val selectedAnswers: List<Int>? = null,
    val answers: List<String>? = null,
    val solutions: List<Int>? = null,
)

@Serializable
internal data class Attendance(
    val id: String,
    val quizzId: String? = null,
    val subject: String,
    val date: String,
    val mode: String? = null,
    val points: Int,
    val rank: Int,
    val totalPlayers: Int,
    val questions: List<AttendedQuestion>,
)

@Serializable
internal data class ResetRequest(val id: String, val username: String, val createdAt: String)

@Serializable
internal data class Configuration(
    @SerialName("quizz") val quizzes: List<QuizSummary> = emptyList(),
    val results: List<ResultSummary> = emptyList(),
    val trash: List<QuizSummary> = emptyList(),
    val users: List<User> = emptyList(),
    val notifications: List<ResetRequest> = emptyList(),
    val defaultWallpaper: String? = null,
    val defaultAudio: String? = null,
    val user: User? = null,
)

@Serializable
internal data class Upload(val success: Boolean, val url: String? = null, val error: String? = null)

@Serializable
internal data class GameCreated(
    val gameId: String,
    val inviteCode: String,
    val wallpaper: String? = null,
    val audio: String? = null,
)

@Serializable
internal data class JoinTicket(val gameId: String, val ticket: String? = null, val username: String)

@Serializable
internal data class RoomRef(
    val origin: String,
    val clientId: String,
    val gameId: String,
    val host: Boolean,
    val subject: String = "",
    val code: String = "",
    val nickname: String = "",
    val accountId: String? = null,
    val mode: String? = null,
) {
    fun canRestore(session: Session): Boolean = session.clientId == clientId &&
        (!host || (session.user?.id == accountId && session.user?.canHost == true))
}

@Serializable
internal data class GameOptions(
    val shuffleQuestions: Boolean = false,
    val doubleTime: Boolean = false,
    val shuffleAnswers: Boolean = false,
    val hideTextOnClient: Boolean = false,
)

@Serializable
internal data class QuestionNumber(val current: Int = 0, val total: Int = 0)

@Serializable
internal data class GameMedia(
    val gameId: String,
    val wallpaper: String? = null,
    val audio: String? = null,
)

@Serializable
internal data class PreviousQuestion(val index: Int, val question: String)

@Serializable
internal data class GameFrame(
    val name: String,
    val data: FrameData = FrameData(),
    val gameId: String? = null,
    val wallpaper: String? = null,
    val audio: String? = null,
)

@Serializable
internal data class FrameData(
    val text: String? = null,
    val inviteCode: String? = null,
    val subject: String? = null,
    val time: Int? = null,
    val cooldown: Int? = null,
    val question: String? = null,
    val questionNumber: Int? = null,
    val totalAnswers: Int? = null,
    val media: Media? = null,
    val type: String? = null,
    val hideTextOnClient: Boolean = false,
    val answersCount: Int? = null,
    val doublePoints: Boolean = false,
    val answers: List<String> = emptyList(),
    val totalPlayer: Int? = null,
    val multiSelect: Boolean? = null,
    val correct: Boolean? = null,
    val message: String? = null,
    val points: Int? = null,
    val myPoints: Int? = null,
    val streak: Int? = null,
    val rank: Int? = null,
    val aheadOfMe: String? = null,
    val top: List<Player> = emptyList(),
    val result: GameResult? = null,
    val responses: Map<Int, Int> = emptyMap(),
    val solutions: List<Int> = emptyList(),
    val oldLeaderboard: List<Player> = emptyList(),
    val leaderboard: List<Player> = emptyList(),
    val previousQuestions: List<PreviousQuestion> = emptyList(),
)

@Serializable
internal data class Rejoin(
    val gameId: String,
    val status: GameFrame,
    val currentQuestion: QuestionNumber,
    val player: Player? = null,
    val inviteCode: String? = null,
    val players: List<Player> = emptyList(),
    val wallpaper: String? = null,
    val audio: String? = null,
)

internal data class GameClock(val endsAt: Long = 0, val duration: Int = 0) {
    fun left(now: Long): Int = ((endsAt - now + 999) / 1000).coerceAtLeast(0).toInt()
    fun fraction(now: Long): Float = if (duration > 0) {
        ((endsAt - now).toFloat() / (duration * 1000L)).coerceIn(0f, 1f)
    } else 0f

    companion object {
        fun start(seconds: Int?, now: Long) = if (seconds != null && seconds > 0) {
            GameClock(now + seconds * 1000L, seconds)
        } else GameClock()
    }
}

internal data class LiveGame(
    val room: RoomRef,
    val frame: GameFrame? = null,
    val number: QuestionNumber = QuestionNumber(),
    val players: List<Player> = emptyList(),
    val connectedCount: Int = 0,
    val answerCount: Int = 0,
    val points: Int = 0,
    val wallpaper: String? = null,
    val audio: String? = null,
    val restored: Boolean = false,
    val awaitingAnswer: Boolean = false,
    val clock: GameClock = GameClock(),
    val revision: Int = 0,
)

internal data class SoloGame(
    val quiz: Quiz,
    val index: Int = 0,
    val answers: Map<Int, List<Int>?> = emptyMap(),
    val result: GameResult? = null,
    val totalPoints: Int = 0,
    val streak: Int = 0,
) {
    val question get() = quiz.questions[index]
    val answered get() = answers.containsKey(index)

    fun withAnswer(selection: List<Int>): SoloGame {
        if (answered || selection.isEmpty() || question.type == "slide") return this
        val correct = question.check(selection)
        val earned = if (correct) (if (question.doublePoints == true) 2000 else 1000) else 0
        return copy(answers = answers + (index to selection), totalPoints = totalPoints + earned,
            streak = if (correct) streak + 1 else 0)
    }
}

internal data class Invite(val pin: String, val origin: String? = null)

internal fun parseInvite(value: String): Invite? {
    val trimmed = value.trim()
    val pin = trimmed.filterNot(Char::isWhitespace)
    if (pin.matches(Regex("[0-9]{6}"))) return Invite(pin)
    val url = trimmed.toHttpUrlOrNullSafe() ?: return null
    if (url.encodedPath != "/" || url.username.isNotEmpty() || url.password.isNotEmpty()) return null
    val code = url.queryParameter("pin")?.takeIf { it.matches(Regex("[0-9]{6}")) } ?: return null
    return Invite(code, url.newBuilder().query(null).fragment(null).build().toString())
}
