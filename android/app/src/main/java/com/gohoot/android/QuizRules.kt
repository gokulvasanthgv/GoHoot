package com.gohoot.android

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

internal fun newQuestion(type: String): Question = when (type) {
    "slide" -> Question(type = type, text = "")
    "true_or_false" -> Question(type = type, answers = listOf("True", "False"), solutions = listOf(0))
    else -> Question(type = type, answers = listOf("", "", "", ""))
}

internal fun importQuizJson(text: String): Quiz {
    val root = wireJson.parseToJsonElement(text).jsonObject
    val entries = root.getValue("questions").jsonArray.map { element ->
        val question = element.jsonObject
        val solution = question["solutions"]
        if (solution is JsonPrimitive && solution.isString.not()) {
            JsonObject(question + ("solutions" to JsonArray(listOf(solution))))
        } else element
    }
    return wireJson.decodeFromJsonElement(Quiz.serializer(),
        JsonObject(root + ("questions" to JsonArray(entries))))
}

private fun validMedia(value: String?): Boolean {
    if (value.isNullOrEmpty()) return true
    if (value.length > 2048) return false
    if (value.matches(Regex("/uploads/[A-Za-z0-9_-]+\\.[A-Za-z0-9]+"))) return true
    val url = value.toHttpUrlOrNullSafe() ?: return false
    return url.username.isEmpty() && url.password.isEmpty()
}

internal fun validateQuiz(quiz: Quiz): String? {
    if (quiz.subject.length !in 1..500) return "Enter a quiz title with 1 to 500 characters."
    if (quiz.questions.size !in 1..500) return "A quiz must have 1 to 500 questions."
    if (!validMedia(quiz.wallpaper) || !validMedia(quiz.audio)) return "Enter a valid wallpaper and audio URL."
    quiz.questions.forEachIndexed { index, question ->
        val issue = when {
            question.type !in listOf("quiz", "true_or_false", "puzzle", "slide") -> "Choose a question type."
            question.question.length !in 1..4000 -> "Enter a title with 1 to 4000 characters."
            (question.text?.length ?: 0) > 20000 -> "Slide text can have up to 20,000 characters."
            question.cooldown !in 3..15 -> "Set the reading time from 3 to 15 seconds."
            question.time !in 5..120 -> "Set the answer time from 5 to 120 seconds."
            !validMedia(question.media?.url) -> "Enter a valid media URL."
            question.type == "slide" -> null
            question.choices.size !in 2..7 -> "Add 2 to 7 answers."
            question.choices.any { it.length !in 1..65 } -> "Each answer needs 1 to 65 characters."
            question.type == "puzzle" -> null
            question.correctChoices.isEmpty() ||
                question.correctChoices.toSet().size != question.correctChoices.size ||
                question.correctChoices.any { it !in question.choices.indices } -> "Mark the correct answers."
            question.type == "true_or_false" &&
                (question.choices.size != 2 || question.correctChoices.size != 1) -> "Mark one correct answer."
            else -> null
        }
        if (issue != null) return "Question " + (index + 1) + ". " + issue
    }
    return null
}

internal fun Question.removeChoice(index: Int): Question = copy(
    answers = choices.filterIndexed { i, _ -> i != index },
    solutions = correctChoices.filter { it != index }.map { if (it > index) it - 1 else it },
)

internal fun <T> List<T>.moved(from: Int, to: Int): List<T> =
    toMutableList().apply { add(to, removeAt(from)) }

internal fun questionType(value: String?) = when (value) {
    "true_or_false" -> "True or false"
    "puzzle" -> "Puzzle"
    "slide" -> "Slide"
    else -> "Multiple choice"
}

internal fun questionMode(type: String?, multiple: Boolean?) = when (type) {
    "true_or_false" -> "True or false"
    "puzzle" -> "Arrange in order"
    "slide" -> "Slide"
    else -> when (multiple) {
        true -> "Multi-select"
        false -> "One correct answer"
        null -> "Multiple choice"
    }
}

internal fun messageText(key: String): String = when (key) {
    "game:waitingForPlayers" -> "Waiting for players"
    "game:waitingForAnswers" -> "Waiting for the other players"
    "game:correct" -> "Correct!"
    "game:wrong" -> "Incorrect"
    "errors:game.notFound" -> "This room could not be found."
    "errors:game.expired" -> "This room has expired."
    "errors:game.sessionTakenOver" -> "This room is open on another device."
    "errors:game.kickedByManager" -> "The host removed you from the room."
    "errors:game.managerDisconnected" -> "The host disconnected and the room closed."
    "errors:game.alreadyStarted" -> "The game has already started."
    "errors:game.managerCannotJoin" -> "The host cannot join their own room."
    "errors:game.noPlayersConnected" -> "At least one player must be connected to start."
    "errors:game.tooManyGames" -> "Close an existing game before creating another."
    "errors:auth.usernameTaken" -> "That nickname is already in use."
    "errors:auth.invalidInviteCode" -> "Enter the six-digit room code."
    "errors:auth.usernameTooShort" -> "Enter a nickname."
    "errors:auth.usernameTooLong" -> "Use at most 20 characters for the nickname."
    "errors:auth.passwordTooShort" -> "Use at least 8 characters for the password."
    "errors:auth.joinTicketInvalid" -> "The join request expired. Try joining again."
    "errors:auth.signupDisabled" -> "This server has disabled sign-up."
    "errors:auth.invalidCredentials", "errors:auth.wrongPassword" -> "Check your username and password."
    "errors:auth.unauthorized", "errors:unauthorized" -> "Your account does not have access to this action."
    "errors:auth.userNotFound" -> "This account could not be found."
    "errors:auth.rateLimited" -> "Too many requests. Wait a moment and try again."
    "errors:auth.invalidInput", "errors:invalidRequest" -> "Check the information and try again."
    "errors:quizz.notFound" -> "This quiz could not be found."
    "errors:quizz.incompatible" -> "This quiz needs to be repaired in the editor before it can be played."
    "errors:quizz.invalidMediaUrl" -> "Enter a valid media URL."
    "errors:media.tooLarge" -> "The file is empty or larger than 100 MB."
    "errors:media.invalidType" -> "This server does not support that file type."
    "errors:api.serverError" -> "The GoHoot server could not complete the action."
    else -> if (key.startsWith("errors:") || key.startsWith("game:")) {
        val detail = key.substringAfterLast('.').substringAfter(':')
            .replace(Regex("([a-z])([A-Z])"), "$1 $2").lowercase()
        detail.replaceFirstChar { it.uppercase() }.trimEnd('.') + "."
    } else key
}
