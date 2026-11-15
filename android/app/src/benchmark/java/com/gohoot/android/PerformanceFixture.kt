package com.gohoot.android

import android.os.SystemClock
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal fun PerformanceFixture() {
    var stage by remember { mutableIntStateOf(0) }
    val clock = remember(stage) { GameClock.start(20, SystemClock.elapsedRealtime()) }
    Scaffold(
        modifier = Modifier.semantics { testTagsAsResourceId = true },
        topBar = { GoHootBar("GoHoot gameplay") },
        bottomBar = {
            Primary("Next", { stage = (stage + 1) % 3 },
                Modifier.fillMaxWidth().testTag("benchmark_next"))
        },
    ) { insets ->
        AnimatedContent(stage, Modifier.padding(insets), transitionSpec = {
            fadeIn(tween(165)) togetherWith fadeOut(tween(95))
        }, label = "Benchmark round") { current ->
            when (current) {
                2 -> PageColumn { Heading("Correct!"); ScoreFooter(1000, 1) }
                else -> AnswerStage(
                    mode = if (current == 0) "One correct answer" else "Arrange in order",
                    header = { TimerRing(clock) },
                    prompt = { Heading(if (current == 0) "Which planet has the shortest day?" else "Sort the planets") },
                    controls = { height ->
                        InteractiveAnswers(listOf("Earth", "Venus", "Jupiter", "Mars"),
                            if (current == 0) "quiz" else "puzzle", false, false, false,
                            maxHeight = height, onSubmit = { _, _ -> })
                    },
                )
            }
        }
    }
}
