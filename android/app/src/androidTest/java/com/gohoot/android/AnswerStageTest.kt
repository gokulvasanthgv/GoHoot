package com.gohoot.android

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AnswerStageTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun longPromptScrollsWithoutMovingEqualAnswerTiles() {
        val answers = listOf("Skin", "Lower tarsal plate", "Muller's muscle", "Superior conjunctival fornix",
            "A fifth answer", "This answer needs more words so that it wraps", "Last answer")
        compose.setContent {
            GoHootTheme(false, false) {
                Box(Modifier.fillMaxWidth().height(490.dp)) {
                    AnswerStage(
                        mode = "Multi-select",
                        header = { Text("Question 1 of 3") },
                        prompt = { Text("Long quiz question. ".repeat(150)) },
                        controls = { height ->
                            InteractiveAnswers(answers, "quiz", true, false, false,
                                maxHeight = height, onSubmit = { _, _ -> })
                        },
                    )
                }
            }
        }

        val tiles = answers.indices.map { compose.onNodeWithTag("answer_" + it) }
        val before = tiles.map { it.assertIsDisplayed().fetchSemanticsNode().boundsInRoot }
        assertTrue(before.all { bounds -> bounds.height == before.first().height })
        assertTrue(before.all { bounds -> kotlin.math.abs(bounds.width - before.first().width) <= 1f })

        val fixed = compose.onNodeWithTag("fixed_answers").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("scrolling_question").performTouchInput { swipeUp() }
        assertEquals(fixed, compose.onNodeWithTag("fixed_answers").fetchSemanticsNode().boundsInRoot)
        assertEquals(before, tiles.map { it.fetchSemanticsNode().boundsInRoot })
        compose.onNodeWithTag("submit_answers").assertIsDisplayed()
    }
}
