package com.gohoot.android

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GoHootContractTest {
    @Test
    fun inviteUsesSixDigitsAndPreservesServerOrigin() {
        assertEquals(Invite("482731"), parseInvite("482 731"))
        assertEquals(Invite("482731", "https://quiz.example.org:8443/"),
            parseInvite("https://quiz.example.org:8443/?pin=482731"))
        assertNull(parseInvite("https://quiz.example.org/manager?pin=482731"))
        assertNull(parseInvite("https://quiz.example.org/?pin=48273"))
        assertEquals("https://quiz.example.org/", parseOrigin("quiz.example.org").toString())
    }

    @Test
    fun cleartextDnsAcceptsLanAndEmulatorAddresses() {
        listOf("10.0.2.2", "192.168.1.15", "172.16.0.1", "127.0.0.1", "::1", "fd00::1").forEach {
            assertTrue(it, isLocalAddress(InetAddress.getByName(it)))
        }
        listOf("0.0.0.0", "8.8.8.8", "172.32.0.1", "224.0.0.1", "2606:4700::1111").forEach {
            assertFalse(it, isLocalAddress(InetAddress.getByName(it)))
        }
        val server = Server(parseOrigin("http://10.0.2.2:3000"))
        assertEquals("http://10.0.2.2:3000/uploads/a.png", server.mediaUrl("/uploads/a.png").toString())
        assertNull(server.mediaUrl("http://example.org/cue.mp3"))
    }

    @Test
    fun restoredServerPhaseControlsAnswerEligibility() {
        val room = RoomRef("https://quiz.example.org/", "player", "game", false)
        val frame = GameFrame(ANSWER, FrameData(answers = listOf("A", "B", "C"), type = "puzzle", time = 8))
        val joined = LiveGame(room).withFrame(frame, 1000)
        assertNull(joined.answerPayload(listOf(2, 1, 0), false))

        val restored = joined.withSnapshot(Rejoin("game", frame, QuestionNumber(1, 4),
            player = Player("Alex", points = 120)), 2000)
        assertEquals(8, restored.clock.left(2000))
        assertEquals(4, restored.clock.withTick(4, 4000).left(4000))
        assertNull(restored.answerPayload(listOf(2, 1), false))
        assertNull(restored.answerPayload(listOf(2, 1, 1), false))
        val body = requireNotNull(restored.answerPayload(listOf(2, 1, 0), false))
        assertEquals("[2,1,0]", body.getValue("data").jsonObject.getValue("answerKey").toString())
        assertNull(restored.withFrame(GameFrame(WAIT), 2100).answerPayload(listOf(2, 1, 0), false))
    }

    @Test
    fun recognizesExistingQuizAndResultShapes() {
        val imported = importQuizJson("""
            {"subject":"Example","questions":[
                {"question":"Pick one","answers":["One","Two"],"solutions":1},
                {"type":"puzzle","question":"Put in order","answers":["A","B","C"]},
                {"type":"slide","question":"Welcome","text":"Intro"}
            ]}
        """.trimIndent()).forSave()
        assertNull(validateQuiz(imported))
        assertEquals(listOf(1), imported.questions.first().correctChoices)
        assertTrue(imported.questions[1].check(listOf(0, 1, 2)))
        assertFalse(imported.questions[1].check(listOf(1, 0, 2)))
        assertEquals("abcdefghijk", youtubeId("https://www.youtube.com/shorts/abcdefghijk"))
        assertNull(youtubeId("https://www.youtube.com.example.org/watch?v=abcdefghijk"))
    }


    @Test
    fun soloStreakIgnoresSlidesAndResetsOnWrongAnswers() {
        val choice = Question(question = "One answer", answers = listOf("A", "B"), solutions = listOf(0))
        val quiz = Quiz(questions = listOf(choice, Question(type = "slide"),
            choice.copy(doublePoints = true), choice))
        val first = SoloGame(quiz).withAnswer(listOf(0))
        assertEquals(1, first.streak)
        val slide = first.copy(index = 1).withAnswer(listOf(0))
        assertEquals(1, slide.streak)
        val double = slide.copy(index = 2).withAnswer(listOf(0))
        assertEquals(2, double.streak)
        assertEquals(3000, double.totalPoints)
        val wrong = double.copy(index = 3).withAnswer(listOf(1))
        assertEquals(0, wrong.streak)
        assertEquals(3000, wrong.totalPoints)
    }

    @Test
    fun workbookUsesNumericScoresAndSafeTextCells() {
        val choices = Question(
            question = "A < B", answers = listOf("Yes", "No"), solutions = listOf(0),
            playerAnswers = listOf(RecordedAnswer("=Alex & Co", listOf(0), correct = true, points = 1000)),
        )
        val result = GameResult("game", "Space & time", "2026-11-13T08:00:00.000Z",
            listOf(Player("=Alex & Co", points = 1000, rank = 1)), listOf(choices))
        val output = ByteArrayOutputStream()
        writeWorkbook(result, output)
        val contents = mutableMapOf<String, String>()
        ZipInputStream(ByteArrayInputStream(output.toByteArray())).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                contents[entry.name] = zip.readBytes().decodeToString()
            }
        }
        assertNotNull(contents["[Content_Types].xml"])
        val worksheet = requireNotNull(contents["xl/worksheets/sheet1.xml"])
        val parser = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        val parsed = parser.parse(ByteArrayInputStream(worksheet.encodeToByteArray()))
        assertEquals("worksheet", parsed.documentElement.tagName)
        assertTrue(worksheet.contains("=Alex &amp; Co"))
        assertTrue(worksheet.contains("<v>1000</v>"))
        assertTrue(worksheet.contains("Correct (A)"))
        assertTrue(worksheet.contains("A &lt; B"))
        assertFalse(worksheet.contains("<f>"))
    }
}
