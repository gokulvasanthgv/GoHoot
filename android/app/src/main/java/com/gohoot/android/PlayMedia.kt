package com.gohoot.android

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage

@Composable
internal fun QuestionMedia(model: GameModel, media: Media?, modifier: Modifier = Modifier, description: String? = null) {
    val server = model.server ?: return
    if (media == null || media.url.isBlank()) return
    val address = server.mediaUrl(media.url)
    if (address == null) {
        MediaMessage("This media address is unavailable.", modifier)
        return
    }
    val uri = remember(address) { Uri.parse(address.toString()) }
    when (media.type) {
        "image", null -> {
            var failed by remember(address) { mutableStateOf(false) }
            if (failed) MediaMessage("Image unavailable", modifier)
            else AsyncImage(
                model = address.toString(), imageLoader = model.media.imageLoader(server),
                contentDescription = description ?: "Question image",
                contentScale = ContentScale.Fit,
                modifier = modifier.clip(tileShape),
                onError = { failed = true },
            )
        }
        "video" -> {
            val id = remember(address) { youtubeId(address.toString()) }
            if (id == null) DirectMedia(model, server, uri, video = true, modifier)
            else YouTubeMedia(id, modifier, sound = model.playbackSound)
        }
        "audio" -> DirectMedia(model, server, uri, video = false, modifier)
    }
}

@Composable
private fun MediaMessage(label: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = tileShape, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
        Box(Modifier.padding(12.dp), contentAlignment = Alignment.Center) { Supporting(label) }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun DirectMedia(model: GameModel, server: Server, uri: Uri, video: Boolean, modifier: Modifier) {
    var player by remember(uri) { mutableStateOf<ExoPlayer?>(null) }
    var failed by remember(uri) { mutableStateOf(false) }
    var playing by remember(uri) { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(uri, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            val next = try {
                model.media.player(server)
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failed = true
                return@repeatOnLifecycle
            }
            try {
                failed = false
                val observer = object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) { failed = true }
                    override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
                }
                next.addListener(observer)
                next.volume = if (model.playbackSound) model.volume else 0f
                next.setMediaItem(mediaItem(uri))
                next.prepare()
                next.playWhenReady = true
                player = next
                kotlinx.coroutines.awaitCancellation()
            } finally {
                player = null
                model.media.release(next)
            }
        }
    }
    LaunchedEffect(model.volume, model.playbackSound, player) {
        player?.volume = if (model.playbackSound) model.volume else 0f
    }
    if (failed) {
        MediaMessage(if (video) "Video unavailable" else "Audio unavailable", modifier)
    } else if (video) {
        AndroidView(
            factory = { PlayerView(it).apply { setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING) } },
            update = { it.player = player },
            onRelease = { it.player = null },
            modifier = modifier.aspectRatio(16f / 9f).clip(tileShape).background(Color.Black),
        )
    } else {
        Surface(modifier, shape = tileShape, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
            Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("Question audio", Modifier.weight(1f).padding(start = 8.dp),
                    style = MaterialTheme.typography.titleMedium)
                if (player == null) CircularProgressIndicator(Modifier.padding(10.dp), strokeWidth = 2.dp)
                else TextButton(onClick = {
                    player?.let { if (playing) it.pause() else it.play() }
                }) { Text(if (playing) "Pause" else "Play") }
            }
        }
    }
}

@Composable
internal fun QuizMusic(model: GameModel, address: String?, enabled: Boolean) {
    val music = model.playbackMusic
    val server = model.server
    val uri = remember(server, address) { server?.mediaUrl(address)?.let { Uri.parse(it.toString()) } }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var player by remember { mutableStateOf<ExoPlayer?>(null) }
    LaunchedEffect(uri, enabled, music, lifecycle) {
        if (!enabled || !music) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            val next = try {
                model.media.player(server.takeIf { uri != null })
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                return@repeatOnLifecycle
            }
            try {
                next.addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        if (next.currentMediaItem?.localConfiguration?.uri != bundledMusic) {
                            next.setMediaItem(mediaItem(bundledMusic))
                            next.prepare()
                            next.play()
                        }
                    }
                })
                next.repeatMode = Player.REPEAT_MODE_ONE
                next.volume = model.volume
                next.setMediaItem(mediaItem(uri ?: bundledMusic))
                next.prepare()
                next.play()
                player = next
                kotlinx.coroutines.awaitCancellation()
            } finally {
                player = null
                model.media.release(next)
            }
        }
    }
    LaunchedEffect(player, model.volume) { player?.volume = model.volume }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun YouTubeMedia(videoId: String, modifier: Modifier, sound: Boolean) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var play by remember(videoId, sound) { mutableStateOf(false) }
    var webView by remember(videoId) { mutableStateOf<WebView?>(null) }
    val context = LocalContext.current
    val external = { openUrl(context, "https://www.youtube.com/watch?v=$videoId") }
    LaunchedEffect(webView, lifecycle) {
        val view = webView ?: return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            view.onResume()
            try { kotlinx.coroutines.awaitCancellation() } finally { view.onPause() }
        }
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (play) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        setBackgroundColor(android.graphics.Color.BLACK)
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                        settings.mediaPlaybackRequiresUserGesture = false
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                if (!request.isForMainFrame) return false
                                val url = request.url
                                if (url.scheme == "https" && url.host in listOf("www.youtube.com", "www.youtube-nocookie.com") &&
                                    url.path == "/embed/$videoId"
                                ) return false
                                return true
                            }
                        }
                        val referer = "https://" + ctx.packageName + "/"
                        loadUrl("https://www.youtube.com/embed/$videoId?autoplay=1&playsinline=1&mute=" + if (sound) "0" else "1",
                            mapOf("Referer" to referer))
                        webView = this
                    }
                },
                onRelease = { it.stopLoading(); it.destroy() },
                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).heightIn(min = 116.dp)
                    .clip(tileShape).background(Color.Black),
            )
        } else {
            Surface(
                onClick = { play = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp),
                color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = tileShape,
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Filled.PlayArrow, null)
                    Text("Play YouTube video", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        TextButton(onClick = external, modifier = Modifier.align(Alignment.End)) { Text("Open in YouTube") }
    }
}

internal fun openUrl(context: Context, address: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(address))) }
}
