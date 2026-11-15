package com.gohoot.android

import android.content.Intent
import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.preferredFrameRate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonPrimitive

@Composable
internal fun LiveScreen(model: GameModel, game: LiveGame, showReport: (GameResult) -> Unit) {
    val isHost = game.room.host
    val frame = game.frame
    var leave by rememberSaveable { mutableStateOf(false) }
    var end by rememberSaveable { mutableStateOf(false) }
    var showOptions by rememberSaveable { mutableStateOf(false) }
    var startFromDialog by rememberSaveable { mutableStateOf(false) }
    var showQr by rememberSaveable { mutableStateOf(false) }
    var showPlayers by rememberSaveable { mutableStateOf(false) }
    var showMedia by rememberSaveable { mutableStateOf(false) }
    var showJump by rememberSaveable { mutableStateOf(false) }
    var quizSettings by rememberSaveable { mutableStateOf(false) }
    var kick by remember { mutableStateOf<Player?>(null) }
    var menu by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val code = game.room.code.ifBlank { frame?.data?.inviteCode.orEmpty() }
    val invite = remember(model.server, code) {
        model.server?.origin?.newBuilder()?.addQueryParameter("pin", code)?.build()?.toString().orEmpty()
    }
    val pending = !model.connected || !game.restored
    val presenter = isHost && model.presenter
    val lobby = isHost && frame?.name == ROOM
    val state = frame?.name
    val back = {
        if (presenter) model.presenter(false)
        else if (state == FINISHED) model.leave()
        else leave = true
    }
    BackHandler(onBack = back)

    Box(Modifier.fillMaxSize()) {
        GameWallpaper(model, game.wallpaper)
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                if (isHost) {
                    GoHootBar(game.room.subject.ifBlank { "Live game" }, back, actions = {
                        Box {
                            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Host options") }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                DropdownMenuItem(
                                    text = { Text(if (presenter) "Exit presenter view" else "Presenter view") },
                                    onClick = { menu = false; model.presenter(!presenter) },
                                )
                                if (code.isNotEmpty()) DropdownMenuItem(
                                    text = { Text("Show join QR code") },
                                    onClick = { menu = false; showQr = true },
                                )
                                DropdownMenuItem(
                                    text = { Text("Audio settings") },
                                    onClick = { menu = false; quizSettings = true },
                                )
                                if (state != FINISHED) DropdownMenuItem(
                                    text = { Text("Game media") },
                                    onClick = { menu = false; showMedia = true }, enabled = !pending,
                                )
                                if (state in listOf(RESPONSES, LEADERBOARD, SLIDE) && game.number.current > 1) {
                                    DropdownMenuItem(text = { Text("Previous question") }, enabled = !pending,
                                        onClick = {
                                            menu = false
                                            model.hostCommand("goToQuestion",
                                                jsonFields("index" to JsonPrimitive(game.number.current - 2)))
                                        })
                                }
                                if (frame?.data?.previousQuestions?.isNotEmpty() == true) DropdownMenuItem(
                                    text = { Text("Go to question") }, enabled = !pending,
                                    onClick = { menu = false; showJump = true },
                                )
                                if (state != FINISHED && !lobby) DropdownMenuItem(
                                    text = { Text("End game") }, enabled = !pending,
                                    onClick = { menu = false; end = true },
                                )
                                DropdownMenuItem(text = { Text(if (state == FINISHED) "Close game" else "Leave game") },
                                    onClick = { menu = false; leave = state != FINISHED; if (!leave) model.leave() })
                            }
                        }
                    })
                }
            },
            bottomBar = {
                if (isHost && !pending) HostActions(
                    model, game, onOptions = { start -> startFromDialog = start; showOptions = true }, onReport = showReport,
                )
            },
        ) { insets ->
            Column(Modifier.fillMaxSize().padding(insets)) {
                if (pending && frame != null) {
                    Surface(color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.fillMaxWidth()) {
                        Text("Reconnecting to the game…", Modifier.padding(12.dp), textAlign = TextAlign.Center)
                    }
                }
                if (frame == null) {
                    LoadingPane(if (model.connected) "Opening room" else "Reconnecting to the game")
                } else if (lobby) {
                    HostLobby(game, code, invite, presenter, onQr = { showQr = true }, onPlayers = { showPlayers = true },
                        onShare = {
                            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, invite)
                            context.startActivity(Intent.createChooser(send, "Share GoHoot invite"))
                        })
                } else {
                    AnimatedContent(
                        targetState = frame.name,
                        modifier = Modifier.weight(1f),
                        transitionSpec = { fadeIn(tween(165)) togetherWith fadeOut(tween(95)) },
                        label = "Round phase",
                    ) { phase ->
                        val phaseFrame = frame.takeIf { it.name == phase }
                        if (phaseFrame != null) RoundScreen(model, game, phaseFrame, pending, presenter, back) {
                            quizSettings = true
                        }
                    }
                }
            }
        }
    }

    val backgroundMusic = !pending && (state == ROOM || state == WAIT && !isHost && game.number.current == 0 ||
        state == ANSWER && frame.data.media?.type !in listOf("audio", "video"))
    QuizMusic(model, game.audio, backgroundMusic)
    if (quizSettings) QuizSettingsDialog(model) { quizSettings = false }
    if (leave) Confirm("Leave game?", if (isHost && lobby) "The waiting room will close for everyone."
        else "You can rejoin a game that is still running.", "Leave", { leave = false }) {
        leave = false
        model.leave()
    }
    if (end) Confirm("End the game?", "GoHoot will show the final scores for rounds played so far.",
        "End game", { end = false }) {
        end = false
        model.hostCommand("endGame")
    }
    if (showOptions && lobby) GameOptionsDialog(
        initialMode = model.gameMode, initial = model.gameOptions, starting = startFromDialog,
        canStart = game.connectedCount > 0 && !pending,
        close = { showOptions = false },
        apply = { mode, options ->
            showOptions = false
            if (startFromDialog) model.startGame(mode, options) else model.setGameOptions(mode, options)
        },
    )
    if (showQr && invite.isNotEmpty()) {
        AlertDialog(onDismissRequest = { showQr = false }, title = { Text("Join by QR code") },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    InviteQr(invite, Modifier.size(230.dp))
                    CountPill(formattedCode(code))
                    Text(invite.substringBefore("?").trimEnd('/'), textAlign = TextAlign.Center)
                }
            },
            confirmButton = { TextButton(onClick = { showQr = false }) { Text("Done") } })
    }
    if (showPlayers && lobby) {
        AlertDialog(onDismissRequest = { showPlayers = false }, title = { Text("Players") },
            text = {
                if (game.players.isEmpty()) Supporting("Waiting for players")
                else LazyColumn(Modifier.heightIn(max = 360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(game.players, key = { i, player -> player.clientId ?: i }) { index, player ->
                        Participant(player, index, if (player.id == null || pending) null else { { kick = player } })
                    }
                }
            }, confirmButton = { TextButton(onClick = { showPlayers = false }) { Text("Done") } })
    }
    kick?.let { player ->
        Confirm("Remove " + player.username + "?", "They will be removed from this room.", "Remove",
            { kick = null }) {
            kick = null
            player.id?.let { model.hostCommand("kickPlayer", fields("playerId" to it)) }
        }
    }
    if (showMedia && isHost && state != FINISHED) MediaSettingsDialog(
        "Game media", model, game.wallpaper.orEmpty(), game.audio.orEmpty(), { showMedia = false },
    ) { wallpaper, audio -> model.updateRoomMedia(wallpaper, audio) { showMedia = false } }
    if (showJump && frame != null) {
        AlertDialog(onDismissRequest = { showJump = false }, title = { Text("Go to question") },
            text = {
                LazyColumn(Modifier.heightIn(max = 360.dp)) {
                    itemsIndexed(frame.data.previousQuestions, key = { _, q -> q.index }) { _, item ->
                        TextButton(onClick = {
                            showJump = false
                            model.hostCommand("goToQuestion", jsonFields("index" to JsonPrimitive(item.index)))
                        }) { Text((item.index + 1).toString() + ". " + item.question) }
                    }
                }
            }, confirmButton = { TextButton(onClick = { showJump = false }) { Text("Close") } })
    }
}

@Composable
private fun GameWallpaper(model: GameModel, url: String?) {
    val server = model.server ?: return
    val image = server.mediaUrl(url) ?: return
    AsyncImage(model = image.toString(), imageLoader = model.media.imageLoader(server),
        contentDescription = null, contentScale = androidx.compose.ui.layout.ContentScale.Crop,
        alpha = .16f, modifier = Modifier.fillMaxSize())
}

@Composable
private fun HostLobby(
    game: LiveGame,
    code: String,
    invite: String,
    presenter: Boolean,
    onQr: () -> Unit,
    onPlayers: () -> Unit,
    onShare: () -> Unit,
) {
    val landscape = landscapeWindow()
    PageColumn(maxWidth = if (presenter || landscape) 1100 else 660) {
        if (presenter || landscape) {
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    LobbyCode(code, onShare, invite.isNotEmpty())
                    if (invite.isNotEmpty()) Secondary("Enlarge QR code", onQr)
                }
                if (invite.isNotEmpty()) InviteQr(invite, Modifier.size(152.dp))
                Column(Modifier.weight(1f)) { PlayersPreview(game, onPlayers) }
            }
        } else {
            LobbyCode(code, onShare, invite.isNotEmpty())
            PlayersPreview(game, onPlayers)
            if (invite.isNotEmpty()) TextButton(onClick = onQr, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Show join QR code")
            }
        }
    }
}

@Composable
private fun LobbyCode(code: String, share: () -> Unit, enabled: Boolean) {
    Surface(Modifier.fillMaxWidth(), shape = panelShape, color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Room code", style = MaterialTheme.typography.titleMedium)
                Text(formattedCode(code), Modifier.testTag("host_room_code"),
                    style = MaterialTheme.typography.displayMedium)
            }
            if (enabled) Surface(shape = pill, color = MaterialTheme.colorScheme.surface.copy(alpha = .72f)) {
                IconButton(onClick = share) { Icon(Icons.Filled.Share, "Share invite") }
            }
        }
    }
}

internal fun formattedCode(value: String) = if (value.length == 6) value.take(3) + " " + value.drop(3) else value

@Composable
private fun PlayersPreview(game: LiveGame, onPlayers: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Players", Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall)
            CountPill(game.connectedCount.toString(), Modifier.testTag("host_player_count"))
        }
        if (game.players.isEmpty()) Supporting("Waiting for players")
        else {
            game.players.take(3).forEachIndexed { index, player -> Participant(player, index, null) }
            TextButton(onClick = onPlayers, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("View all players")
            }
        }
    }
}

@Composable
private fun Participant(player: Player, index: Int, remove: (() -> Unit)?) {
    Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surfaceContainer, shape = tileShape) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Avatar(player.username, index)
            Column(Modifier.weight(1f)) {
                Text(player.username, style = MaterialTheme.typography.titleMedium)
                if (!player.connected) Supporting("Disconnected")
            }
            if (remove != null) IconButton(onClick = remove) {
                Icon(Icons.Filled.Close, "Remove " + player.username)
            }
        }
    }
}

@Composable
private fun HostActions(model: GameModel, game: LiveGame, onOptions: (Boolean) -> Unit, onReport: (GameResult) -> Unit) {
    val frame = game.frame ?: return
    val wide = landscapeWindow()
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (frame.name == ROOM) {
                if (wide) {
                    Row(Modifier.widthIn(max = 650.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Secondary("Game settings", { onOptions(false) }, Modifier.weight(1f))
                        Primary("Start game", { onOptions(true) }, Modifier.weight(1f).testTag("host_start"))
                    }
                } else {
                    Secondary("Game settings", { onOptions(false) }, Modifier.fillMaxWidth().widthIn(max = 560.dp))
                    Spacer(Modifier.height(6.dp))
                    Primary("Start game", { onOptions(true) }, Modifier.fillMaxWidth().widthIn(max = 560.dp).testTag("host_start"))
                }
            } else {
                val action = when (frame.name) {
                    ANSWER -> "End question" to "abortQuiz"
                    RESPONSES -> if (game.number.current == game.number.total) "Show podium" to "showLeaderboard"
                        else "Show leaderboard" to "showLeaderboard"
                    LEADERBOARD, SLIDE -> if (game.number.current == game.number.total) "Show podium" to "nextQuestion"
                        else "Next question" to "nextQuestion"
                    else -> null
                }
                if (action != null) Primary(action.first, { model.hostCommand(action.second) },
                    Modifier.widthIn(max = 560.dp).fillMaxWidth().testTag("host_round_action"))
                if (frame.name == FINISHED) frame.data.result?.let { result ->
                    Primary("View report", { onReport(result) }, Modifier.widthIn(max = 560.dp).fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun GameOptionsDialog(
    initialMode: String, initial: GameOptions, starting: Boolean, canStart: Boolean,
    close: () -> Unit, apply: (String, GameOptions) -> Unit,
) {
    var mode by rememberSaveable { mutableStateOf(initialMode) }
    var shuffleQuestions by rememberSaveable { mutableStateOf(initial.shuffleQuestions) }
    var shuffleAnswers by rememberSaveable { mutableStateOf(initial.shuffleAnswers) }
    var doubleTime by rememberSaveable { mutableStateOf(initial.doubleTime) }
    var hideText by rememberSaveable { mutableStateOf(initial.hideTextOnClient) }
    AlertDialog(onDismissRequest = close, title = { Text("Game settings") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(mode == "classic", { mode = "classic" }, { Text("Classic") })
                    FilterChip(mode == "accuracy", { mode = "accuracy" }, { Text("Accuracy") })
                }
                Supporting(if (mode == "classic") "Correct answers score more when submitted quickly."
                    else "All correct answers receive the same base points.")
                SettingSwitch("Shuffle questions", shuffleQuestions) { shuffleQuestions = it }
                SettingSwitch("Shuffle answers", shuffleAnswers) { shuffleAnswers = it }
                SettingSwitch("Double answer time", doubleTime) { doubleTime = it }
                SettingSwitch("Hide text on player devices", hideText) { hideText = it }
                if (starting && !canStart) Supporting("Waiting for a player to connect")
            }
        },
        dismissButton = { TextButton(onClick = close) { Text("Cancel") } },
        confirmButton = {
            TextButton(enabled = !starting || canStart, modifier = Modifier.testTag("confirm_start"), onClick = {
                apply(mode, GameOptions(shuffleQuestions, doubleTime, shuffleAnswers, hideText))
            }) { Text(if (starting) "Start game" else "Save settings") }
        },
    )
}

@Composable
private fun RoundScreen(
    model: GameModel,
    game: LiveGame,
    frame: GameFrame,
    pending: Boolean,
    presenter: Boolean,
    leave: () -> Unit,
    settings: () -> Unit,
) {
    val data = frame.data
    val isHost = game.room.host
    val hide = data.hideTextOnClient && !isHost
    val wide = landscapeWindow()
    val horizontal = wide && isHost
    val header: @Composable () -> Unit = {
        if (game.number.current > 0 || game.clock.duration > 0 || !isHost) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                if (!isHost) IconButton(onClick = leave) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Leave game") }
                if (game.number.current > 0) {
                    val progress = if (game.number.total > 0) "Question " + game.number.current + " of " + game.number.total
                        else "Question " + game.number.current
                    Text(progress, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                } else Spacer(Modifier.weight(1f))
                if (game.clock.duration > 0 && frame.name in listOf(START, QUESTION, ANSWER)) {
                    TimerRing(game.clock, compact = wide || windowWidth() < 390.dp)
                }
                if (!isHost && frame.name != FINISHED) QuizSettingsButton(settings)
            }
        }
    }
    if (frame.name == ANSWER && !isHost) {
        val puzzle = data.type == "puzzle"
        AnswerStage(
            type = data.type,
            multiple = data.multiSelect ?: false,
            header = header,
            prompt = { available ->
                if (hide) Heading("Look at the host’s screen")
                else StagePrompt(model, data.question.orEmpty(), data.media, available)
            },
            controls = { budget ->
                androidx.compose.runtime.key(game.revision) {
                    InteractiveAnswers(data.answers, data.type ?: "quiz", data.multiSelect == true,
                        hide && !puzzle, haptics = model.haptics, enabled = !pending && !game.awaitingAnswer,
                        maxHeight = budget, onSubmit = model::submit)
                }
            },
        )
        return
    }
    if (frame.name == RESULT && !isHost) {
        Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 8.dp)) {
            header()
            PageColumn(Modifier.weight(1f)) { ResultBeat(data) }
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                ScoreFooter(data.myPoints ?: game.points, data.streak, Modifier.widthIn(max = 650.dp))
            }
        }
        return
    }
    val content: @Composable ColumnScope.() -> Unit = {
        header()
        when (frame.name) {
            WAIT -> RoundWait(messageText(data.text ?: "game:waitingForPlayers"), game.room.nickname, game.points)
            START -> RoundWait(data.subject ?: "Get ready", "The quiz is starting", 0)
            PREPARED -> {
                Column(Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Heading("Get ready")
                    QuestionModeBadge(data.type, data.multiSelect, animated = true)
                }
            }
            QUESTION -> {
                QuestionModeBadge(data.type, data.multiSelect)
                if (data.doublePoints) CountPill("Double points")
                Prompt(model, data, hide, presenter)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat((data.answersCount ?: 0).coerceIn(0, 7)) { index ->
                        Surface(Modifier.size(38.dp), shape = pill, color = answerColors[index],
                            contentColor = Color.White) {
                            Box(contentAlignment = Alignment.Center) { OptionGlyph(index, diameter = 19.dp) }
                        }
                    }
                }
            }
            ANSWER -> {
                QuestionModeBadge(data.type, data.multiSelect ?: false)
                val answerContent: @Composable () -> Unit = {
                    ReadOnlyAnswers(data.answers, data.type)
                    Spacer(Modifier.height(8.dp))
                    Supporting(game.answerCount.toString() + " of " + game.connectedCount + " answered")
                }
                if (horizontal) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Prompt(model, data, hide, presenter, compact = true)
                    }
                    Column(Modifier.weight(1f)) { answerContent() }
                } else {
                    Prompt(model, data, hide, presenter, compact = wide)
                    answerContent()
                }
            }
            RESULT -> ResultBeat(data)
            RESPONSES -> {
                Heading(data.question.orEmpty())
                if (horizontal && data.media != null) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    QuestionMedia(model, data.media, Modifier.weight(1f).heightIn(max = 210.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(9.dp)) { ResponseRows(data) }
                } else {
                    QuestionMedia(model, data.media, Modifier.fillMaxWidth().heightIn(max = 220.dp))
                    ResponseRows(data)
                }
            }
            LEADERBOARD -> {
                Heading("Leaderboard")
                ScoreRows(data.leaderboard, data.oldLeaderboard, dense = game.room.mode == "accuracy")
            }
            SLIDE -> {
                QuestionModeBadge("slide", null)
                if (horizontal && data.media != null) Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Heading(data.question.orEmpty())
                        Text(data.text.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                    }
                    QuestionMedia(model, data.media, Modifier.weight(1f).heightIn(max = 210.dp))
                } else {
                    Prompt(model, data, hide = false, presenter = presenter)
                    Text(data.text.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                }
            }
            FINISHED -> {
                CountPill("Final results")
                Heading(data.subject ?: "Game complete")
                data.rank?.let { Text("Rank " + it + " · " + game.points + " points", style = MaterialTheme.typography.titleLarge) }
                if (data.top.isNotEmpty()) {
                    Text("Podium", style = MaterialTheme.typography.headlineSmall)
                    if (isHost) HostPodium(model, data.top, game.room.gameId) else PodiumCards(data.top)
                }
                if (!isHost) Primary("Done", leave, Modifier.fillMaxWidth())
            }
            else -> Supporting("Waiting for GoHoot")
        }
    }
    PageColumn(maxWidth = if (presenter || horizontal) 1160 else 650, content = content)
}

@Composable
private fun Prompt(model: GameModel, data: FrameData, hide: Boolean, presenter: Boolean, compact: Boolean = false) {
    if (hide) {
        Text("Look at the host’s screen", style = MaterialTheme.typography.headlineSmall)
        return
    }
    Text(data.question.orEmpty(), style = if (presenter) MaterialTheme.typography.headlineLarge
        else MaterialTheme.typography.headlineMedium)
    if (data.media != null) {
        QuestionMedia(model, data.media, Modifier.fillMaxWidth().heightIn(max = if (compact) 160.dp else 246.dp))
    }
}

@Composable
private fun RoundWait(title: String, detail: String, points: Int) {
    Spacer(Modifier.height(24.dp))
    Heading(title)
    if (detail.isNotBlank()) Supporting(detail)
    if (points != 0) CountPill(points.toString() + " points")
}

@Composable
private fun ResultBeat(data: FrameData) {
    Spacer(Modifier.height(18.dp))
    CountPill(if (data.correct == true) "Correct" else "Round result")
    Heading(messageText(data.message ?: if (data.correct == true) "game:correct" else "game:wrong"))
    Text("+" + (data.points ?: 0) + " points", style = MaterialTheme.typography.displayMedium)
    data.rank?.let { Supporting("Rank " + it) }
    data.aheadOfMe?.let { Supporting("Ahead of you: " + it) }
}

@Composable
private fun ResponseRows(data: FrameData) {
    val rows = if (data.type == "puzzle") listOf("Correct order", "Other order") else data.answers
    val maximum = data.responses.values.maxOrNull()?.coerceAtLeast(1) ?: 1
    rows.forEachIndexed { index, answer ->
        val count = data.responses[index] ?: 0
        val color = answerColors[(if (data.type == "puzzle") if (index == 0) 2 else 5 else index) % 7]
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (data.type != "puzzle") {
                    Surface(Modifier.padding(end = 8.dp).size(30.dp), shape = pill, color = color,
                        contentColor = Color.White) {
                        Box(contentAlignment = Alignment.Center) { OptionGlyph(index, diameter = 18.dp) }
                    }
                }
                Text(answer, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                if (index in data.solutions) Icon(Icons.Filled.Check, "Correct answer")
                Text(count.toString(), Modifier.padding(start = 12.dp), fontWeight = FontWeight.Bold)
            }
            LinearProgressIndicator(progress = { count.toFloat() / maximum }, modifier = Modifier.fillMaxWidth(),
                color = color)
        }
    }
}

@Composable
internal fun ScoreRows(players: List<Player>, old: List<Player> = emptyList(), dense: Boolean = false) {
    var rank = 0
    var prior: Int? = null
    players.forEachIndexed { index, player ->
        if (prior != player.points) rank++
        prior = player.points
        val previous = old.indexOfFirst { it.username == player.username }
        Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surfaceContainer, shape = tileShape) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CountPill((player.rank ?: if (dense) rank else index + 1).toString())
                Avatar(player.username, index)
                Column(Modifier.weight(1f)) {
                    Text(player.username, style = MaterialTheme.typography.titleMedium)
                    if (previous != -1 && previous != index) Supporting(
                        if (previous > index) "Up " + (previous - index) else "Down " + (index - previous))
                }
                Text(player.points.toString(), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun TimerRing(clock: GameClock, compact: Boolean = false) {
    val tint = MaterialTheme.colorScheme.primary
    val rail = MaterialTheme.colorScheme.primaryContainer
    var number by remember(clock) { mutableIntStateOf(clock.left(SystemClock.elapsedRealtime())) }
    var drawTime by remember(clock) { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(clock) {
        while (number > 0) {
            withFrameNanos {
                val now = SystemClock.elapsedRealtime()
                drawTime = now
                number = clock.left(now)
            }
        }
    }
    val size = if (compact) 50.dp else 72.dp
    Box(Modifier.size(size).semantics { contentDescription = "$number seconds remaining" },
        contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = (if (compact) 5.dp else 7.dp).toPx()
            val r = this.size.minDimension / 2 - stroke
            drawCircle(rail, r, style = Stroke(stroke))
            drawArc(tint, -90f, 360f * clock.fraction(drawTime), false,
                topLeft = Offset(center.x - r, center.y - r), size = Size(r * 2, r * 2),
                style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Text(number.toString(), style = if (compact) MaterialTheme.typography.titleLarge
            else MaterialTheme.typography.headlineMedium)
    }
}


@Composable
private fun PodiumCards(players: List<Player>, revealed: Int = players.size) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val stacked = maxWidth < 290.dp || androidx.compose.ui.platform.LocalDensity.current.fontScale >= 1.55f
        if (stacked) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                players.forEachIndexed { i, player -> PodiumCard(player.takeIf { i >= players.size - revealed }, i, Modifier.fillMaxWidth()) }
            }
        } else {
            val order = if (players.size == 3) listOf(1, 0, 2) else players.indices.toList()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Bottom) {
                order.forEach { i -> PodiumCard(players[i].takeIf { i >= players.size - revealed }, i, Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun PodiumCard(player: Player?, index: Int, modifier: Modifier) {
    val colors = MaterialTheme.colorScheme
    val height = when (index) {
        0 -> 154.dp
        1 -> 130.dp
        else -> 114.dp
    }
    Surface(modifier.heightIn(min = height), shape = panelShape,
        color = if (index == 0) colors.tertiaryContainer else colors.surfaceContainerHigh,
        contentColor = if (index == 0) colors.onTertiaryContainer else colors.onSurface) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically)) {
            Text((index + 1).toString(), style = MaterialTheme.typography.headlineMedium)
            if (player != null) {
                Text(player.username, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                Text(player.points.toString() + " pts", style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}


@Composable
private fun HostPodium(model: GameModel, players: List<Player>, gameId: String) {
    var revealed by rememberSaveable(gameId) { mutableIntStateOf(if (players.size < 3) players.size else 0) }
    val animations = android.animation.ValueAnimator.areAnimatorsEnabled()
    LaunchedEffect(gameId, animations) {
        if (players.size == 3 && animations && revealed < 3) {
            while (revealed < 3) {
                delay(450)
                revealed++
                model.playCue(when (revealed) { 1 -> "three"; 2 -> "second"; else -> "first" }, .65f)
            }
        } else if (revealed == players.size && players.isNotEmpty() && players.size < 3) {
            model.playCue("first", .65f)
        }
    }
    PodiumCards(players, if (animations) revealed else players.size)
}
