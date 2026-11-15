package com.gohoot.android

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The fixed panel is measured first by Column. The prompt can then use the
 * remaining height without moving or scrolling the controls.
 */
@Composable
internal fun AnswerStage(
    type: String?,
    multiple: Boolean?,
    modifier: Modifier = Modifier,
    header: @Composable () -> Unit,
    prompt: @Composable ColumnScope.(Dp) -> Unit,
    controls: @Composable ColumnScope.(Dp) -> Unit,
) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 900.dp).fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 8.dp)) {
            header()
            QuestionModeBadge(type, multiple, Modifier.padding(bottom = 6.dp).testTag("answer_mode"))
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val promptReserve = (maxHeight * 0.19f).coerceIn(28.dp, 76.dp)
                val controlBudget = (maxHeight - promptReserve).coerceAtLeast(0.dp)
                Column(Modifier.fillMaxSize()) {
                    BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                        val promptHeight = maxHeight
                        Column(Modifier.fillMaxWidth().testTag("scrolling_question")
                            .verticalScroll(rememberScrollState()).padding(top = 4.dp, bottom = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            prompt(promptHeight)
                        }
                    }
                    Column(Modifier.fillMaxWidth().testTag("fixed_answers"),
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        controls(controlBudget)
                    }
                }
            }
        }
    }
}

@Composable
internal fun StagePrompt(model: GameModel, question: String, media: Media?, available: Dp) {
    val type = MaterialTheme.typography
    val style = when {
        available < 160.dp || question.length > 190 -> type.titleLarge
        available < 240.dp || question.length > 100 -> type.headlineSmall
        else -> type.headlineMedium
    }
    Text(question, modifier = Modifier.semantics { heading() }.testTag("question_prompt"),
        style = style)
    QuestionMedia(model, media, Modifier.fillMaxWidth().heightIn(
        max = (available * 0.55f).coerceIn(104.dp, 244.dp),
    ), description = "Question image")
}

@Composable
internal fun QuizSettingsButton(open: () -> Unit) {
    IconButton(onClick = open) { Icon(Icons.Filled.Settings, "Quiz settings") }
}

@Composable
internal fun QuizSettingsDialog(model: GameModel, close: () -> Unit) {
    AlertDialog(
        onDismissRequest = close,
        title = { Text("Quiz settings") },
        text = {
            Column {
                SettingSwitch("Background music", model.playbackMusic, model::setPlaybackMusic)
                SettingSwitch("Sound effects and question audio", model.playbackSound, model::setPlaybackSound)
            }
        },
        confirmButton = { TextButton(onClick = close) { Text("Done") } },
    )
}

@Composable
internal fun ScoreFooter(total: Int, streak: Int?, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Surface(modifier.fillMaxWidth(), shape = tileShape, color = colors.surfaceContainerHigh) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Supporting("Correct streak")
                Text(streak?.toString() ?: "—", style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold, modifier = Modifier.testTag("round_streak"))
            }
            Column(Modifier.weight(1f)) {
                Supporting("Total score")
                Text(total.toString(), style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold, modifier = Modifier.testTag("round_total"))
            }
        }
    }
}
