package com.gohoot.android.benchmark

import android.graphics.Point
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GoHootBenchmark {
    @get:Rule val rule = MacrobenchmarkRule()

    @Test
    fun coldStart() = rule.measureRepeated(
        packageName = app,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.Partial(),
        iterations = 5,
        startupMode = StartupMode.COLD,
        setupBlock = { pressHome() },
        measureBlock = {
            device.executeShellCommand("am start -W -n " + activity)
            check(device.wait(Until.hasObject(By.text("Join a game")), 8000))
        },
    )

    @Test
    fun roundTransitionsAndPuzzleDrag() = rule.measureRepeated(
        packageName = app,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.Partial(),
        iterations = 5,
        setupBlock = {
            killProcess()
            device.executeShellCommand("am start -W -n " + activity + " --ez benchmark_fixture true")
            check(device.wait(Until.hasObject(By.res("benchmark_next")), 5000))
        },
        measureBlock = {
            device.findObject(By.res("benchmark_next")).click()
            val handle = device.wait(Until.findObject(By.desc("Reorder Earth")), 4000)
                ?: error("Puzzle drag handle is missing")
            val from = handle.visibleCenter
            val target = device.findObject(By.desc("Reorder Venus")).visibleCenter
            handle.drag(Point(from.x, target.y), 850)
            check(device.findObject(By.desc("Reorder Earth")).visibleCenter.y > from.y)
            device.findObject(By.res("benchmark_next")).click()
            check(device.wait(Until.hasObject(By.text("Correct!")), 4000))
        },
    )

    private companion object {
        const val app = "com.gohoot.android.benchmarktarget"
        const val activity = "$app/com.gohoot.android.MainActivity"
    }
}
