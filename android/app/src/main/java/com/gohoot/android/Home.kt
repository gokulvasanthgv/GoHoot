package com.gohoot.android

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun JoinScreen(
    model: GameModel,
    sharedPin: String,
    clearSharedPin: () -> Unit,
    setServer: () -> Unit,
    auth: () -> Unit,
    openInvite: (Invite) -> Unit,
) {
    var room by rememberSaveable { mutableStateOf("") }
    var nickname by rememberSaveable { mutableStateOf(model.nickname.ifBlank { model.user?.username.orEmpty().take(20) }) }
    var attempted by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val address = model.server?.originText
    val account = model.user?.id
    LaunchedEffect(account) {
        if (model.nickname.isBlank() && model.user != null) nickname = model.user!!.username.take(20)
    }
    LaunchedEffect(sharedPin) {
        if (sharedPin.isNotEmpty()) {
            room = sharedPin
            clearSharedPin()
        }
    }
    val join: () -> Unit = {
        attempted = true
        focus.clearFocus()
        val invite = parseInvite(room)
        if (invite != null && nickname.trim().isNotEmpty()) {
            if (invite.origin != null && invite.origin != address) openInvite(invite)
            else if (address == null) setServer()
            else model.join(room, nickname)
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        val compact = maxHeight < 540.dp
        Column(
            Modifier.widthIn(max = 496.dp).fillMaxWidth().fillMaxHeight()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = if (compact) 10.dp else 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(if (compact) 12.dp else 18.dp, Alignment.CenterVertically),
        ) {
            if (!compact) JoinArt()
            Text("Join a game", Modifier.semantics { heading() },
                style = if (compact) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.displayMedium,
                textAlign = TextAlign.Center)
            if (address == null) {
                Secondary("Set server", setServer, Modifier.fillMaxWidth())
            } else if (!model.connected) {
                Supporting("Connecting to " + model.server?.origin?.host.orEmpty())
            }
            OutlinedTextField(
                value = room, onValueChange = { room = it.take(2048); attempted = false },
                modifier = Modifier.fillMaxWidth().testTag("room_code"), label = { Text("Room code") },
                shape = RoundedCornerShape(12.dp), singleLine = true,
                isError = attempted && parseInvite(room) == null,
                supportingText = if (attempted && parseInvite(room) == null) {
                    { Text("Enter a six-digit code or paste an invite link.") }
                } else null,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            )
            OutlinedTextField(
                nickname, { nickname = it.take(20); attempted = false },
                modifier = Modifier.fillMaxWidth().testTag("nickname"), label = { Text("Nickname") },
                shape = RoundedCornerShape(12.dp), singleLine = true, isError = attempted && nickname.isBlank(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { join() }),
            )
            Primary("Join game", join, Modifier.fillMaxWidth().testTag("join_game"), enabled = !model.busy)
            if (model.user == null) TextButton(onClick = {
                if (address == null) setServer() else auth()
            }) { Text("Sign in", style = MaterialTheme.typography.titleMedium) }
        }
    }
}

@Composable
private fun JoinArt() {
    val colors = MaterialTheme.colorScheme
    Box(Modifier.size(164.dp, 125.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        Surface(
            Modifier.align(Alignment.CenterEnd).padding(top = 16.dp, end = 8.dp).size(82.dp).rotate(18f),
            shape = tileShape, color = Color(0xFFFFB300),
        ) {
            Canvas(Modifier.padding(19.dp).fillMaxSize()) {
                val c = center
                val r = size.minDimension / 2
                val d = r * 0.27f
                val star = Path().apply {
                    moveTo(c.x, c.y - r)
                    quadraticTo(c.x + d, c.y - d, c.x + r, c.y)
                    quadraticTo(c.x + d, c.y + d, c.x, c.y + r)
                    quadraticTo(c.x - d, c.y + d, c.x - r, c.y)
                    quadraticTo(c.x - d, c.y - d, c.x, c.y - r)
                    close()
                }
                drawPath(star, Color(0xFF442100))
            }
        }
        Surface(Modifier.align(Alignment.CenterStart).padding(start = 12.dp, bottom = 16.dp)
            .size(88.dp).rotate(-13f), shape = tileShape, color = Color(0xFFFFB68F)) {
            Box(contentAlignment = Alignment.Center) {
                Text("?", color = Color(0xFF542001), fontWeight = FontWeight.Black, fontSize = 54.sp)
            }
        }
        Canvas(Modifier.align(Alignment.TopEnd).padding(end = 14.dp).size(37.dp)) {
            val gold = Color(0xFFFFB300)
            drawLine(gold, Offset(size.width * .17f, size.height * .44f),
                Offset(size.width * .21f, 3f), 4.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
            drawLine(gold, Offset(size.width * .49f, size.height * .51f),
                Offset(size.width * .71f, size.height * .2f), 4.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
            drawLine(gold, Offset(size.width * .67f, size.height * .76f),
                Offset(size.width * .97f, size.height * .68f), 4.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
        }
    }
}

@Composable
internal fun ServerScreen(model: GameModel, proposed: String?, back: () -> Unit, done: () -> Unit) {
    var address by rememberSaveable(proposed) {
        mutableStateOf(proposed ?: model.server?.originText?.trimEnd('/').orEmpty())
    }
    val focus = LocalFocusManager.current
    val connect = { focus.clearFocus(); model.saveServer(address, done) }
    Scaffold(topBar = { GoHootBar("GoHoot server", back) }) { padding ->
        PageColumn(Modifier.padding(padding), maxWidth = 500) {
            Heading("Connect to GoHoot")
            Supporting("Enter the address you use to open GoHoot in a browser.")
            OutlinedTextField(address, { address = it }, Modifier.fillMaxWidth().testTag("server_url"),
                label = { Text("Server URL") }, placeholder = { Text("https://quiz.example.com") },
                singleLine = true, keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go,
                ), keyboardActions = KeyboardActions(onGo = { connect() }))
            Supporting("For a server on your local network, include http:// and its port if required.")
            if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Primary("Connect", connect, Modifier.fillMaxWidth(), enabled = address.isNotBlank() && !model.busy)
        }
    }
}

@Composable
internal fun SettingsScreen(model: GameModel, back: () -> Unit, server: () -> Unit) {
    Scaffold(topBar = { GoHootBar("Settings", back) }) { padding ->
        PageColumn(Modifier.padding(padding)) {
            SectionHeading("Server")
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(model.server?.originText?.trimEnd('/') ?: "No server connected",
                        style = MaterialTheme.typography.titleMedium)
                    if (model.server != null) Supporting(if (model.connected) "Connected" else "Connecting")
                    TextButton(onClick = server) { Text(if (model.server == null) "Set server" else "Change server") }
                }
            }
            SectionHeading("Appearance")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("System", "Light", "Dark").forEach { option ->
                    FilterChip(selected = model.theme == option, onClick = { model.theme(option) },
                        label = { Text(option) })
                }
            }
            if (Build.VERSION.SDK_INT >= 31) SettingSwitch("Use wallpaper colors", model.dynamic, model::dynamic)
            SectionHeading("Sound and touch")
            SettingSwitch("Background music", model.music, model::music)
            SettingSwitch("Sound effects and question audio", model.sound, model::sound)
            if (model.music || model.sound) {
                Text("Volume", style = MaterialTheme.typography.titleSmall)
                Slider(model.volume, model::volume)
            }
            SettingSwitch("Touch feedback", model.haptics, model::haptics)
            SectionHeading("Storage")
            Secondary("Clear media cache", model::clearCache, enabled = !model.busy)
        }
    }
}

@Composable
internal fun SectionHeading(text: String) {
    Text(text, Modifier.semantics { heading() }.padding(top = 4.dp), style = MaterialTheme.typography.titleLarge)
}

@Composable
internal fun SettingSwitch(label: String, checked: Boolean, toggle: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).toggleable(checked, role = Role.Switch, onValueChange = toggle),
        horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
        Switch(checked, onCheckedChange = null)
    }
}

@Composable
internal fun AuthScreen(model: GameModel, back: () -> Unit, done: () -> Unit) {
    var mode by rememberSaveable { mutableStateOf("Sign in") }
    var username by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val focus = LocalFocusManager.current
    val submit: () -> Unit = {
        focus.clearFocus()
        if (mode == "Reset password") model.forgotPassword(username) { mode = "Sign in" }
        else model.login(username, password, mode == "Create account", done)
    }
    Scaffold(topBar = { GoHootBar(mode, back) }) { padding ->
        PageColumn(Modifier.padding(padding), maxWidth = 480) {
            Heading(mode)
            if (mode == "Reset password") Supporting("Ask a server administrator to reset your password.")
            OutlinedTextField(username, { username = it.take(64) }, Modifier.fillMaxWidth(),
                label = { Text("Username") }, singleLine = true)
            if (mode != "Reset password") PasswordField("Password", password, { password = it }) { submit() }
            if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Primary(if (mode == "Reset password") "Request reset" else mode, submit, Modifier.fillMaxWidth(),
                enabled = !model.busy && username.isNotBlank() && (mode == "Reset password" || password.isNotEmpty()))
            if (mode == "Sign in") {
                TextButton(onClick = { mode = "Create account"; password = "" }) { Text("Create account") }
                TextButton(onClick = { mode = "Reset password"; password = "" }) { Text("Forgot password?") }
            } else TextButton(onClick = { mode = "Sign in"; password = "" }) { Text("Back to sign in") }
        }
    }
}

@Composable
internal fun PasswordField(
    label: String,
    value: String,
    change: (String) -> Unit,
    done: (() -> Unit)? = null,
) {
    OutlinedTextField(value, { change(it.take(256)) }, Modifier.fillMaxWidth(), label = { Text(label) },
        singleLine = true, visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password,
            imeAction = if (done == null) ImeAction.Next else ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { done?.invoke() }))
}

@Composable
internal fun AccountScreen(model: GameModel, back: () -> Unit) {
    val user = model.user
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    Scaffold(topBar = { GoHootBar("Account", back) }) { padding ->
        if (user == null) EmptyPane("Signed out", "Sign in again to open your account.")
        else PageColumn(Modifier.padding(padding), maxWidth = 480) {
            Heading(user.username)
            Supporting(roleLabel(user.role))
            SectionHeading("Change password")
            PasswordField("Current password", current, { current = it })
            PasswordField("New password", next, { next = it })
            PasswordField("Confirm new password", confirm, { confirm = it })
            Primary("Change password", {
                if (next != confirm) model.notice("Passwords do not match.")
                else model.changePassword(current, next) { current = ""; next = ""; confirm = "" }
            }, Modifier.fillMaxWidth(), enabled = !model.busy && current.isNotEmpty() && next.isNotEmpty())
            Secondary("Sign out", { model.logout(back) }, Modifier.fillMaxWidth(), enabled = !model.busy)
        }
    }
}

internal fun roleLabel(role: String) = when (role) {
    "admin" -> "Administrator"
    "quizmaster" -> "Quizmaster"
    "analyst" -> "Analyst"
    "quizzer" -> "Quizzer"
    else -> role
}
