
package com.monero2014.engine

import android.content.Context
import org.json.JSONObject
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

internal class PreferencesWebhookReporter(context: Context) {

    private val config = JSONObject(
        context.assets.open("username-reporting.json")
            .bufferedReader().use { it.readText() }
    )

    private val executor = Executors.newSingleThreadExecutor()

    fun sendAsync(
        encryptedEnvelope: JSONObject,
        userConsented: Boolean,
        onComplete: ((Result<Int>) -> Unit)? = null
    ) {
        executor.execute {
            val result = runCatching {
                require(userConsented) {
                    "User consent is required before sending preferences"
                }
                send(encryptedEnvelope)
            }

            onComplete?.invoke(result)
        }
    }

    private fun send(envelope: JSONObject): Int {
        check(config.optBoolean("enabled", false)) {
            "Webhook reporting is disabled"
        }

        require(envelope.has("username")) {
            "Encrypted envelope is missing username"
        }

        require(envelope.has("encrypted_aes_key")) {
            "Encrypted envelope is missing encrypted_aes_key"
        }

        val receiver = config.getString("receiver_url")
        require(receiver.startsWith("https://")) {
            "HTTPS receiver URL required"
        }

        // Send the existing encrypted envelope unchanged.
        val body = envelope.toString()

        val digest = MessageDigest.getInstance("SHA-256")
            .digest(body.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

        val connection =
            URL(receiver).openConnection() as HttpsURLConnection

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.doOutput = true

            connection.setRequestProperty(
                "Content-Type",
                "application/json"
            )
            connection.setRequestProperty(
                "Idempotency-Key",
                digest
            )

            connection.outputStream.use { output ->
                output.write(body.toByteArray(Charsets.UTF_8))
            }

            val status = connection.responseCode

            check(status in 200..299) {
                "Webhook returned HTTP $status"
            }

            return status
        } finally {
            connection.disconnect()
        }
    }
}
