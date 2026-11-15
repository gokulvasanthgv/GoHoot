package com.gohoot.android

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes as MediaAudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.gif.GifDecoder
import coil3.gif.AnimatedImageDecoder
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.ImageRequest
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Call
import okio.Path.Companion.toOkioPath

@OptIn(UnstableApi::class)
internal class MediaEngine(context: Context) {
    private val app = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val activePlayers = mutableSetOf<ExoPlayer>()
    private val soundIds = ConcurrentHashMap<String, Int>()
    private val soundReady = ConcurrentHashMap.newKeySet<Int>()
    private val streams = ArrayDeque<Int>()
    private val audioPool = SoundPool.Builder().setMaxStreams(4)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val warming = ConcurrentHashMap.newKeySet<String>()
    private val mediaWarmSlots = Semaphore(2)
    private val cacheLock = Any()
    private val database by lazy { StandaloneDatabaseProvider(app) }
    private var playbackCache: SimpleCache? = null
    private val disk = lazy {
        DiskCache.Builder().directory(File(app.cacheDir, "question-images").toOkioPath())
            .maxSizeBytes(96L * 1024 * 1024).build()
    }
    private val memory = lazy { MemoryCache.Builder().maxSizePercent(app, 0.18).build() }
    private val loaders = mutableMapOf<String, ImageLoader>()

    init {
        audioPool.setOnLoadCompleteListener { _, sample, status ->
            if (status == 0) soundReady.add(sample)
        }
        scope.launch {
            listOf("answersSound", "boump", "show", "results", "three", "second", "first")
                .forEach { name ->
                    runCatching {
                        app.assets.openFd("$name.mp3").use { soundIds[name] = audioPool.load(it, 1) }
                    }
                }
        }
    }

    fun imageLoader(server: Server): ImageLoader = synchronized(loaders) {
        loaders.getOrPut(server.originText) {
            ImageLoader.Builder(app).memoryCache { memory.value }.diskCache { disk.value }
                .components {
                    add(OkHttpNetworkFetcherFactory(callFactory = { server.mediaCalls }))
                    add(SvgDecoder.Factory())
                    if (android.os.Build.VERSION.SDK_INT >= 28) add(AnimatedImageDecoder.Factory())
                    else add(GifDecoder.Factory())
                }.build()
        }
    }

    private fun cached(): SimpleCache = synchronized(cacheLock) {
        playbackCache ?: SimpleCache(
            File(app.cacheDir, "question-media"),
            LeastRecentlyUsedCacheEvictor(256L * 1024 * 1024),
            database,
        ).also { playbackCache = it }
    }

    private fun mediaFactory(calls: Call.Factory, cache: SimpleCache): CacheDataSource.Factory =
        CacheDataSource.Factory().setCache(cache)
            .setUpstreamDataSourceFactory(OkHttpDataSource.Factory(calls))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

    suspend fun player(server: Server?): ExoPlayer {
        val cache = if (server == null) null else withContext(Dispatchers.IO) { cached() }
        val builder = ExoPlayer.Builder(app)
        if (server != null && cache != null) {
            builder.setMediaSourceFactory(DefaultMediaSourceFactory(mediaFactory(server.mediaCalls, cache)))
        }
        return builder.build().also {
            it.setAudioAttributes(
                MediaAudioAttributes.Builder().setUsage(C.USAGE_GAME)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),
                true,
            )
            activePlayers.add(it)
        }
    }

    fun release(player: ExoPlayer) {
        if (activePlayers.remove(player)) player.release()
    }

    fun pause() {
        activePlayers.forEach(Player::pause)
        stopCues()
    }

    fun cue(id: String, volume: Float) {
        val sample = soundIds[id] ?: return
        if (sample !in soundReady) return
        val stream = audioPool.play(sample, volume, volume, 1, 0, 1f)
        if (stream != 0) {
            if (streams.size == 8) streams.removeFirst()
            streams.addLast(stream)
        }
    }

    fun stopCues() {
        streams.forEach(audioPool::stop)
        streams.clear()
    }

    fun prefetch(server: Server, media: Media) {
        val url = server.mediaUrl(media.url) ?: return
        val address = url.toString()
        if (media.type == "image") {
            imageLoader(server).enqueue(
                ImageRequest.Builder(app).data(address).size(960, 960).build(),
            )
        } else if (media.type in listOf("audio", "video") && youtubeId(address) == null) {
            if (!warming.add(address)) return
            scope.launch {
                try {
                    mediaWarmSlots.acquire()
                    try {
                        val source = mediaFactory(server.mediaCalls, cached()).createDataSourceForDownloading()
                        val cap = if (media.type == "audio") 4L * 1024 * 1024 else 1024L * 1024
                        val data = DataSpec.Builder().setUri(address).setLength(cap).build()
                        runCatching { CacheWriter(source, data, null, null).cache() }
                    } finally {
                        mediaWarmSlots.release()
                    }
                } finally {
                    warming.remove(address)
                }
            }
        }
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        if (disk.isInitialized()) disk.value.clear()
        else if (File(app.cacheDir, "question-images").exists()) disk.value.clear()
        if (memory.isInitialized()) memory.value.clear()
        synchronized(cacheLock) {
            if (playbackCache != null || File(app.cacheDir, "question-media").exists()) {
                val cache = cached()
                cache.keys.forEach(cache::removeResource)
            }
        }
    }

    fun close() {
        scope.cancel()
        activePlayers.toList().forEach(::release)
        stopCues()
        audioPool.release()
        synchronized(loaders) {
            loaders.values.forEach(ImageLoader::shutdown)
            loaders.clear()
        }
        synchronized(cacheLock) {
            playbackCache?.release()
            playbackCache = null
        }
    }
}

internal fun youtubeId(url: String): String? {
    val parsed = url.toHttpUrlOrNullSafe() ?: return null
    val host = parsed.host
    val segments = parsed.pathSegments
    val id = when {
        host == "youtu.be" -> segments.firstOrNull()
        host in listOf("youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com") -> {
            if (segments.firstOrNull() in listOf("shorts", "embed", "v", "live")) segments.getOrNull(1)
            else if (parsed.encodedPath == "/watch") parsed.queryParameter("v")
            else null
        }
        else -> null
    }
    return id?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{11}")) }
}

internal val bundledMusic: Uri get() = Uri.parse("asset:///answersMusic.mp3")

internal fun mediaItem(uri: Uri): MediaItem = MediaItem.fromUri(uri)
