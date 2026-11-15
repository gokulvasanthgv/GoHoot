package com.gohoot.android

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

private val choiceRows = listOf("M5 9H17V21H5Z", "M5 27H17V39H5Z", "M24 15H42", "M24 33H38")
private const val firstCheck = "M7 14L11 18L20 8"

@Composable
internal fun QuestionModeBadge(
    type: String?,
    multiple: Boolean?,
    modifier: Modifier = Modifier,
    animated: Boolean = false,
) {
    val label = questionMode(type, multiple)
    val colors = MaterialTheme.colorScheme
    Surface(modifier, shape = if (animated) tileShape else pill, color = colors.primaryContainer,
        contentColor = colors.onPrimaryContainer) {
        if (animated) {
            var started by remember(type, multiple) { mutableStateOf(false) }
            val progress = animateFloatAsState(if (started) 1f else 0f, tween(760), label = "Question type")
            LaunchedEffect(type, multiple) { started = true }
            Column(Modifier.padding(horizontal = 24.dp, vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ModeArtwork(type, multiple, Modifier.size(58.dp), progress)
                Text(label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center)
            }
        } else {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ModeArtwork(type, multiple, Modifier.size(18.dp))
                Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun ModeArtwork(type: String?, multiple: Boolean?, modifier: Modifier, progress: State<Float>? = null) {
    val (outline, marks) = remember(type, multiple) {
        val (base, accents) = when (type) {
            "true_or_false" -> listOf("M4 14H22V32H4Z", "M26 14H44V32H26Z") to
                listOf("M8 22L12 26L18 19", "M31 19L39 27 M39 19L31 27")
            "puzzle" -> listOf("M19 11H42", "M19 24H38", "M19 37H42") to
                listOf("M9 12V36 M5 16L9 12L13 16 M5 32L9 36L13 32")
            "slide" -> listOf("M5 9H43V39H5Z", "M12 18H36", "M12 25H29") to emptyList()
            else -> choiceRows to when (multiple) {
                true -> listOf(firstCheck, "M7 32L11 36L20 26")
                false -> listOf(firstCheck)
                null -> emptyList()
            }
        }
        base.map { PathParser().parsePathString(it).toPath() } to
            accents.map { PathParser().parsePathString(it).toPath() }
    }
    val color = MaterialTheme.colorScheme.onPrimaryContainer
    Canvas(modifier) {
        val entrance = progress?.value ?: 1f
        val style = Stroke(width = 3f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        scale(size.minDimension / 48f, pivot = Offset.Zero) {
            scale(0.84f + 0.16f * entrance, pivot = Offset(24f, 24f)) {
                translate(top = 5f * (1f - entrance)) {
                    outline.forEach {
                        drawPath(it, color, alpha = 0.25f + entrance * 0.25f, style = style)
                    }
                    marks.forEachIndexed { index, path ->
                        val reveal = ((entrance - index * 0.2f - 0.12f) / 0.62f).coerceIn(0f, 1f)
                        translate(top = 3f * (1f - reveal)) {
                            drawPath(path, color, alpha = 0.12f + 0.88f * reveal, style = style)
                        }
                    }
                }
            }
        }
    }
}
