package com.gohoot.android

import android.os.Build
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.material3.ripple
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.preferredFrameRate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GoHootBar(
    title: String,
    back: (() -> Unit)? = null,
    branded: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
) {
    TopAppBar(
        title = {
            Text(
                title, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = if (branded) MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black)
                else MaterialTheme.typography.titleLarge,
                color = if (branded) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            )
        },
        navigationIcon = {
            if (back != null) IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
internal fun PageColumn(
    modifier: Modifier = Modifier,
    maxWidth: Int = 640,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = maxWidth.dp).fillMaxWidth()
                .verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            content = content,
        )
    }
}

@Composable
internal fun Primary(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(onClick = onClick, modifier = modifier.heightIn(min = 54.dp), shape = pill, enabled = enabled) {
        Text(label, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
internal fun Secondary(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(onClick = onClick, modifier = modifier.heightIn(min = 48.dp), shape = pill, enabled = enabled) {
        Text(label)
    }
}

@Composable
internal fun Heading(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
}

@Composable
internal fun Supporting(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
internal fun LoadingPane(label: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(Modifier.size(32.dp), strokeWidth = 3.dp)
            Supporting(label)
        }
    }
}

@Composable
internal fun EmptyPane(title: String, description: String, action: String? = null, onAction: () -> Unit = {}) {
    PageColumn {
        Spacer(Modifier.height(20.dp))
        Heading(title)
        Supporting(description)
        if (action != null) Primary(action, onAction)
    }
}

@Composable
internal fun CountPill(text: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = pill, color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer) {
        Text(text, Modifier.padding(horizontal = 12.dp, vertical = 5.dp), style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
internal fun Avatar(value: String, index: Int = 0) {
    Box(Modifier.size(38.dp).background(answerColors[index % answerColors.size], CircleShape),
        contentAlignment = Alignment.Center) {
        Text(value.firstOrNull()?.uppercase().orEmpty(), color = Color.White, fontWeight = FontWeight.Bold)
    }
}

@Composable
internal fun Confirm(
    title: String,
    text: String,
    confirmLabel: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirmLabel) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
internal fun PressSurface(
    color: Color,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    haptics: Boolean = false,
    selected: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val hovered by interaction.collectIsHoveredAsState()
    val focused by interaction.collectIsFocusedAsState()
    val active = pressed || hovered || focused
    val scale by animateFloatAsState(if (pressed) 0.978f else 1f, spring(stiffness = 850f), label = "Answer press")
    val tint by animateFloatAsState(if (pressed || selected) .11f else if (active) .07f else 0f,
        spring(stiffness = 850f), label = "Answer highlight")
    val haptic = LocalHapticFeedback.current
    val click = if (onClick == null) Modifier else Modifier.clickable(
        interactionSource = interaction, indication = ripple(color = Color.White), role = Role.Button,
    ) {
        if (haptics) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        onClick()
    }
    Surface(
        modifier.then(if (pressed) Modifier.preferredFrameRate(FrameRateCategory.High) else Modifier)
            .graphicsLayer { scaleX = scale; scaleY = scale },
        shape = tileShape, color = color, contentColor = Color.White,
    ) {
        Box(click, contentAlignment = Alignment.Center) {
            content()
            Box(Modifier.matchParentSize().graphicsLayer { alpha = tint }.background(Color.White))
        }
    }
}

private val optionShapeNames = listOf("Triangle", "Diamond", "Circle", "Hexagon", "Plus", "Square", "Pentagon")

internal fun optionShapeName(index: Int) = optionShapeNames[index % optionShapeNames.size]

@Composable
internal fun OptionGlyph(index: Int, modifier: Modifier = Modifier, color: Color = Color.White,
    diameter: Dp = 26.dp) {
    Canvas(modifier.size(diameter)) {
        val radius = size.minDimension * 0.41f
        val stroke = Stroke(width = 2.35.dp.toPx())
        when (index) {
            2 -> drawCircle(color, radius, style = stroke)
            4 -> {
                drawLine(color, center.copy(x = center.x - radius), center.copy(x = center.x + radius), stroke.width)
                drawLine(color, center.copy(y = center.y - radius), center.copy(y = center.y + radius), stroke.width)
            }
            else -> {
                val sides = when (index) { 0 -> 3; 1, 5 -> 4; 3 -> 6; else -> 5 }
                val start = if (index == 5) PI / 4 else if (index == 3) 0.0 else -PI / 2
                val path = Path()
                repeat(sides) { point ->
                    val angle = start + 2 * PI * point / sides
                    val x = center.x + (cos(angle) * radius).toFloat()
                    val y = center.y + (sin(angle) * radius).toFloat()
                    if (point == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                path.close()
                drawPath(path, color, style = stroke)
            }
        }
    }
}
