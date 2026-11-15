package com.gohoot.android

import java.io.BufferedWriter
import java.io.OutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

internal const val workbookMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

internal fun workbookName(subject: String): String =
    subject.replace(Regex("[/\\\\?%*:|\"<>\\s]+"), "_").take(120).ifBlank { "GoHoot" } + "_results.xlsx"

internal fun formatDate(value: String): String = runCatching {
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM).withZone(ZoneId.systemDefault())
        .format(Instant.parse(value))
}.getOrDefault(value)

internal fun answerLabels(ids: List<Int>?, type: String): String =
    ids.orEmpty().joinToString(", ") { if (type == "puzzle") (it + 1).toString() else optionLabel(it) }

internal fun optionLabel(index: Int) = ('A' + index.coerceIn(0, 6)).toString()

internal fun recordedCorrect(question: Question, answer: RecordedAnswer): Boolean =
    answer.correct ?: answer.answerIds?.let { ids ->
        if (question.type == "puzzle") question.check(ids)
        else ids.isNotEmpty() && ids.all { it in question.correctChoices }
    } ?: false

internal fun writeWorkbook(result: GameResult, output: OutputStream) {
    ZipOutputStream(output).use { zip ->
        fun entry(name: String, text: String) {
            zip.putNextEntry(ZipEntry(name))
            zip.write(text.trimIndent().toByteArray())
            zip.closeEntry()
        }
        entry("[Content_Types].xml", """
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
            <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
            <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
            </Types>
        """)
        entry("_rels/.rels", """
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
        """)
        entry("xl/workbook.xml", """
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <sheets><sheet name="Quiz Results" sheetId="1" r:id="rId1"/></sheets></workbook>
        """)
        entry("xl/_rels/workbook.xml.rels", """
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            </Relationships>
        """)
        entry("xl/styles.xml", """
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
            <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
            <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
            <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
            <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
            <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
            <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
            </styleSheet>
        """)
        zip.putNextEntry(ZipEntry("xl/worksheets/sheet1.xml"))
        val writer = zip.bufferedWriter()
        writer.write("""
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
            <cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/>
            <col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/>
        """.trimIndent())
        if (result.questions.isNotEmpty()) {
            writer.write("<col min=\"5\" max=\"" + (4 + result.questions.size) + "\" width=\"42\" customWidth=\"1\"/>")
        }
        writer.write("</cols><sheetData>")
        writer.row(1, listOf("Subject: " + result.subject))
        writer.row(2, listOf("Date: " + formatDate(result.date)))
        writer.row(3, listOf("Game Mode: " + if (result.mode == "accuracy") "Accuracy Mode" else "Classic Mode"))
        writer.row(5, listOf("Rank", "Nickname", "Total Points", "Correct Answers") +
            result.questions.mapIndexed { index, question -> "Q" + (index + 1) + ": " + question.question }, bold = true)
        val count = result.questions.count { it.type != "slide" }
        val byPlayer = result.questions.map { it.playerAnswers.associateBy(RecordedAnswer::playerName) }
        result.players.forEachIndexed { index, player ->
            var correctCount = 0
            val summaries = result.questions.mapIndexed { questionIndex, question ->
                if (question.type == "slide") "N/A (Slide)"
                else {
                    val answer = byPlayer[questionIndex][player.username]
                    if (answer?.answerIds.isNullOrEmpty()) "No Answer"
                    else {
                        val correct = recordedCorrect(question, requireNotNull(answer))
                        if (correct) correctCount++
                        (if (correct) "Correct" else "Incorrect") +
                            " (" + answerLabels(answer.answerIds, question.type) + ")"
                    }
                }
            }
            writer.row(index + 6, listOf(player.rank ?: index + 1, player.username,
                player.points, "$correctCount / $count") + summaries)
        }
        writer.write("</sheetData></worksheet>")
        writer.flush()
        zip.closeEntry()
    }
}

private fun BufferedWriter.row(index: Int, values: List<Any>, bold: Boolean = false) {
    write("<row r=\"$index\">")
    values.forEachIndexed { column, value ->
        val reference = columnName(column) + index
        val style = if (bold) 2 else 1
        if (value is Number) write("<c r=\"$reference\" s=\"$style\"><v>$value</v></c>")
        else {
            write("<c r=\"$reference\" s=\"$style\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
            write(xmlText(value.toString()))
            write("</t></is></c>")
        }
    }
    write("</row>")
}

private fun columnName(index: Int): String = buildString {
    var number = index + 1
    while (number > 0) {
        number--
        append('A' + (number % 26))
        number /= 26
    }
}.reversed()

private fun xmlText(value: String): String = buildString {
    value.codePoints().forEach { code ->
        when (code) {
            '&'.code -> append("&amp;")
            '<'.code -> append("&lt;")
            '>'.code -> append("&gt;")
            9, 10, 13, in 32..0xd7ff, in 0xe000..0xfffd, in 0x10000..0x10ffff -> appendCodePoint(code)
        }
    }
}
