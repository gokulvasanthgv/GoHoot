package com.gohoot.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.ReportDrawnWhen
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.SideEffect

class MainActivity : ComponentActivity() {
    private val model by viewModels<GameModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) readInvite(intent)
        setContent {
            val dark = useDarkTheme(model.theme)
            SideEffect {
                val transparent = android.graphics.Color.TRANSPARENT
                val bars = if (dark) SystemBarStyle.dark(transparent)
                else SystemBarStyle.light(transparent, transparent)
                enableEdgeToEdge(bars, bars)
            }
            GoHootTheme(dark, model.dynamic) {
                if (BuildConfig.BUILD_TYPE == "benchmark" && intent.getBooleanExtra("benchmark_fixture", false)) {
                    PerformanceFixture()
                } else {
                    ReportDrawnWhen { !model.initializing }
                    GoHootApp(model)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readInvite(intent)
    }

    private fun readInvite(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            intent.getStringExtra(Intent.EXTRA_TEXT)?.let(model::receiveInvite)
        }
    }

    override fun onStart() {
        super.onStart()
        model.foreground(true)
    }

    override fun onStop() {
        model.foreground(false)
        super.onStop()
    }
}
