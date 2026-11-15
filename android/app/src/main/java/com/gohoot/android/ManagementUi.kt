package com.gohoot.android

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.first
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
internal fun LibraryScreen(model: GameModel, auth: () -> Unit, report: () -> Unit, history: () -> Unit) {
    val user = model.user
    if (user == null) {
        EmptyPane("Your quiz library", "Sign in to see your quiz history and replay eligible quizzes.", "Sign in", auth)
        return
    }
    val items = model.history
    LaunchedEffect(user.id, items == null) {
        if (items == null) {
            snapshotFlow { model.busy }.first { !it }
            model.refreshHistory()
        }
    }
    if (items == null) {
        if (model.loadError == null || model.busy) LoadingPane("Loading quiz history")
        else EmptyPane("Could not load history", model.loadError.orEmpty(), "Try again", model::refreshHistory)
        return
    }
    PageColumn {
        Heading("Quiz history")
        if (items.isEmpty()) Supporting("Quizzes you play while signed in will appear here.")
        items.sortedByDescending { it.date }.forEach { entry ->
            ManagementCard(entry.subject, formatDate(entry.date)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CountPill(entry.points.toString() + " points")
                    CountPill("Rank " + entry.rank + "/" + entry.totalPlayers)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { model.selectHistory(entry); history() }) { Text("Review answers") }
                    TextButton(onClick = { model.openReport(entry.id, report) }, enabled = !model.busy) { Text("Report") }
                    if ((user.canHost || user.role == "quizzer") && entry.quizzId != null) {
                        TextButton(onClick = { model.openSolo(entry.quizzId) }, enabled = !model.busy) { Text("Solo replay") }
                    }
                }
            }
        }
    }
}

@Composable
internal fun HostDashboard(model: GameModel, auth: () -> Unit, editor: () -> Unit, report: () -> Unit) {
    val user = model.user
    if (user == null) {
        EmptyPane("Host a quiz", "Sign in to run games, edit quizzes, and view reports.", "Sign in", auth)
        return
    }
    if (!user.canReport) {
        EmptyPane("Host access required", "A quizmaster, administrator, or analyst account can open this area.")
        return
    }
    val config = model.config
    LaunchedEffect(user.id, config == null) {
        if (config == null) {
            snapshotFlow { model.busy }.first { !it }
            model.refreshConfig()
        }
    }
    if (config == null) {
        if (model.loadError == null || model.busy) LoadingPane("Loading host dashboard")
        else EmptyPane("Could not load dashboard", model.loadError.orEmpty(), "Try again", model::refreshConfig)
        return
    }

    var screen by rememberSaveable(user.id) { mutableStateOf(if (user.canHost) "Games" else "Reports") }
    var filter by rememberSaveable(user.id) { mutableStateOf<String?>(null) }
    var defaults by rememberSaveable { mutableStateOf(false) }
    val sections = when {
        user.admin -> listOf("Games", "Quizzes", "Reports", "Trash", "Users", "Defaults")
        user.canHost -> listOf("Games", "Quizzes", "Reports", "Trash")
        else -> listOf("Reports")
    }
    if (screen !in sections) screen = sections.first()
    val importFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) {
        if (it != null) model.importQuiz(it, editor)
    }

    PageColumn(maxWidth = 760) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            sections.forEach { label ->
                FilterChip(label == screen, { screen = label }, label = { Text(label) })
            }
        }
        when (screen) {
            "Games" -> {
                Heading("Choose a quiz")
                if (config.quizzes.isEmpty()) Supporting("Create or import a quiz to start hosting.")
                config.quizzes.forEach { quiz ->
                    ManagementCard(quiz.subject, if (quiz.incompatible) "Needs repair before playing" else null) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Primary("Create room", { model.createGame(quiz) },
                                modifier = Modifier.testTag("create_room_" + quiz.id),
                                enabled = !quiz.incompatible && !model.busy)
                            if (!quiz.incompatible) TextButton(onClick = { model.openSolo(quiz.id) },
                                enabled = !model.busy) { Text("Solo") }
                        }
                    }
                }
            }
            "Quizzes" -> {
                Heading("Your quizzes")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Primary("Create quiz", { model.editQuiz(null, editor) }, enabled = !model.busy)
                    Secondary("Import JSON", { importFile.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) },
                        enabled = !model.busy)
                }
                if (filter != null) {
                    val name = config.users.firstOrNull { it.id == filter }?.username.orEmpty()
                    FilterChip(true, { filter = null }, { Text("Quizzes by " + name + " · Clear") })
                }
                val quizzes = config.quizzes.filter { filter == null || it.creatorId == filter }
                if (quizzes.isEmpty()) Supporting("No quizzes to show.")
                quizzes.forEach { quiz -> QuizRow(model, quiz, editor) }
            }
            "Reports" -> {
                Heading("Reports")
                if (config.results.isEmpty()) Supporting("Completed games will appear here.")
                config.results.sortedByDescending { it.date }.forEach { item -> ReportRow(model, item, report) }
            }
            "Trash" -> {
                Heading("Trash")
                if (config.trash.isEmpty()) Supporting("Deleted quizzes will appear here.")
                config.trash.forEach { item -> TrashRow(model, item) }
            }
            "Users" -> {
                Heading("Users")
                if (config.notifications.isNotEmpty()) {
                    SectionHeading("Password reset requests")
                    config.notifications.forEach { item -> ResetRow(model, item, config.users) }
                }
                SectionHeading("Accounts")
                config.users.forEach { account -> UserRow(model, account) {
                    filter = account.id
                    screen = "Quizzes"
                } }
            }
            "Defaults" -> {
                Heading("Game defaults")
                ManagementCard("Wallpaper", config.defaultWallpaper?.takeIf(String::isNotBlank) ?: "GoHoot theme")
                ManagementCard("Conductor audio", config.defaultAudio?.takeIf(String::isNotBlank) ?: "GoHoot music")
                Primary("Edit defaults", { defaults = true }, enabled = !model.busy)
            }
        }
    }
    if (defaults) MediaSettingsDialog("Game defaults", model, config.defaultWallpaper.orEmpty(),
        config.defaultAudio.orEmpty(), { defaults = false }) { wallpaper, audio ->
        model.updateDefaults(wallpaper, audio) { defaults = false }
    }
}

@Composable
internal fun ManagementCard(
    title: String,
    subtitle: String? = null,
    actions: @Composable () -> Unit = {},
) {
    Surface(Modifier.fillMaxWidth(), shape = tileShape, color = MaterialTheme.colorScheme.surfaceContainer) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            if (subtitle != null) Supporting(subtitle)
            actions()
        }
    }
}

@Composable
private fun QuizRow(model: GameModel, quiz: QuizSummary, edit: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    ManagementCard(quiz.subject, if (quiz.incompatible) "Needs repair before playing" else null) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { model.editQuiz(quiz.id, edit) }, enabled = !model.busy) { Text("Edit") }
            TextButton(onClick = { confirm = true }, enabled = !model.busy) { Text("Move to trash") }
        }
    }
    if (confirm) Confirm("Move quiz to trash?", quiz.subject, "Move to trash", { confirm = false }) {
        confirm = false
        model.removeQuiz(quiz.id)
    }
}

@Composable
private fun TrashRow(model: GameModel, quiz: QuizSummary) {
    var confirm by remember { mutableStateOf(false) }
    ManagementCard(quiz.subject, quiz.deletedAt?.let(::formatDate)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { model.restoreQuiz(quiz.id) }, enabled = !model.busy) { Text("Restore") }
            if (model.user?.admin == true) {
                TextButton(onClick = { confirm = true }, enabled = !model.busy) { Text("Delete permanently") }
            }
        }
    }
    if (confirm) Confirm("Delete quiz permanently?", "This removes " + quiz.subject + " and its uploaded media.",
        "Delete", { confirm = false }) { confirm = false; model.purgeQuiz(quiz.id) }
}

@Composable
private fun ReportRow(model: GameModel, item: ResultSummary, report: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    ManagementCard(item.subject, formatDate(item.date) + " · " + item.playerCount + " players") {
        Row {
            TextButton(onClick = { model.openReport(item.id, report) }, enabled = !model.busy) { Text("Open report") }
            if (model.user?.admin == true) TextButton(onClick = { confirm = true }, enabled = !model.busy) {
                Text("Delete")
            }
        }
    }
    if (confirm) Confirm("Delete report?", item.subject, "Delete", { confirm = false }) {
        confirm = false
        model.deleteResult(item.id)
    }
}

@Composable
private fun UserRow(model: GameModel, user: User, viewQuizzes: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    var chooseRole by remember { mutableStateOf(false) }
    var reset by remember { mutableStateOf(false) }
    var remove by remember { mutableStateOf(false) }
    val current = model.user?.id == user.id
    Surface(Modifier.fillMaxWidth(), shape = tileShape, color = MaterialTheme.colorScheme.surfaceContainer) {
        Row(Modifier.padding(start = 12.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(user.username)
            Column(Modifier.weight(1f)) {
                Text(user.username, style = MaterialTheme.typography.titleMedium)
                Supporting(roleLabel(user.role) + if (current) " · You" else "")
            }
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Actions for " + user.username) }
                DropdownMenu(menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text("View quizzes") }, onClick = { menu = false; viewQuizzes() })
                    if (!current) {
                        DropdownMenuItem(text = { Text("Change role") }, onClick = { menu = false; chooseRole = true })
                        DropdownMenuItem(text = { Text("Reset password") }, onClick = { menu = false; reset = true })
                        DropdownMenuItem(text = { Text("Delete account") }, onClick = { menu = false; remove = true })
                    }
                }
            }
        }
    }
    if (chooseRole) AlertDialog(onDismissRequest = { chooseRole = false }, title = { Text("Role for " + user.username) },
        text = {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                roles.forEach { role ->
                    FilterChip(role == user.role, {
                        chooseRole = false
                        if (role != user.role) model.updateRole(user.id, role)
                    }, { Text(roleLabel(role)) }, enabled = !model.busy)
                }
            }
        }, confirmButton = { TextButton(onClick = { chooseRole = false }) { Text("Close") } })
    if (reset) ResetPasswordDialog(model, user, { reset = false })
    if (remove) Confirm("Delete " + user.username + "?", "This removes the GoHoot account.", "Delete",
        { remove = false }) { remove = false; model.deleteUser(user.id) }
}

@Composable
private fun ResetRow(model: GameModel, request: ResetRequest, users: List<User>) {
    var reset by remember { mutableStateOf(false) }
    val user = users.firstOrNull { it.username.equals(request.username, ignoreCase = true) }
    ManagementCard(request.username, formatDate(request.createdAt)) {
        Row {
            if (user != null) TextButton(onClick = { reset = true }, enabled = !model.busy) { Text("Reset password") }
            TextButton(onClick = { model.dismissReset(request.id) }, enabled = !model.busy) { Text("Dismiss") }
        }
    }
    if (reset && user != null) ResetPasswordDialog(model, user, { reset = false })
}

@Composable
private fun ResetPasswordDialog(model: GameModel, user: User, close: () -> Unit) {
    var password by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = close, title = { Text("Reset password for " + user.username) },
        text = { PasswordField("New password", password, { password = it }) },
        confirmButton = {
            TextButton(onClick = { model.resetPassword(user.id, password); close() },
                enabled = password.length >= 8 && !model.busy) { Text("Reset") }
        },
        dismissButton = { TextButton(onClick = close) { Text("Cancel") } })
}

@Composable
internal fun ReportScreen(model: GameModel, result: GameResult, back: () -> Unit) {
    var tab by rememberSaveable(result.id) { mutableStateOf("Scores") }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(workbookMime)) { output ->
        if (output != null) model.exportReport(output, result)
    }
    Scaffold(topBar = { GoHootBar("Report", back) }) { padding ->
        PageColumn(Modifier.padding(padding), maxWidth = 840) {
            Heading(result.subject)
            Supporting(formatDate(result.date) + " · " + if (result.mode == "accuracy") "Accuracy" else "Classic")
            if (model.user?.canReport == true) Secondary("Save Excel report", {
                save.launch(workbookName(result.subject))
            }, enabled = !model.busy)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Scores", "Answers").forEach { label ->
                    FilterChip(tab == label, { tab = label }, { Text(label) })
                }
            }
            if (tab == "Scores") {
                ScoreRows(result.players, dense = result.mode == "accuracy")
                if (result.players.isEmpty()) Supporting("No players recorded.")
            } else result.questions.forEachIndexed { index, q ->
                var expanded by rememberSaveable(result.id, index) { mutableStateOf(false) }
                ManagementCard((index + 1).toString() + ". " + q.question, questionType(q.type)) {
                    if (q.type != "slide") {
                        val answered = q.playerAnswers.count { !it.answerIds.isNullOrEmpty() }
                        Supporting(answered.toString() + " answered · " + q.playerAnswers.count { recordedCorrect(q, it) } + " correct")
                        TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Hide answers" else "View answers") }
                        if (expanded) {
                            val correct = if (q.type == "puzzle") q.choices
                            else q.correctChoices.mapNotNull(q.choices::getOrNull)
                            if (correct.isNotEmpty()) Supporting("Correct: " + correct.joinToString(if (q.type == "puzzle") " → " else ", "))
                            q.playerAnswers.forEach { answer ->
                                HorizontalDivider(Modifier.padding(vertical = 3.dp))
                                Text(answer.playerName, fontWeight = FontWeight.Bold)
                                val selected = answerLabels(answer.answerIds, q.type).ifBlank { "No answer" }
                                val outcome = if (recordedCorrect(q, answer)) "Correct" else "Incorrect"
                                Supporting(selected + " · " + outcome + " · " + (answer.points ?: 0) + " points")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun AttendanceScreen(item: Attendance, back: () -> Unit) {
    Scaffold(topBar = { GoHootBar("Your answers", back) }) { padding ->
        PageColumn(Modifier.padding(padding)) {
            Heading(item.subject)
            Supporting(item.points.toString() + " points · Rank " + item.rank + "/" + item.totalPlayers)
            item.questions.forEachIndexed { index, question ->
                ManagementCard((index + 1).toString() + ". " + question.question, questionType(question.type)) {
                    if (question.type != "slide") {
                        val selected = question.selectedAnswers.orEmpty().mapNotNull { question.answers?.getOrNull(it) }
                        Supporting(if (selected.isEmpty()) "No answer" else "You answered: " +
                            selected.joinToString(if (question.type == "puzzle") " → " else ", "))
                        val solutions = if (question.type == "puzzle") question.answers.orEmpty()
                        else question.solutions.orEmpty().mapNotNull { question.answers?.getOrNull(it) }
                        if (solutions.isNotEmpty()) Supporting("Correct: " +
                            solutions.joinToString(if (question.type == "puzzle") " → " else ", "))
                        CountPill((if (question.correct) "Correct" else "Incorrect") +
                            " · " + (question.points ?: 0) + " points")
                    }
                }
            }
        }
    }
}
