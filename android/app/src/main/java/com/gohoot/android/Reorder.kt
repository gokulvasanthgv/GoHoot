package com.gohoot.android

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.preferredFrameRate
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlin.math.abs

internal class ReorderState {
    private data class RowPosition(val layout: LayoutCoordinates, val centerY: Float)
    private val bounds = mutableMapOf<Any, RowPosition>()
    private var initial = 0f
    private var previousFinger = 0f
    var dragged by mutableStateOf<Any?>(null)
        private set
    var delta by mutableFloatStateOf(0f)
        private set
    var target by mutableIntStateOf(-1)
        private set

    fun coordinates(key: Any, layout: LayoutCoordinates) {
        if (key != dragged) bounds[key] = RowPosition(layout, layout.positionInRoot().y + layout.size.height / 2f)
    }

    fun start(key: Any, index: Int) {
        val position = bounds[key]?.takeIf { it.layout.isAttached } ?: return
        initial = position.centerY
        previousFinger = initial
        dragged = key
        target = index
        delta = 0f
    }

    fun drag(amount: Float, keys: List<Any>) {
        if (dragged == null) return
        previousFinger += amount
        delta = previousFinger - initial
        target = keys.indices.minByOrNull { index ->
            val position = bounds[keys[index]]?.takeIf { it.layout.isAttached }?.centerY
            if (position == null) Float.MAX_VALUE else abs(position - previousFinger)
        } ?: target
    }

    fun finish() {
        dragged = null
        delta = 0f
        target = -1
    }
}

@Composable
internal fun ReorderHandle(
    state: ReorderState,
    key: Any,
    index: Int,
    keys: List<Any>,
    color: Color,
    enabled: Boolean,
    haptics: Boolean,
    label: String,
    move: (Int, Int) -> Unit,
) {
    if (!enabled) return
    val latestIndex by rememberUpdatedState(index)
    val latestKeys by rememberUpdatedState(keys)
    val latestMove by rememberUpdatedState(move)
    val haptic = LocalHapticFeedback.current
    val actions = buildList {
        if (index > 0) add(CustomAccessibilityAction("Move up") { move(index, index - 1); true })
        if (index < keys.lastIndex) add(CustomAccessibilityAction("Move down") { move(index, index + 1); true })
    }
    Box(Modifier.size(48.dp).semantics {
        contentDescription = label
        customActions = actions
    }.pointerInput(state, key, haptics) {
        detectDragGesturesAfterLongPress(
            onDragStart = {
                state.start(key, latestIndex)
                if (haptics) haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            },
            onDrag = { change, amount ->
                change.consume()
                state.drag(amount.y, latestKeys)
            },
            onDragEnd = {
                val from = latestIndex
                val to = state.target
                state.finish()
                if (to != from && to in latestKeys.indices) latestMove(from, to)
            },
            onDragCancel = state::finish,
        )
    }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(22.dp)) {
            for (row in 0..2) for (column in 0..1) {
                drawCircle(color, 1.65.dp.toPx(), Offset(size.width * (0.36f + column * 0.28f),
                    size.height * (0.19f + row * 0.31f)))
            }
        }
    }
}

@Composable
internal fun Modifier.reorderRow(state: ReorderState, key: Any, index: Int): Modifier {
    val lifted = state.dragged == key
    val scale by animateFloatAsState(if (lifted) 1.035f else 1f, spring(stiffness = 500f), label = "Lift")
    return onGloballyPositioned { state.coordinates(key, it) }
        .zIndex(if (lifted) 2f else 0f)
        .then(if (lifted) Modifier.preferredFrameRate(FrameRateCategory.High) else Modifier)
        .graphicsLayer {
            translationY = if (lifted) state.delta else 0f
            scaleX = scale
            scaleY = scale
            alpha = if (!lifted && state.target == index) .72f else 1f
        }
}
