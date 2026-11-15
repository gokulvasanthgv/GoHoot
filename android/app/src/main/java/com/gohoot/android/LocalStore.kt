package com.gohoot.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class LocalStore(context: Context) {
    private val settings = context.getSharedPreferences("gohoot", Context.MODE_PRIVATE)

    val origin: String? get() = settings.getString("server", null)

    var nickname: String
        get() = settings.getString("nickname", "").orEmpty()
        set(value) { settings.edit().putString("nickname", value).apply() }

    var theme: String
        get() = settings.getString("theme", "System") ?: "System"
        set(value) { settings.edit().putString("theme", value).apply() }

    var dynamic: Boolean
        get() = settings.getBoolean("dynamic", false)
        set(value) { settings.edit().putBoolean("dynamic", value).apply() }

    var sound: Boolean
        get() = settings.getBoolean("sound", true)
        set(value) {
            settings.edit().putBoolean("music", music).putBoolean("sound", value).apply()
        }

    var music: Boolean
        get() = settings.getBoolean("music", sound)
        set(value) { settings.edit().putBoolean("music", value).apply() }

    var haptics: Boolean
        get() = settings.getBoolean("haptics", true)
        set(value) { settings.edit().putBoolean("haptics", value).apply() }

    var volume: Float
        get() = settings.getFloat("volume", 0.45f)
        set(value) { settings.edit().putFloat("volume", value).apply() }

    fun readSession(origin: String): Session? {
        val encoded = settings.getString("session", null) ?: return null
        return runCatching {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, 12))
            cipher.updateAAD(origin.toByteArray())
            wireJson.decodeFromString<Session>(cipher.doFinal(bytes, 12, bytes.size - 12).decodeToString())
        }.getOrNull()
    }

    fun writeSession(origin: String, session: Session) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(origin.toByteArray())
        val secret = wireJson.encodeToString(Session.serializer(), session).encodeToByteArray()
        val bytes = cipher.iv + cipher.doFinal(secret)
        check(settings.edit().putString("session", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit())
    }

    fun readRoom(origin: String, clientId: String): RoomRef? =
        settings.getString("room", null)?.let { value ->
            runCatching { wireJson.decodeFromString<RoomRef>(value) }.getOrNull()
        }?.takeIf { it.origin == origin && it.clientId == clientId }

    fun writeRoom(room: RoomRef?) {
        val editor = settings.edit()
        if (room == null) editor.remove("room")
        else editor.putString("room", wireJson.encodeToString(RoomRef.serializer(), room))
        editor.apply()
    }

    fun switchOrigin(origin: String) {
        check(settings.edit().remove("session").remove("room").remove("nickname")
            .putString("server", origin).commit())
    }

    @Synchronized
    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val alias = "gohoot-session-v1"
    }
}
