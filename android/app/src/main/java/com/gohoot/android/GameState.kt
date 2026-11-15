package com.gohoot.android

internal const val ROOM = "SHOW_ROOM"
internal const val START = "SHOW_START"
internal const val PREPARED = "SHOW_PREPARED"
internal const val QUESTION = "SHOW_QUESTION"
internal const val ANSWER = "SELECT_ANSWER"
internal const val WAIT = "WAIT"
internal const val RESULT = "SHOW_RESULT"
internal const val RESPONSES = "SHOW_RESPONSES"
internal const val LEADERBOARD = "SHOW_LEADERBOARD"
internal const val SLIDE = "SHOW_SLIDE"
internal const val FINISHED = "FINISHED"

internal fun LiveGame.withFrame(frame: GameFrame, now: Long): LiveGame {
    val seconds = when (frame.name) {
        START, ANSWER -> frame.data.time
        PREPARED -> 2
        QUESTION -> frame.data.cooldown
        else -> null
    }
    return copy(
        frame = frame,
        clock = GameClock.start(seconds, now),
        revision = revision + 1,
        answerCount = if (frame.name == ANSWER) 0 else answerCount,
        awaitingAnswer = false,
        points = frame.data.myPoints ?: points,
        wallpaper = frame.wallpaper ?: wallpaper,
        audio = frame.audio ?: audio,
        room = room.copy(
            code = frame.data.inviteCode ?: room.code,
            subject = frame.data.subject ?: room.subject,
        ),
    )
}

internal fun LiveGame.withSnapshot(snapshot: Rejoin, now: Long): LiveGame {
    // The server can return its lobby status during the opening animation. If
    // this client has already seen the start, keep that phase until the next event.
    val nextFrame = if (snapshot.status.name == ROOM && frame?.name == START) frame else snapshot.status
    return withFrame(nextFrame, now).copy(
        room = room.copy(
            code = snapshot.inviteCode ?: snapshot.status.data.inviteCode ?: room.code,
            subject = snapshot.status.data.subject ?: room.subject,
            nickname = snapshot.player?.username ?: room.nickname,
        ),
        number = snapshot.currentQuestion,
        players = snapshot.players,
        connectedCount = snapshot.players.count { it.connected },
        points = snapshot.player?.points ?: snapshot.status.data.myPoints ?: points,
        wallpaper = snapshot.wallpaper,
        audio = snapshot.audio,
        restored = true,
    )
}

internal fun GameClock.withTick(seconds: Int, now: Long): GameClock =
    copy(endsAt = now + seconds.coerceAtLeast(0) * 1000L, duration = maxOf(duration, seconds))

internal fun LiveGame.answerPayload(selection: List<Int>, single: Boolean): kotlinx.serialization.json.JsonObject? {
    val current = frame?.takeIf { it.name == ANSWER } ?: return null
    if (room.host || !restored || awaitingAnswer || selection.isEmpty() ||
        selection.any { it !in current.data.answers.indices } || selection.toSet().size != selection.size
    ) return null
    if (current.data.type == "puzzle" && selection.size != current.data.answers.size) return null
    if (single && selection.size != 1) return null
    val answer = if (single) kotlinx.serialization.json.JsonPrimitive(selection.first())
    else kotlinx.serialization.json.JsonArray(selection.map { kotlinx.serialization.json.JsonPrimitive(it) })
    return jsonFields(
        "gameId" to kotlinx.serialization.json.JsonPrimitive(room.gameId),
        "data" to jsonFields("answerKey" to answer),
    )
}
