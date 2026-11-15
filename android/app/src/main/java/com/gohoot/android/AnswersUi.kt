package com.gohoot.android

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun InteractiveAnswers(
    answers: List<String>,
    type: String,
    multiple: Boolean,
    hide: Boolean,
    haptics: Boolean,
    enabled: Boolean = true,
    solo: Boolean = false,
    correctChoices: List<Int> = emptyList(),
    submitted: List<Int>? = null,
    maxHeight: Dp = 420.dp,
    onSubmit: (List<Int>, Boolean) -> Unit,
) {
    var selections by remember(answers) { mutableStateOf(emptySet<Int>()) }
    val hasSubmit = (type == "puzzle" || multiple) && submitted == null
    val tilesBudget = if (hasSubmit) (maxHeight - 48.dp).coerceAtLeast(0.dp) else maxHeight
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (type == "puzzle") {
            var order by remember(answers, submitted) { mutableStateOf(
                submitted ?: if (solo) answers.indices.shuffled() else answers.indices.toList(),
            ) }
            val state = remember(answers) { ReorderState() }
            PuzzleOrder(order, answers, state, enabled, haptics, tilesBudget) { from, to ->
                order = order.moved(from, to)
            }
            if (hasSubmit) AnswerAction("Submit order", "submit_order", enabled) { onSubmit(order, false) }
        } else {
            AnswerGrid(answers, hide, haptics, selections, correctChoices, submitted, tilesBudget) { index ->
                if (!enabled) null
                else if (multiple) ({ selections = if (index in selections) selections - index else selections + index })
                else ({ onSubmit(listOf(index), true) })
            }
            if (hasSubmit) AnswerAction("Submit answers", "submit_answers", enabled && selections.isNotEmpty()) {
                onSubmit(selections.sorted(), false)
            }
        }
    }
}

@Composable
private fun AnswerAction(label: String, tag: String, enabled: Boolean, submit: () -> Unit) {
    androidx.compose.material3.Button(
        onClick = submit, enabled = enabled, shape = pill,
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).testTag(tag),
    ) { Text(label) }
}

@Composable
private fun PuzzleOrder(
    order: List<Int>,
    answers: List<String>,
    state: ReorderState,
    enabled: Boolean,
    haptics: Boolean,
    maxHeight: Dp,
    move: (Int, Int) -> Unit,
) {
    if (order.isEmpty()) return
    val gap = 4.dp
    val height = ((maxHeight - gap * order.lastIndex) / order.size).coerceIn(1.dp, 60.dp)
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        order.forEachIndexed { index, option ->
            key(option) {
                val text = answers[option]
                Surface(Modifier.fillMaxWidth().height(height).reorderRow(state, option, index)
                    .testTag("puzzle_tile_" + option),
                    shape = tileShape, color = answerColors[option % 7], contentColor = Color.White) {
                    Row(Modifier.fillMaxSize().padding(start = 12.dp), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OptionGlyph(option, diameter = 19.dp)
                        Text((index + 1).toString(), fontWeight = FontWeight.Black)
                        AnswerText(text, Modifier.weight(1f).padding(vertical = 2.dp), compact = true,
                            alignment = TextAlign.Start)
                        ReorderHandle(state, option, index, order, Color.White, enabled, haptics, "Reorder " + text, move)
                    }
                }
            }
        }
    }
}

@Composable
internal fun ReadOnlyAnswers(answers: List<String>, type: String?, maxHeight: Dp = 420.dp) {
    if (type == "puzzle") {
        val order = remember(answers) { answers.indices.toList() }
        PuzzleOrder(order, answers, remember { ReorderState() }, false, false, maxHeight) { _, _ -> }
    } else AnswerGrid(answers, false, false, emptySet(), emptyList(), null, maxHeight) { null }
}

@Composable
private fun AnswerGrid(
    answers: List<String>,
    hide: Boolean,
    haptics: Boolean,
    selections: Set<Int>,
    correctChoices: List<Int>,
    submitted: List<Int>?,
    maxHeight: Dp,
    click: (Int) -> (() -> Unit)?,
) {
    if (answers.isEmpty()) return
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val fontScale = LocalDensity.current.fontScale
        val columns = when {
            maxWidth >= 560.dp -> minOf(answers.size, if (answers.size == 6) 3 else 4)
            (maxWidth < 300.dp || fontScale >= 1.55f) && maxHeight >= 62.dp * answers.size -> 1
            else -> 2
        }
        val gap = if (maxHeight < 220.dp) 5.dp else 8.dp
        val rows = answers.indices.chunked(columns)
        val tileWidth = (maxWidth - gap * (columns - 1)) / columns
        val preferredHeight = if (maxWidth >= 560.dp) 88.dp else 104.dp
        val tileHeight = ((maxHeight - gap * rows.lastIndex) / rows.size).coerceIn(1.dp, preferredHeight)
        val compact = tileHeight < 68.dp || fontScale >= 1.45f
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            rows.forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap, Alignment.CenterHorizontally)) {
                    row.forEach { index ->
                        val chosen = index in selections || index in submitted.orEmpty()
                        val revealed = submitted != null
                        val correct = revealed && index in correctChoices
                        val color = when {
                            !revealed -> answerColors[index % 7]
                            correct -> Color(0xFF126548)
                            chosen -> Color(0xFFA02E26)
                            else -> Color(0xFF504C50)
                        }

                        PressSurface(color, click(index),
                            modifier = Modifier.width(tileWidth).height(tileHeight).testTag("answer_" + index)
                                .then(if (chosen) Modifier.border(BorderStroke(2.dp, Color.White), tileShape) else Modifier)
                                .semantics {
                                    selected = chosen
                                    if (hide) contentDescription = optionShapeName(index)
                                },
                            haptics = haptics, selected = chosen) {
                            val glyphSize = when {
                                hide -> if (compact) 22.dp else 32.dp
                                compact -> 18.dp
                                else -> 26.dp
                            }
                            val spacing = if (compact) 5.dp else 8.dp
                            val sideInset = if (compact) 7.dp else 10.dp
                            Box(Modifier.fillMaxSize()) {
                                Row(Modifier.fillMaxSize().padding(horizontal = sideInset, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(spacing)) {
                                    OptionGlyph(index, diameter = glyphSize)
                                    if (!hide) {
                                        AnswerText(answers[index], Modifier.weight(1f), compact)
                                        if (tileWidth >= 216.dp) Spacer(Modifier.width(glyphSize))
                                    }
                                }
                                if (chosen || correct) Icon(Icons.Filled.Check,
                                    if (correct) "Correct option" else null,
                                    Modifier.align(Alignment.TopEnd).padding(end = 5.dp, top = 3.dp)
                                        .size(if (compact) 13.dp else 17.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnswerText(label: String, modifier: Modifier, compact: Boolean, alignment: TextAlign = TextAlign.Center) {
    BasicText(label, modifier,
        style = TextStyle(color = Color.White, fontWeight = FontWeight.Bold, textAlign = alignment),
        maxLines = if (compact) 3 else 4, overflow = TextOverflow.Ellipsis,
        autoSize = TextAutoSize.StepBased(minFontSize = 9.sp, maxFontSize = if (compact) 16.sp else 18.sp, stepSize = 0.5.sp))
}

@Composable
internal fun SoloScreen(model: GameModel, game: SoloGame) {
    var leave by remember { mutableStateOf(false) }
    var settings by rememberSaveable { mutableStateOf(false) }
    val back = { if (game.result != null) model.closeSolo() else leave = true }
    val result = game.result
    val q = game.question
    val next = if (game.index == game.quiz.questions.lastIndex) "Finish quiz" else "Next question"
    BackHandler(onBack = back)
    Scaffold(topBar = {
        GoHootBar(game.quiz.subject, back, actions = {
            if (result == null) QuizSettingsButton { settings = true }
        })
    }) { padding ->
        if (result != null) {
            PageColumn(Modifier.padding(padding)) {
                CountPill("Solo complete")
                Heading(result.subject)
                Text((result.players.firstOrNull()?.points ?: 0).toString() + " points",
                    style = MaterialTheme.typography.displayMedium)
                val correct = result.questions.count { it.playerAnswers.firstOrNull()?.correct == true }
                Supporting(correct.toString() + " of " + result.questions.count { it.type != "slide" } + " correct")
                Primary("Done", model::closeSolo, Modifier.fillMaxWidth())
            }
        } else key(game.index) {
            val submitted = game.answers[game.index]
            val multiple = q.correctChoices.size > 1 && q.type == "quiz"
            val progress = "Question " + (game.index + 1) + " of " + game.quiz.questions.size
            AnswerStage(
                type = q.type,
                multiple = multiple,
                modifier = Modifier.padding(padding),
                header = { Text(progress, style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 6.dp)) },
                prompt = { available ->
                    StagePrompt(model, q.question, q.media, available)
                    if (q.type == "slide") Text(q.text.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                    if (submitted != null) {
                        CountPill(if (q.check(submitted)) "Correct!" else "Incorrect")
                        if (q.type == "puzzle" && !q.check(submitted)) {
                            Supporting("Correct order: " + q.choices.joinToString(" → "))
                        }
                    }
                },
                controls = { budget ->
                    if (q.type != "slide") {
                        InteractiveAnswers(q.choices, q.type, multiple, false, model.haptics,
                            enabled = !game.answered, solo = true, correctChoices = q.correctChoices, submitted = submitted,
                            maxHeight = if (game.answered) (budget - 108.dp).coerceAtLeast(0.dp) else budget,
                            onSubmit = { choices, _ -> model.answerSolo(choices) })
                        if (game.answered) ScoreFooter(game.totalPoints, game.streak)
                    }
                    if (game.answered || q.type == "slide") {
                        Primary(next, model::advanceSolo, Modifier.fillMaxWidth(), enabled = !model.busy)
                    }
                },
            )
        }
    }
    QuizMusic(model, game.quiz.audio, enabled = result == null && !game.answered &&
        q.type != "slide" && q.media?.type !in listOf("audio", "video"))
    if (settings) QuizSettingsDialog(model) { settings = false }
    if (leave) Confirm("Leave solo quiz?", "This attempt has not been saved.", "Leave",
        { leave = false }, model::closeSolo)
}
