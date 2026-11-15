package com.gohoot.android

import android.content.ContentResolver
import android.net.Uri
import java.io.IOException
import java.net.InetAddress
import java.net.Proxy
import java.net.URI
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Dns
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink

internal fun String.toHttpUrlOrNullSafe() = toHttpUrlOrNull()

internal fun parseOrigin(input: String): HttpUrl {
    val trimmed = input.trim()
    val url = (if ("://" in trimmed) trimmed else "https://$trimmed").toHttpUrlOrNull()
        ?: throw ApiFailure("Enter a GoHoot server URL.")
    if (url.encodedPath != "/" || url.query != null || url.fragment != null ||
        url.username.isNotEmpty() || url.password.isNotEmpty()
    ) {
        throw ApiFailure("Enter the server address without a page path, query, or sign-in details.")
    }
    return url
}

internal fun isLocalAddress(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isMulticastAddress) return false
    val bytes = address.address
    return address.isLoopbackAddress || address.isSiteLocalAddress || address.isLinkLocalAddress ||
        (bytes.size == 16 && (bytes[0].toInt() and 0xfe) == 0xfc)
}

internal class ApiFailure(val key: String, val status: Int = 0) : IOException(key)

internal fun jsonFields(vararg values: Pair<String, JsonElement?>) =
    JsonObject(values.mapNotNull { (key, value) -> value?.let { key to it } }.toMap())

internal fun fields(vararg values: Pair<String, String>) =
    JsonObject(values.associate { (key, value) -> key to JsonPrimitive(value) })

private val bodyType = "application/json; charset=utf-8".toMediaType()

internal class Server(val origin: HttpUrl) {
    val originText = origin.toString()

    private val base = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .followRedirects(false)
        .retryOnConnectionFailure(false)
        .apply {
            if (!origin.isHttps) {
                proxy(Proxy.NO_PROXY)
                dns(Dns { host ->
                    if (host != origin.host) throw UnknownHostException("Use the configured LAN server.")
                    Dns.SYSTEM.lookup(host).also { addresses ->
                        if (addresses.isEmpty() || addresses.any { !isLocalAddress(it) }) {
                            throw UnknownHostException("Plain HTTP requires a local network address.")
                        }
                    }
                })
                addInterceptor { chain ->
                    val url = chain.request().url
                    if (url.host != origin.host || url.port != origin.port || url.isHttps) {
                        throw IOException("Use the configured LAN server for plain HTTP.")
                    }
                    chain.proceed(chain.request())
                }
            }
        }.build()

    val socketClient = base.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val httpsMedia = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followSslRedirects(false)
        .build()

    val mediaCalls = Call.Factory { request ->
        val url = request.url
        if (!url.isHttps && (origin.isHttps || url.host != origin.host || url.port != origin.port)) {
            throw IOException("Plain HTTP media must come from your configured local server.")
        }
        (if (url.isHttps) httpsMedia else base).newCall(request)
    }

    val socketUri: URI get() = origin.toUri()

    fun mediaUrl(value: String?): HttpUrl? {
        if (value.isNullOrBlank()) return null
        val url = origin.resolve(value) ?: return null
        if (url.username.isNotEmpty() || url.password.isNotEmpty()) return null
        return url.takeIf {
            it.isHttps || (!origin.isHttps && it.host == origin.host && it.port == origin.port)
        }
    }

    private fun endpoint(path: String): HttpUrl = origin.newBuilder()
        .encodedPath("/api/$path")
        .build()

    suspend fun health() {
        val response = request("health").jsonObject
        if (response["status"]?.jsonPrimitive?.content != "ok") {
            throw ApiFailure("This address did not respond as a GoHoot server.")
        }
    }

    suspend fun request(
        path: String,
        token: String? = null,
        method: String = "GET",
        data: JsonElement? = null,
    ): JsonElement = send(endpoint(path), token, method, when {
        data != null -> data.toString().toRequestBody(bodyType)
        method == "POST" || method == "PATCH" -> "{}".toRequestBody(bodyType)
        else -> null
    })

    suspend fun upload(token: String, resolver: ContentResolver, file: PickedFile): Upload {
        if (file.length > uploadLimit) throw ApiFailure("errors:media.tooLarge")
        val part = object : RequestBody() {
            override fun contentLength() = file.length
            override fun contentType() = file.mimeType.toMediaTypeOrNull()

            override fun writeTo(sink: BufferedSink) {
                val input = resolver.openInputStream(file.uri) ?: throw IOException("Cannot read this file.")
                input.use {
                    val bytes = ByteArray(65536)
                    var size = 0L
                    while (true) {
                        val count = it.read(bytes)
                        if (count == -1) break
                        size += count
                        if (size > uploadLimit) throw ApiFailure("errors:media.tooLarge")
                        sink.write(bytes, 0, count)
                    }
                }
            }
        }
        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("file", file.name, part)
            .build()
        return wireJson.decodeFromJsonElement(Upload.serializer(), send(endpoint("media"), token, "POST", body))
    }

    private suspend fun send(url: HttpUrl, token: String?, method: String, body: RequestBody?): JsonElement =
        suspendCancellableCoroutine { continuation ->
            val request = Request.Builder().url(url).header("Accept", "application/json").apply {
                if (token != null) header("Authorization", "Bearer $token")
                method(method, body)
            }.build()
            val call = base.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    val parsed = runCatching {
                        response.use {
                            if (it.code == 204) return@use JsonNull
                            val bodyText = it.body.string()
                            val json = runCatching { wireJson.parseToJsonElement(bodyText) }.getOrNull()
                            if (!it.isSuccessful) {
                                val key = (json as? JsonObject)?.get("error") as? JsonPrimitive
                                throw ApiFailure(key?.content ?: "Request failed (HTTP " + it.code + ").", it.code)
                            }
                            json ?: throw ApiFailure("This address did not return GoHoot data.", it.code)
                        }
                    }
                    continuation.resumeWith(parsed)
                }
            })
        }
}

internal fun pathPart(value: String): String = HttpUrl.Builder().scheme("https").host("example.com")
    .addPathSegment(value).build().encodedPath.removePrefix("/")

internal data class PickedFile(val uri: Uri, val name: String, val mimeType: String, val length: Long)
