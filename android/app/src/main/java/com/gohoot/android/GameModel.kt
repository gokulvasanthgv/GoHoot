package com.gohoot.android

import android.app.Application
import android.content.ContentResolver
import android.net.Uri
import android.os.SystemClock
import android.provider.OpenableColumns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.intOrNull

internal class GameModel(application: Application) : AndroidViewModel(application) {
    private val storage = LocalStore(application)
    val media = MediaEngine(application)

    var server by mutableStateOf<Server?>(null)
        private set
    private var session: Session? = null
    private val sessionLock = Mutex()

    var user by mutableStateOf<User?>(null)
        private set
    var live by mutableStateOf<LiveGame?>(null)
        private set
    var solo by mutableStateOf<SoloGame?>(null)
        private set
    var config by mutableStateOf<Configuration?>(null)
        private set
    var history by mutableStateOf<List<Attendance>?>(null)
        private set
    var report by mutableStateOf<GameResult?>(null)
        private set
    var selectedHistory by mutableStateOf<Attendance?>(null)
        private set
    var editor by mutableStateOf<Quiz?>(null)
        private set
    var pendingInvite by mutableStateOf<Invite?>(null)
        private set
    var connected by mutableStateOf(false)
        private set
    var initializing by mutableStateOf(true)
        private set
    var busy by mutableStateOf(false)
        private set
    var loadError by mutableStateOf<String?>(null)
        private set
    var nickname by mutableStateOf(storage.nickname)
        private set
    var theme by mutableStateOf(storage.theme)
        private set
    var dynamic by mutableStateOf(storage.dynamic)
        private set
    var sound by mutableStateOf(storage.sound)
        private set
    var music by mutableStateOf(storage.music)
        private set
    private var playerSound by mutableStateOf(false)
    private var playerMusic by mutableStateOf(false)
    private val isPlaying get() = live?.room?.host == false || solo != null
    val playbackSound get() = if (isPlaying) playerSound else sound
    val playbackMusic get() = if (isPlaying) playerMusic else music
    var haptics by mutableStateOf(storage.haptics)
        private set
    var volume by mutableStateOf(storage.volume)
        private set
    var presenter by mutableStateOf(false)
        private set
    var gameOptions by mutableStateOf(GameOptions())
        private set
    var gameMode by mutableStateOf("classic")
        private set

    private val messages = Channel<String>(Channel.BUFFERED)
    val notices = messages.receiveAsFlow()
    private var wire: LiveSocket? = null
    private var generation = 0
    private var retry: Job? = null
    private var retryDelay = 1000L
    private var recheckingAuth = false
    private var foreground = false
    private var awaitingJoin: RoomRef? = null
    private var joinTimeout: Job? = null
    private var pendingCommand: String? = null
    private var commandTimeout: Job? = null
    private var reconnectTimeout: Job? = null

    init {
        viewModelScope.launch {
            val saved = withContext(Dispatchers.IO) {
                storage.origin?.let { address ->
                    runCatching { parseOrigin(address) }.getOrNull()?.let { origin ->
                        val savedSession = storage.readSession(origin.toString())
                        val room = savedSession?.let { identity ->
                            storage.readRoom(origin.toString(), identity.clientId)?.takeIf { it.canRestore(identity) }
                        }
                        Triple(Server(origin), savedSession, room)
                    }
                }
            }
            if (saved != null) {
                server = saved.first
                session = saved.second
                user = saved.second?.user
                live = saved.third?.let(::LiveGame)
                gameMode = saved.third?.mode ?: "classic"
            }
            initializing = false
            if (foreground) connect()
        }
    }

    fun foreground(visible: Boolean) {
        foreground = visible
        if (visible) connect()
        else media.pause()
    }

    fun theme(value: String) { storage.theme = value; theme = value }
    fun dynamic(value: Boolean) { storage.dynamic = value; dynamic = value }
    fun sound(value: Boolean) { storage.sound = value; sound = value; if (!value) media.stopCues() }
    fun music(value: Boolean) { storage.music = value; music = value }
    fun setPlaybackSound(value: Boolean) {
        if (isPlaying) {
            playerSound = value
            if (!value) media.stopCues()
        } else sound(value)
    }

    fun setPlaybackMusic(value: Boolean) {
        if (isPlaying) playerMusic = value else music(value)
    }

    private fun resetPlayerAudio() {
        playerMusic = false
        playerSound = false
        media.stopCues()
    }

    fun haptics(value: Boolean) { storage.haptics = value; haptics = value }
    fun volume(value: Float) { storage.volume = value; volume = value }
    fun presenter(value: Boolean) { presenter = value }
    fun playCue(name: String, gain: Float = 1f) { if (foreground && playbackSound) media.cue(name, volume * gain) }
    fun notice(value: String) { messages.trySend(messageText(value)) }

    fun receiveInvite(text: String) {
        pendingInvite = parseInvite(text)
        if (pendingInvite == null) notice("Use a six-digit room code or a GoHoot invite link.")
    }

    fun consumeInvite() { pendingInvite = null }

    fun saveServer(input: String, done: () -> Unit) = task {
        val candidate = Server(parseOrigin(input))
        candidate.health()
        if (candidate.originText != server?.originText) {
            val newSession = mint(candidate, null)
            retry?.cancel()
            closeWire()
            withContext(Dispatchers.IO) {
                storage.switchOrigin(candidate.originText)
                storage.writeSession(candidate.originText, newSession)
            }
            server = candidate
            session = newSession
            user = newSession.user
            nickname = ""
            clearRoom()
            clearAccountData()
            retryDelay = 1000
            connect()
        }
        done()
    }

    fun login(username: String, password: String, signup: Boolean, done: () -> Unit) = task {
        val name = username.trim()
        if (name.isBlank() || password.isEmpty()) throw ApiFailure("Enter your username and password.")
        if (signup && password.length < 8) throw ApiFailure("Use at least 8 characters for the password.")
        val next = signed<Session>(
            "auth/" + if (signup) "signup" else "signin", "POST",
            fields("username" to name, "password" to password),
        )
        applyAccount(next)
        done()
    }

    fun forgotPassword(username: String, done: () -> Unit) = task {
        if (username.isBlank()) throw ApiFailure("Enter your username.")
        signed<JsonObject>("auth/forgot-password", "POST", fields("username" to username.trim()))
        notice("Password reset requested.")
        done()
    }

    fun changePassword(current: String, next: String, done: () -> Unit) = task {
        if (current.isEmpty() || next.length < 8) {
            throw ApiFailure("Enter your current password and a new password of at least 8 characters.")
        }
        val updated = signed<Session>(
            "auth/password", "POST", fields("currentPassword" to current, "newPassword" to next),
        )
        applyAccount(updated)
        notice("Password changed.")
        done()
    }

    fun logout(done: () -> Unit) = task {
        val next = signed<Session>("auth/logout", "POST")
        applyAccount(next)
        clearRoom()
        done()
    }

    private suspend fun applyAccount(next: Session) {
        val selected = requireServer()
        sessionLock.withLock {
            persist(selected, next)
            if (session?.user?.id != next.user?.id) {
                clearRoom()
                clearAccountData()
            }
            session = next
            user = next.user
        }
        retry?.cancel()
        closeWire()
        connect()
    }

    fun join(input: String, displayName: String) = task {
        if (awaitingJoin != null || live != null) return@task
        val invite = parseInvite(input) ?: throw ApiFailure("Enter the six-digit room code or a GoHoot invite link.")
        val selected = requireServer()
        if (invite.origin != null && invite.origin != selected.originText) {
            throw ApiFailure("This invite is for another server. Set its address in Settings first.")
        }
        val name = displayName.trim()
        if (name.length !in 1..20 || name.any { it.code < 32 || it.code == 127 }) {
            throw ApiFailure("Enter a nickname with 1 to 20 characters.")
        }
        if (!connected) throw ApiFailure("Connecting to GoHoot. Try again in a moment.")
        val answer = signed<JoinTicket>(
            "games/join", "POST", fields("inviteCode" to invite.pin, "username" to name),
        )
        val identity = currentSession(selected)
        nickname = answer.username
        storage.nickname = nickname
        val room = RoomRef(selected.originText, identity.clientId, answer.gameId, false,
            code = invite.pin, nickname = answer.username, accountId = identity.user?.id)
        val ticket = answer.ticket
        if (ticket == null) {
            enterRoom(room)
            requestRoomSnapshot()
        } else {
            awaitingJoin = room
            if (wire?.send("player:login", fields("ticket" to ticket)) != true) {
                awaitingJoin = null
                throw ApiFailure("Connection lost. Join the game again.")
            }
            joinTimeout?.cancel()
            joinTimeout = viewModelScope.launch {
                delay(7000)
                if (awaitingJoin == room) {
                    awaitingJoin = null
                    notice("GoHoot did not confirm the join. Try joining again.")
                }
            }
        }
    }

    fun createGame(quiz: QuizSummary) = task {
        if (live != null || quiz.incompatible) return@task
        val selected = requireServer()
        val created = signed<GameCreated>("games", "POST", fields("quizzId" to quiz.id))
        val identity = currentSession(selected)
        val room = RoomRef(selected.originText, identity.clientId, created.gameId, true,
            subject = quiz.subject, code = created.inviteCode, accountId = identity.user?.id)
        enterRoom(room)
        live = live?.copy(wallpaper = created.wallpaper, audio = created.audio)
        requestRoomSnapshot()
    }

    private fun enterRoom(room: RoomRef) {
        if (!room.host) resetPlayerAudio()
        live = LiveGame(room)
        storage.writeRoom(room)
    }

    fun leave() {
        val active = live ?: return
        if (active.restored) {
            wire?.send(if (active.room.host) "manager:leave" else "player:leave",
                fields("gameId" to active.room.gameId))
        }
        clearRoom()
    }

    fun submit(selection: List<Int>, single: Boolean) {
        val active = live ?: return
        if (!connected || active.clock.left(SystemClock.elapsedRealtime()) <= 0) return
        val body = active.answerPayload(selection, single) ?: return
        if (wire?.send("player:selectedAnswer", body) == true) {
            live = active.copy(awaitingAnswer = true)
            cue("answersSound")
        }
    }

    fun setGameOptions(mode: String, options: GameOptions) {
        gameMode = mode
        gameOptions = options
    }

    fun startGame(mode: String, options: GameOptions) {
        val active = live ?: return
        if (!active.room.host || !active.restored || !connected || active.frame?.name != ROOM) return
        setGameOptions(mode, options)
        val room = active.room.copy(mode = mode)
        live = active.copy(room = room)
        storage.writeRoom(room)
        val extra = jsonFields(
            "mode" to JsonPrimitive(mode),
            "options" to wireJson.encodeToJsonElement(GameOptions.serializer(), options),
        )
        hostCommand("startGame", extra)
    }

    fun hostCommand(command: String, extra: JsonObject = JsonObject(emptyMap())) {
        val active = live ?: return
        if (!active.room.host || !active.restored || !connected ||
            (pendingCommand != null && command != "kickPlayer")
        ) return
        val body = JsonObject(extra + ("gameId" to JsonPrimitive(active.room.gameId)))
        if (wire?.send("manager:" + command, body) == true && command != "kickPlayer") {
            pendingCommand = command
            commandTimeout?.cancel()
            commandTimeout = viewModelScope.launch {
                delay(4000)
                if (pendingCommand == command) {
                    pendingCommand = null
                    notice("GoHoot has not confirmed the action.")
                }
            }
        }
    }

    fun updateRoomMedia(wallpaper: String, audio: String, done: () -> Unit) = task {
        val active = live ?: return@task
        if (!active.room.host || !active.restored) return@task
        signed<JsonObject>("games/" + pathPart(active.room.gameId) + "/settings", "PATCH",
            fields("wallpaper" to wallpaper.trim(), "audio" to audio.trim()))
        done()
    }

    fun refreshHistory() = task(load = true) { history = signed<AttendanceList>("dashboard").attended }

    fun selectHistory(item: Attendance?) { selectedHistory = item }

    fun openSolo(id: String) = task {
        val quiz = signed<Quiz>("solo/" + pathPart(id))
        if (quiz.questions.isEmpty()) throw ApiFailure("This quiz has no questions.")
        resetPlayerAudio()
        solo = SoloGame(quiz)
    }

    fun closeSolo() { resetPlayerAudio(); solo = null }

    fun answerSolo(selection: List<Int>) {
        val game = solo ?: return
        val answered = game.withAnswer(selection)
        if (answered === game) return
        solo = answered
        cue("answersSound")
    }

    fun advanceSolo() {
        val game = solo ?: return
        if (game.question.type != "slide" && !game.answered) return
        if (game.index < game.quiz.questions.lastIndex) solo = game.copy(index = game.index + 1)
        else task {
            val id = game.quiz.id ?: throw ApiFailure("This quiz is unavailable.")
            val answerMap = JsonObject(game.answers.mapKeys { it.key.toString() }.mapValues { (_, value) ->
                if (value == null) JsonNull else kotlinx.serialization.json.JsonArray(value.map(::JsonPrimitive))
            })
            val result = signed<GameResult>("solo/" + pathPart(id) + "/results", "POST",
                jsonFields("answers" to answerMap))
            if (solo === game) solo = game.copy(result = result)
            history = null
            cue("results")
        }
    }

    fun refreshConfig() = task(load = true) { loadConfig() }

    private suspend fun loadConfig() { config = signed<Configuration>("config") }

    fun editQuiz(id: String?, done: () -> Unit) {
        if (id == null) {
            editor = Quiz(questions = listOf(newQuestion("quiz")))
            done()
        } else task {
            editor = signed<Quiz>("quizz/" + pathPart(id))
            done()
        }
    }

    fun changeQuiz(value: Quiz) { editor = value }
    fun closeEditor() { editor = null }

    fun importQuiz(uri: Uri, done: () -> Unit) = task {
        val imported = withContext(Dispatchers.IO) {
            val stream = getApplication<Application>().contentResolver.openInputStream(uri)
                ?: throw ApiFailure("Unable to open this quiz file.")
            stream.use {
                val output = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(8192)
                while (true) {
                    val size = it.read(chunk)
                    if (size < 0) break
                    if (output.size() + size > 2 * 1024 * 1024) {
                        throw ApiFailure("This quiz exceeds GoHoot’s JSON size limit.")
                    }
                    output.write(chunk, 0, size)
                }
                val raw = output.toString("UTF-8").removePrefix("\uFEFF")
                runCatching { importQuizJson(raw) }.getOrElse { throw ApiFailure("This file is not GoHoot quiz JSON.") }
            }
        }
        editor = imported.copy(id = null)
        done()
    }

    fun saveQuiz(done: () -> Unit) = task {
        val draft = editor ?: return@task
        val valid = draft.forSave()
        validateQuiz(valid)?.let { throw ApiFailure(it) }
        val data = wireJson.encodeToJsonElement(Quiz.serializer(), valid)
        val id = draft.id
        if (id == null) signed<JsonObject>("quizz", "POST", data)
        else signed<JsonObject>("quizz/" + pathPart(id), "PATCH", data)
        config = null
        editor = null
        notice("Quiz saved.")
        done()
    }

    fun removeQuiz(id: String) = configMutation("quizz/" + pathPart(id), "DELETE", "Moved to trash.")
    fun restoreQuiz(id: String) = configMutation("trash/" + pathPart(id) + "/restore", "POST", "Quiz restored.")
    fun purgeQuiz(id: String) = configMutation("trash/" + pathPart(id), "DELETE", "Quiz deleted.")
    fun deleteResult(id: String) = configMutation("results/" + pathPart(id), "DELETE", "Report deleted.")
    fun deleteUser(id: String) = configMutation("users/" + pathPart(id), "DELETE", "Account deleted.")
    fun updateRole(id: String, role: String) = configMutation(
        "users/" + pathPart(id) + "/role", "PATCH", "Role updated.", fields("role" to role),
    )
    fun resetPassword(id: String, password: String) = configMutation(
        "users/" + pathPart(id) + "/password", "POST", "Password reset.", fields("newPassword" to password),
    )
    fun dismissReset(id: String) = configMutation(
        "users/notifications/" + pathPart(id), "DELETE", "Request dismissed.",
    )
    fun updateDefaults(wallpaper: String, audio: String, done: () -> Unit) = task {
        signed<JsonObject>("config", "PATCH", fields(
            "defaultWallpaper" to wallpaper.trim(), "defaultAudio" to audio.trim(),
        ))
        notice("Defaults saved.")
        done()
        loadConfig()
    }

    private fun configMutation(path: String, method: String, text: String, body: JsonObject? = null) = task {
        signed<JsonElement>(path, method, body)
        notice(text)
        loadConfig()
    }

    fun openReport(id: String, done: () -> Unit) = task {
        report = signed<GameResult>("results/" + pathPart(id))
        done()
    }

    fun showReport(value: GameResult) { report = value }
    fun closeReport() { report = null }

    fun exportReport(uri: Uri, result: GameResult) = task {
        withContext(Dispatchers.IO) {
            val output = getApplication<Application>().contentResolver.openOutputStream(uri, "wt")
                ?: throw ApiFailure("Could not open the selected destination.")
            output.use { writeWorkbook(result, it) }
        }
        notice("Excel report saved.")
    }

    fun upload(uri: Uri, cropped: Boolean = false, done: (String) -> Unit) = task {
        val resolver = getApplication<Application>().contentResolver
        val selected = requireServer()
        val token = currentSession(selected).token
        val picked = withContext(Dispatchers.IO) { resolver.describe(uri, cropped) }
        try {
            val uploaded = selected.upload(token, resolver, picked)
            if (!uploaded.success || uploaded.url == null) {
                throw ApiFailure(uploaded.error ?: "Upload failed.")
            }
            done(uploaded.url)
            notice("Media uploaded.")
        } finally {
            if (cropped && uri.scheme == "file") withContext(Dispatchers.IO) {
                uri.path?.let { java.io.File(it).delete() }
            }
        }
    }

    fun clearCache() = task { media.clear(); notice("Media cache cleared.") }

    private fun clearRoom() {
        joinTimeout?.cancel()
        awaitingJoin = null
        presenter = false
        resetPlayerAudio()
        gameMode = "classic"
        gameOptions = GameOptions()
        live = null
        storage.writeRoom(null)
        clearCommand()
        reconnectTimeout?.cancel()
        media.stopCues()
    }

    private fun clearAccountData() {
        config = null
        history = null
        editor = null
        report = null
        selectedHistory = null
        solo = null
    }

    private fun requireServer(): Server = server ?: throw ApiFailure("Connect to a GoHoot server first.")

    private suspend inline fun <reified T> signed(
        path: String,
        method: String = "GET",
        data: JsonElement? = null,
    ): T {
        val selected = requireServer()
        val identity = currentSession(selected)
        try {
            return wireJson.decodeFromJsonElement(selected.request(path, identity.token, method, data))
        } catch (failure: ApiFailure) {
            if (failure.status == 401) {
                recoverSession(identity.token)
            }
            throw failure
        }
    }

    private suspend fun mint(selected: Server, old: Session?): Session =
        wireJson.decodeFromJsonElement(
            Session.serializer(), selected.request("auth/session", method = "POST",
                data = jsonFields("token" to old?.token?.let(::JsonPrimitive))),
        )

    private suspend fun persist(selected: Server, next: Session) = withContext(Dispatchers.IO) {
        storage.writeSession(selected.originText, next)
    }

    private suspend fun currentSession(selected: Server, rejected: String? = null): Session =
        sessionLock.withLock {
            if (selected !== server) throw ApiFailure("The server changed. Try again.")
            val old = session
            if (old != null && old.token != rejected && old.expiresAt > System.currentTimeMillis() / 1000) {
                return@withLock old
            }
            val next = mint(selected, old)
            if (selected !== server) throw ApiFailure("The server changed. Try again.")
            persist(selected, next)
            session = next
            user = next.user
            if (live?.room?.canRestore(next) == false) {
                clearRoom()
                notice("Your session changed. Sign in or join again.")
            }
            if (old?.user?.id != next.user?.id) clearAccountData()
            next
        }

    private fun recoverSession(token: String?) {
        val selected = server ?: return
        if (session?.token != token || recheckingAuth) return
        recheckingAuth = true
        closeWire()
        retry?.cancel()
        retry = viewModelScope.launch {
            try {
                val refreshed = currentSession(selected, token)
                if (refreshed.token == token) {
                    delay(retryDelay)
                    retryDelay = (retryDelay * 2).coerceAtMost(12000)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                delay(retryDelay)
            } finally {
                recheckingAuth = false
            }
            retry = null
            connect()
        }
    }

    private fun connect() {
        val selected = server ?: return
        if (!foreground || wire != null || retry?.isActive == true) return
        val attempt = ++generation
        retry = viewModelScope.launch {
            try {
                val current = currentSession(selected)
                if (!foreground || attempt != generation) return@launch
                val socket = LiveSocket(
                    selected, current.token,
                    onConnect = { dispatch(attempt) {
                        connected = true
                        retryDelay = 1000
                        wire?.send("manager:getCurrentUser")
                        requestRoomSnapshot()
                    } },
                    onDisconnect = { rejected -> dispatch(attempt) {
                        closeWire()
                        if (rejected) recoverSession(current.token) else scheduleReconnect()
                    } },
                    onEvent = { name, data -> dispatch(attempt) { handleEvent(name, data) } },
                )
                wire = socket
                socket.start()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                retry = null
                scheduleReconnect()
            }
        }
    }

    private fun dispatch(attempt: Int, block: () -> Unit) {
        viewModelScope.launch {
            if (attempt != generation) return@launch
            try {
                block()
            } catch (_: IllegalArgumentException) {
                notice("GoHoot sent an unreadable update.")
            }
        }
    }

    private fun closeWire() {
        generation++
        wire?.close()
        wire = null
        connected = false
        if (awaitingJoin != null) {
            awaitingJoin = null
            joinTimeout?.cancel()
            notice("Connection lost. Try joining again.")
        }
        live = live?.copy(restored = false, awaitingAnswer = false)
        clearCommand()
        reconnectTimeout?.cancel()
    }

    private fun scheduleReconnect() {
        if (!foreground) return
        retry?.cancel()
        retry = viewModelScope.launch {
            delay(retryDelay)
            retryDelay = (retryDelay * 2).coerceAtMost(12000)
            retry = null
            connect()
        }
    }

    private fun requestRoomSnapshot() {
        val active = live ?: return
        if (wire?.send(if (active.room.host) "manager:reconnect" else "player:reconnect",
                fields("gameId" to active.room.gameId)) != true
        ) return
        reconnectTimeout?.cancel()
        reconnectTimeout = viewModelScope.launch {
            delay(8000)
            if (live?.room?.gameId == active.room.gameId && live?.restored == false) {
                closeWire()
                scheduleReconnect()
            }
        }
    }

    private fun handleEvent(event: String, data: JsonElement) {
        val active = live
        when (event) {
            "manager:currentUser" -> {
                if (data != JsonNull) {
                    val next = wireJson.decodeFromJsonElement(User.serializer(), data)
                    if (user?.id != next.id || user?.role != next.role) clearAccountData()
                    user = next
                } else if (user != null) {
                    recoverSession(session?.token)
                }
            }
            "manager:unauthorized" -> recoverSession(session?.token)
            "manager:notifications" -> config = config?.copy(
                notifications = wireJson.decodeFromJsonElement(data),
            )
            "game:successJoin" -> {
                val pending = awaitingJoin ?: return
                if (pending.gameId != (data as? JsonPrimitive)?.content) return
                awaitingJoin = null
                joinTimeout?.cancel()
                enterRoom(pending)
                requestRoomSnapshot()
            }
            "game:reset" -> {
                clearRoom()
                notice((data as? JsonPrimitive)?.content ?: "This game is no longer available.")
            }
            "game:errorMessage", "manager:errorMessage" -> {
                awaitingJoin = null
                joinTimeout?.cancel()
                clearCommand()
                notice((data as? JsonPrimitive)?.content ?: "GoHoot could not complete the action.")
            }
            "player:successReconnect", "manager:successReconnect" -> {
                if (active == null) return
                val snapshot = wireJson.decodeFromJsonElement(Rejoin.serializer(), data)
                if (snapshot.gameId != active.room.gameId) return
                reconnectTimeout?.cancel()
                val updated = active.withSnapshot(snapshot, SystemClock.elapsedRealtime())
                live = updated
                storage.writeRoom(updated.room)
                prefetch(updated)
            }
            "game:status" -> {
                if (active == null || !active.restored) return
                val frame = wireJson.decodeFromJsonElement(GameFrame.serializer(), data)
                if (frame.gameId != active.room.gameId) return
                val updated = active.withFrame(frame, SystemClock.elapsedRealtime())
                clearCommand()
                live = updated
                prefetch(updated)
                when (frame.name) {
                    START -> cue("boump")
                    QUESTION -> cue("show")
                    RESULT, RESPONSES -> cue("results")
                    FINISHED -> { if (!active.room.host) cue("first"); history = null }
                }
            }
            "game:settings" -> {
                if (active == null) return
                val settings = wireJson.decodeFromJsonElement(GameMedia.serializer(), data)
                if (settings.gameId == active.room.gameId) {
                    val updated = active.copy(wallpaper = settings.wallpaper, audio = settings.audio)
                    live = updated
                    prefetch(updated)
                }
            }
            "game:updateQuestion" -> if (active?.restored == true) live = active.copy(
                number = wireJson.decodeFromJsonElement(QuestionNumber.serializer(), data),
            )
            "game:startCooldown" -> if (active?.frame?.name == START) live = active.copy(
                clock = GameClock.start(3, SystemClock.elapsedRealtime()),
            )
            "game:cooldown" -> if (active?.frame?.name in listOf(START, ANSWER)) {
                (data as? JsonPrimitive)?.intOrNull?.let { seconds ->
                    if (active != null) live = active.copy(clock = active.clock.withTick(seconds, SystemClock.elapsedRealtime()))
                }
            }
            "game:totalPlayers" -> if (active != null) {
                (data as? JsonPrimitive)?.intOrNull?.let { live = active.copy(connectedCount = it) }
            }
            "game:playerAnswer" -> if (active?.room?.host == true) {
                (data as? JsonPrimitive)?.intOrNull?.let { live = active.copy(answerCount = it) }
                cue("answersSound")
            }
            "manager:newPlayer" -> if (active?.room?.host == true) {
                val player = wireJson.decodeFromJsonElement(Player.serializer(), data)
                val existing = active.players.indexOfFirst { it.clientId == player.clientId }
                val players = active.players.toMutableList()
                if (existing < 0) players.add(player) else players[existing] = player
                live = active.copy(players = players)
            }
            "manager:removePlayer", "manager:playerKicked" -> if (active?.room?.host == true) {
                val id = (data as? JsonPrimitive)?.content ?: return
                live = active.copy(players = active.players.filterNot { it.id == id })
            }
        }
    }

    private fun clearCommand() {
        pendingCommand = null
        commandTimeout?.cancel()
    }

    private fun prefetch(active: LiveGame) {
        val selected = server ?: return
        val frame = active.frame
        val allowed = active.room.host || frame?.data?.hideTextOnClient != true
        if (allowed) frame?.data?.media?.let { media.prefetch(selected, it) }
        active.wallpaper?.let { media.prefetch(selected, Media("image", it)) }
        if (playbackMusic) active.audio?.let { media.prefetch(selected, Media("audio", it)) }
    }

    private fun cue(id: String) = playCue(id)

    private fun task(load: Boolean = false, block: suspend () -> Unit) {
        if (busy) return
        busy = true
        if (load) loadError = null
        viewModelScope.launch {
            try {
                block()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                val text = errorText(failure)
                if (load) loadError = text
                notice(text)
            } finally {
                busy = false
            }
        }
    }

    override fun onCleared() {
        wire?.close()
        media.close()
        super.onCleared()
    }
}

@kotlinx.serialization.Serializable
private data class AttendanceList(val attended: List<Attendance> = emptyList())

private fun ContentResolver.describe(uri: Uri, cropped: Boolean): PickedFile {
    if (cropped && uri.scheme == "file") {
        val file = java.io.File(requireNotNull(uri.path))
        return PickedFile(uri, file.name, "image/png", file.length())
    }
    var name = "media"
    var size = -1L
    query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use {
        if (it.moveToFirst()) {
            if (!it.isNull(0)) name = it.getString(0)
            if (!it.isNull(1)) size = it.getLong(1)
        }
    }
    return PickedFile(uri, name, getType(uri) ?: "application/octet-stream", size)
}

private fun errorText(failure: Exception): String = when (failure) {
    is ApiFailure -> messageText(failure.key)
    is UnknownHostException -> failure.message?.takeIf { it.contains("local network") }
        ?: "Could not find the GoHoot server. Check its address and your connection."
    is SSLException -> "Could not verify the server’s HTTPS certificate."
    is IOException -> "Could not reach GoHoot or read the selected file. Check the connection and try again."
    else -> "GoHoot could not complete the action."
}
