package com.gohoot.android

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.thread.EventThread
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.json.JSONArray
import org.json.JSONObject

internal class LiveSocket(
    server: Server,
    token: String,
    private val onConnect: () -> Unit,
    private val onDisconnect: (Boolean) -> Unit,
    private val onEvent: (String, JsonElement) -> Unit,
) {
    @Volatile private var closed = false
    private val socket: Socket = IO.socket(server.socketUri, IO.Options().apply {
        path = "/ws"
        auth = mapOf("token" to token)
        forceNew = true
        reconnection = false
        timeout = 8000
        callFactory = server.socketClient
        webSocketFactory = server.socketClient
    })

    init {
        socket.on(Socket.EVENT_CONNECT) { if (!closed) onConnect() }
        socket.on(Socket.EVENT_DISCONNECT) { if (!closed) onDisconnect(false) }
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            if (!closed) {
                val code = (args.firstOrNull() as? JSONObject)?.optJSONObject("data")?.optString("code")
                onDisconnect(code?.startsWith("TOKEN_") == true)
            }
        }
        socket.onAnyIncoming { args ->
            if (!closed) {
                val name = args.firstOrNull() as? String
                if (name != null) {
                    val payload = args.getOrNull(1)
                    val value = when (payload) {
                        is JSONObject, is JSONArray -> runCatching {
                            wireJson.parseToJsonElement(payload.toString())
                        }.getOrNull()
                        is String -> JsonPrimitive(payload)
                        is Number -> JsonPrimitive(payload)
                        is Boolean -> JsonPrimitive(payload)
                        else -> JsonNull
                    }
                    if (value != null) onEvent(name, value)
                }
            }
        }
    }

    fun start() { socket.connect() }

    fun send(name: String, data: JsonObject? = null): Boolean {
        if (closed || !socket.connected()) return false
        val payload = data?.let { JSONObject(it.toString()) }
        // Check on Socket.IO's own event thread immediately before emit. A disconnected
        // Socket otherwise buffers the packet and can flush it on a later connection.
        EventThread.exec {
            if (!closed && socket.connected()) {
                if (payload == null) socket.emit(name) else socket.emit(name, payload)
            }
        }
        return true
    }

    fun close() {
        closed = true
        socket.off()
        socket.offAnyIncoming()
        socket.disconnect()
    }
}
