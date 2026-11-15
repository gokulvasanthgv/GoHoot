package com.gohoot.android

import android.app.Activity
import android.content.pm.ActivityInfo
import android.os.Build
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch

@Composable
internal fun GoHootApp(model: GameModel) {
    val snackbar = remember { SnackbarHostState() }
    val nav = rememberNavController()
    var tab by rememberSaveable { mutableStateOf("Play") }
    var sharedPin by rememberSaveable { mutableStateOf("") }
    var proposedServer by rememberSaveable { mutableStateOf<String?>(null) }
    var inviteDialog by remember { mutableStateOf<Invite?>(null) }
    val active = model.live
    val solo = model.solo
    val context = LocalContext.current
    val activity = context as? Activity
    val presenter = model.presenter && active?.room?.host == true
    val smallestWidth = LocalConfiguration.current.smallestScreenWidthDp

    DisposableEffect(activity, presenter, smallestWidth) {
        val previous = activity?.requestedOrientation
        if (presenter && smallestWidth < 600) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
        onDispose {
            if (presenter && smallestWidth < 600 && previous != null) activity.requestedOrientation = previous
        }
    }
    DisposableEffect(activity, active != null) {
        if (active != null) activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            if (active != null) activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
    LaunchedEffect(model) {
        model.notices.collect { message ->
            snackbar.currentSnackbarData?.dismiss()
            launch { snackbar.showSnackbar(message) }
        }
    }
    LaunchedEffect(model.pendingInvite, model.initializing) {
        if (model.initializing) return@LaunchedEffect
        val invite = model.pendingInvite ?: return@LaunchedEffect
        model.consumeInvite()
        if (model.live != null) {
            model.notice("Leave the current game before joining another.")
        } else if (invite.origin != null && invite.origin != model.server?.originText) {
            inviteDialog = invite
        } else {
            sharedPin = invite.pin
            tab = "Play"
            nav.popBackStack("home", false)
        }
    }

    Box(Modifier.fillMaxSize()) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                model.initializing -> LoadingPane("Opening GoHoot")
                active != null -> LiveScreen(model, active) { result ->
                    model.showReport(result)
                }
                solo != null -> SoloScreen(model, solo)
                else -> NavHost(nav, startDestination = "home", modifier = Modifier.fillMaxSize(),
                    enterTransition = { fadeIn(tween(160)) },
                    exitTransition = { fadeOut(tween(100)) },
                    popEnterTransition = { fadeIn(tween(160)) },
                    popExitTransition = { fadeOut(tween(100)) },
                ) {
                    composable("home") {
                        HomeScreen(
                            model = model,
                            tab = tab,
                            onTab = { tab = it },
                            sharedPin = sharedPin,
                            clearSharedPin = { sharedPin = "" },
                            server = { address ->
                                proposedServer = address
                                nav.navigate("server")
                            },
                            settings = { nav.navigate("settings") },
                            auth = {
                                if (model.server == null) {
                                    proposedServer = null
                                    nav.navigate("server")
                                } else nav.navigate("auth")
                            },
                            account = { nav.navigate("account") },
                            openEditor = { nav.navigate("editor") },
                            openReport = { nav.navigate("report") },
                            openHistory = { nav.navigate("attendance") },
                            invite = { inviteDialog = it },
                        )
                    }
                    composable("settings") {
                        SettingsScreen(model, { nav.popBackStack() }) {
                            proposedServer = null
                            nav.navigate("server")
                        }
                    }
                    composable("server") {
                        ServerScreen(model, proposedServer, { nav.popBackStack() }) {
                            proposedServer = null
                            nav.popBackStack()
                        }
                    }
                    composable("auth") {
                        AuthScreen(model, { nav.popBackStack() }) { nav.popBackStack() }
                    }
                    composable("account") {
                        AccountScreen(model, { nav.popBackStack() })
                    }
                    composable("editor") {
                        EditorScreen(model, { model.closeEditor(); nav.popBackStack() }) { nav.popBackStack() }
                    }
                    composable("report") {
                        model.report?.let { report ->
                            ReportScreen(model, report) { model.closeReport(); nav.popBackStack() }
                        }
                    }
                    composable("attendance") {
                        model.selectedHistory?.let { item ->
                            AttendanceScreen(item) { model.selectHistory(null); nav.popBackStack() }
                        }
                    }
                }
            }
        }

        if (active != null && model.report != null) {
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                ReportScreen(model, requireNotNull(model.report), model::closeReport)
            }
            BackHandler { model.closeReport() }
        }
        SnackbarHost(snackbar, modifier = Modifier.align(Alignment.BottomCenter)
            .windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp))
    }

    inviteDialog?.let { invite ->
        AlertDialog(
            onDismissRequest = { inviteDialog = null },
            title = { Text("Open invite") },
            text = { Text("Connect to " + invite.origin.orEmpty().trimEnd('/') + " to join room " + invite.pin + ".") },
            confirmButton = {
                TextButton(onClick = {
                    sharedPin = invite.pin
                    tab = "Play"
                    proposedServer = invite.origin
                    inviteDialog = null
                    nav.navigate("server")
                }) { Text("Set server") }
            },
            dismissButton = { TextButton(onClick = { inviteDialog = null }) { Text("Cancel") } },
        )
    }
}

private data class Destination(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val destinations = listOf(
    Destination("Play", Icons.Filled.PlayArrow),
    Destination("Library", Icons.AutoMirrored.Filled.List),
    Destination("Host", Icons.Filled.Person),
)

@Composable
private fun HomeScreen(
    model: GameModel,
    tab: String,
    onTab: (String) -> Unit,
    sharedPin: String,
    clearSharedPin: () -> Unit,
    server: (String?) -> Unit,
    settings: () -> Unit,
    auth: () -> Unit,
    account: () -> Unit,
    openEditor: () -> Unit,
    openReport: () -> Unit,
    openHistory: () -> Unit,
    invite: (Invite) -> Unit,
) {
    val wide = windowWidth() >= 700.dp
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column {
                GoHootBar(
                    title = if (tab == "Play") "GoHoot" else tab,
                    branded = tab == "Play",
                    actions = {
                        if (model.user != null) IconButton(onClick = account) {
                            Icon(Icons.Filled.Person, "Account")
                        }
                        IconButton(onClick = settings) { Icon(Icons.Filled.Settings, "Settings") }
                    },
                )
                if (model.busy && tab != "Play") LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        },
        bottomBar = {
            if (!wide) NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                destinations.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item.label, onClick = { onTab(item.label) },
                        icon = { Icon(item.icon, null) }, label = { Text(item.label) },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        androidx.compose.foundation.layout.Row(Modifier.fillMaxSize().padding(padding)) {
            if (wide) NavigationRail(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                destinations.forEach { item ->
                    NavigationRailItem(selected = tab == item.label, onClick = { onTab(item.label) },
                        icon = { Icon(item.icon, null) }, label = { Text(item.label) })
                }
            }
            AnimatedContent(tab, Modifier.weight(1f),
                transitionSpec = { (fadeIn(tween(170)) togetherWith fadeOut(tween(100))).using(SizeTransform(clip = false)) },
                label = "Home tab",
            ) { current ->
                when (current) {
                    "Library" -> LibraryScreen(model, auth, openReport, openHistory)
                    "Host" -> HostDashboard(model, auth, openEditor, openReport)
                    else -> JoinScreen(model, sharedPin, clearSharedPin, { server(null) }, auth, invite)
                }
            }
        }
    }
}
