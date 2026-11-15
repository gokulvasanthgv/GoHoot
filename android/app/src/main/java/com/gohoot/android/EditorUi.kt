package com.gohoot.android

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

private val questionKinds = listOf("quiz", "true_or_false", "puzzle", "slide")

@Composable
internal fun EditorScreen(model: GameModel, back: () -> Unit, saved: () -> Unit) {
    val draft = model.editor
    if (draft == null) {
        EmptyPane("No quiz open", "Open a quiz from the Host dashboard.", "Go back", back)
        return
    }
    val initial = remember(draft.id) { draft }
    var add by rememberSaveable { mutableStateOf(false) }
    var discard by rememberSaveable { mutableStateOf(false) }
    var media by rememberSaveable { mutableStateOf(false) }
    var selected by rememberSaveable { mutableStateOf<Int?>(null) }
    var ids by remember(draft.id) { mutableStateOf(draft.questions.indices.toList()) }
    var nextId by remember(draft.id) { mutableStateOf(ids.size) }
    val reorder = remember { ReorderState() }
    val previous = {
        if (model.busy) Unit
        else if (draft != initial) discard = true
        else back()
    }
    BackHandler(onBack = previous)
    Scaffold(
        topBar = {
            GoHootBar("Edit quiz", previous, actions = {
                TextButton(onClick = { model.saveQuiz(saved) }, enabled = !model.busy) { Text("Save") }
            })
        },
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.background) {
                Box(Modifier.fillMaxWidth().navigationBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                    Primary("Add question", { add = true }, Modifier.fillMaxWidth().testTag("add_question"),
                        enabled = !model.busy && draft.questions.size < 500)
                }
            }
        },
    ) { insets ->
        LazyColumn(Modifier.fillMaxWidth().padding(insets).padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Surface(color = MaterialTheme.colorScheme.tertiaryContainer,
                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer, shape = panelShape) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(draft.subject, { model.changeQuiz(draft.copy(subject = it.take(500))) },
                            Modifier.fillMaxWidth().testTag("quiz_title"), label = { Text("Quiz title") },
                            textStyle = MaterialTheme.typography.headlineSmall, maxLines = 4)
                        TextButton(onClick = { media = true }) { Text("Quiz wallpaper and audio") }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(top = 5.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Questions", style = MaterialTheme.typography.headlineSmall)
                    CountPill(draft.questions.size.toString())
                }
            }
            itemsIndexed(draft.questions, key = { index, _ -> ids.getOrElse(index) { index } }) { index, question ->
                val id = ids.getOrElse(index) { index }
                Surface(Modifier.fillMaxWidth().animateItem().reorderRow(reorder, id, index),
                    color = MaterialTheme.colorScheme.surfaceContainer, shape = tileShape) {
                    Row(Modifier.heightIn(min = 68.dp).padding(end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        ReorderHandle(reorder, id, index, ids, MaterialTheme.colorScheme.onSurface,
                            enabled = !model.busy, haptics = model.haptics,
                            label = "Reorder question " + (index + 1)) { from, to ->
                            ids = ids.moved(from, to)
                            model.changeQuiz(draft.copy(questions = draft.questions.moved(from, to)))
                        }
                        Surface(onClick = { selected = index }, Modifier.weight(1f),
                            color = Color.Transparent, shape = tileShape, enabled = !model.busy) {
                            Row(Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                CountPill((index + 1).toString())
                                Column {
                                    Text(question.question.ifBlank { "Untitled question" },
                                        style = MaterialTheme.typography.titleMedium, maxLines = 3)
                                    Supporting(questionType(question.type))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (add) AlertDialog(onDismissRequest = { add = false }, title = { Text("Add question") },
        text = {
            Column {
                questionKinds.forEach { type ->
                    TextButton(onClick = {
                        ids = ids + nextId
                        nextId++
                        model.changeQuiz(draft.copy(questions = draft.questions + newQuestion(type)))
                        selected = draft.questions.size
                        add = false
                    }, modifier = Modifier.fillMaxWidth()) { Text(questionType(type)) }
                }
            }
        }, confirmButton = { TextButton(onClick = { add = false }) { Text("Cancel") } })
    if (media) MediaSettingsDialog("Quiz wallpaper and audio", model,
        draft.wallpaper.orEmpty(), draft.audio.orEmpty(), { media = false }) { wallpaper, audio ->
        model.changeQuiz(draft.copy(wallpaper = wallpaper, audio = audio))
        media = false
    }
    selected?.let { index ->
        draft.questions.getOrNull(index)?.let { question ->
            val update = { changed: Question ->
                model.changeQuiz(draft.copy(questions = draft.questions.mapIndexed { i, q -> if (i == index) changed else q }))
            }
            QuestionEditor(model, question, index, { selected = null }, update,
                remove = if (draft.questions.size > 1) ({
                    selected = null
                    ids = ids.filterIndexed { i, _ -> i != index }
                    model.changeQuiz(draft.copy(questions = draft.questions.filterIndexed { i, _ -> i != index }))
                }) else null)
        }
    }
    if (discard) Confirm("Discard unsaved edits?", "Your last saved quiz will still be available.", "Discard",
        { discard = false }, back)
}

@Composable
private fun QuestionEditor(
    model: GameModel,
    initial: Question,
    index: Int,
    close: () -> Unit,
    update: (Question) -> Unit,
    remove: (() -> Unit)?,
) {
    var draft by remember(index) { mutableStateOf(initial) }
    var confirmRemove by remember { mutableStateOf(false) }
    val type = draft.type
    AlertDialog(onDismissRequest = { if (!model.busy) close() },
        title = { Text("Question " + (index + 1)) },
        text = {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(9.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    questionKinds.forEach { kind ->
                        FilterChip(kind == type, {
                            val defaults = newQuestion(kind)
                            draft = draft.copy(
                                type = kind,
                                answers = if (kind == "true_or_false" || draft.choices.isEmpty()) defaults.answers else draft.answers,
                                solutions = if (kind == "true_or_false" || kind == "puzzle" || kind == "slide") {
                                    defaults.solutions
                                } else draft.solutions,
                                text = if (kind == "slide") draft.text.orEmpty() else null,
                            )
                        }, { Text(questionType(kind)) })
                    }
                }
                OutlinedTextField(draft.question, { draft = draft.copy(question = it.take(4000)) },
                    Modifier.fillMaxWidth().testTag("question_text"), label = { Text("Question title") })
                if (type == "slide") OutlinedTextField(draft.text.orEmpty(), { draft = draft.copy(text = it.take(20000)) },
                    Modifier.fillMaxWidth(), label = { Text("Slide text") }, minLines = 3, maxLines = 8)
                else {
                    if (type == "puzzle") Supporting("Enter the answers in their correct order.")
                    else Supporting("Mark the correct answer" + if (type == "quiz") " or answers." else ".")
                    draft.choices.forEachIndexed { option, value ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            OutlinedTextField(value, { text ->
                                draft = draft.copy(answers = draft.choices.mapIndexed { i, s -> if (i == option) text.take(65) else s })
                            }, Modifier.weight(1f), label = { Text("Answer " + optionLabel(option)) }, maxLines = 2)
                            if (type != "puzzle") FilterChip(option in draft.correctChoices, {
                                val current = draft.correctChoices
                                val next = if (type == "true_or_false") listOf(option)
                                else if (option in current) current - option else current + option
                                draft = draft.copy(solutions = next)
                            }, label = { Text("Correct") })
                            if (type != "true_or_false" && draft.choices.size > 2) IconButton(
                                onClick = { draft = draft.removeChoice(option) },
                            ) { Icon(Icons.Filled.Close, "Remove answer " + optionLabel(option)) }
                        }
                    }
                    if (type != "true_or_false" && draft.choices.size < 7) {
                        TextButton(onClick = { draft = draft.copy(answers = draft.choices + "") }) {
                            Icon(Icons.Filled.Add, null)
                            Text("Add answer", Modifier.padding(start = 5.dp))
                        }
                    }
                    NumberField("Reading time (seconds)", draft.cooldown, 3..15) { draft = draft.copy(cooldown = it) }
                    NumberField("Answer time (seconds)", draft.time, 5..120) { draft = draft.copy(time = it) }
                    SettingSwitch("Double points", draft.doublePoints == true) { draft = draft.copy(doublePoints = it) }
                }
                QuestionMediaEditor(model, draft.media) { draft = draft.copy(media = it) }
                if (remove != null) TextButton(onClick = { confirmRemove = true }, enabled = !model.busy) {
                    Text("Remove question", color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = { TextButton(onClick = { update(draft); close() }, enabled = !model.busy) { Text("Apply") } },
        dismissButton = { TextButton(onClick = close, enabled = !model.busy) { Text("Cancel") } })
    if (confirmRemove && remove != null) Confirm("Remove question?", draft.question, "Remove",
        { confirmRemove = false }) { confirmRemove = false; remove() }
}

@Composable
private fun NumberField(label: String, number: Int, range: IntRange, set: (Int) -> Unit) {
    var text by remember { mutableStateOf(number.toString()) }
    OutlinedTextField(text, {
        text = it.filter(Char::isDigit).take(3)
        set(text.toIntOrNull() ?: 0)
    }, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = true,
        isError = number !in range, supportingText = { Text(range.first.toString() + "–" + range.last) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
}

@Composable
private fun QuestionMediaEditor(model: GameModel, media: Media?, set: (Media?) -> Unit) {
    val kind = media?.type ?: "image"
    SectionHeading("Question media")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("image", "audio", "video").forEach { type ->
            FilterChip(kind == type, { set(Media(type, media?.url.orEmpty())) },
                label = { Text(type.replaceFirstChar { it.uppercase() }) })
        }
    }
    UploadField(model, "Media URL", media?.url.orEmpty(), kind, { set(Media(kind, it)) })
    if (!media?.url.isNullOrBlank()) TextButton(onClick = { set(null) }, enabled = !model.busy) {
        Text("Remove media")
    }
}

@Composable
internal fun MediaSettingsDialog(
    title: String,
    model: GameModel,
    initialWallpaper: String,
    initialAudio: String,
    close: () -> Unit,
    apply: (String, String) -> Unit,
) {
    var wallpaper by rememberSaveable { mutableStateOf(initialWallpaper) }
    var audio by rememberSaveable { mutableStateOf(initialAudio) }
    AlertDialog(onDismissRequest = { if (!model.busy) close() }, title = { Text(title) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                UploadField(model, "Wallpaper URL", wallpaper, "image", { wallpaper = it })
                UploadField(model, "Conductor audio URL", audio, "audio", { audio = it })
            }
        },
        confirmButton = { TextButton(onClick = { apply(wallpaper, audio) }, enabled = !model.busy) { Text("Save") } },
        dismissButton = { TextButton(onClick = close, enabled = !model.busy) { Text("Cancel") } })
}

@Composable
private fun UploadField(model: GameModel, label: String, value: String, kind: String, change: (String) -> Unit) {
    var crop by remember { mutableStateOf<Uri?>(null) }
    var preview by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val choose = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { file ->
        if (file != null) {
            val mime = context.contentResolver.getType(file)
            if (kind == "image" && mime !in listOf("image/gif", "image/svg+xml")) crop = file
            else model.upload(file, done = change)
        }
    }
    OutlinedTextField(value, { change(it.take(2048)) }, Modifier.fillMaxWidth(),
        label = { Text(label) }, maxLines = 3, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
    Row {
        TextButton(onClick = { choose.launch(arrayOf(kind + "/*")) }, enabled = !model.busy) {
            Text("Choose " + kind)
        }
        if (value.isNotBlank()) TextButton(onClick = { preview = !preview }) {
            Text(if (preview) "Hide preview" else "Preview")
        }
    }
    if (preview && value.isNotBlank()) QuestionMedia(model, Media(kind, value),
        Modifier.fillMaxWidth().heightIn(max = 190.dp))
    if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    crop?.let { image ->
        CropDialog(image, close = { crop = null }, original = {
            crop = null
            model.upload(image, done = change)
        }, cropped = {
            crop = null
            model.upload(it, cropped = true, done = change)
        })
    }
}
