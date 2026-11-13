package com.monero2014.engine

import android.content.Context
import android.os.SystemClock
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.net.URL
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.interfaces.RSAPublicKey
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec
import javax.net.ssl.HttpsURLConnection

internal fun confirmedUsernameReceipt(mainnet: Boolean, synced: Boolean, txs: List<Map<String, Any>>) =
  mainnet && synced && txs.any {
    it["kind"] == "in" && (it["confirmations"] as Int) >= 1 && (it["amount"] as String).toULong() > 0uL
  }

internal fun encryptUsername(username: String, publicKeyPem: String, timestamp: String): JSONObject {
  require(username.isNotBlank() && username.codePointCount(0, username.length) <= 16)
  return encryptEnvelope(username, "username", publicKeyPem, timestamp)
}

internal fun encryptEnvelope(value: String, field: String, publicKeyPem: String, timestamp: String): JSONObject {
  require(publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") && !publicKeyPem.contains("PRIVATE KEY"))
  val der = Base64.decode(publicKeyPem.replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "").replace(Regex("\\s"), ""), Base64.DEFAULT)
  val publicKey = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(der)) as RSAPublicKey
  require(publicKey.modulus.bitLength() in 2048..4096)
  val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
  val plaintext = value.toByteArray(Charsets.UTF_8)
  try {
    val aes = Cipher.getInstance("AES/GCM/NoPadding")
    aes.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
    val ciphertextAndTag = aes.doFinal(plaintext)
    val rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
    rsa.init(Cipher.ENCRYPT_MODE, publicKey,
      OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT))
    fun encode(value: ByteArray) = Base64.encodeToString(value, Base64.NO_WRAP)
    return JSONObject().put("encrypted_aes_key", encode(rsa.doFinal(key)))
      .put("event", "new_user").put("timestamp", timestamp)
      .put(field, encode(aes.iv + ciphertextAndTag))
  } finally { key.fill(0); plaintext.fill(0) }
}

internal fun postUsername(receiver: String, body: String): Boolean {
  val url = URL(receiver)
  require(url.protocol == "https" && url.userInfo == null && url.query == null && url.ref == null)
  val connection = url.openConnection() as HttpsURLConnection
  try {
    connection.instanceFollowRedirects = false
    connection.connectTimeout = 5000
    connection.readTimeout = 15000
    connection.requestMethod = "POST"
    connection.setRequestProperty("Content-Type", "application/json")
    connection.setRequestProperty("Idempotency-Key",
      MessageDigest.getInstance("SHA-256").digest(body.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) })
    connection.doOutput = true
    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
    return connection.responseCode in 200..299
  } finally { connection.disconnect() }
}

internal class UsernameReporter(
  context: Context,
  private val config: JSONObject = JSONObject(context.assets.open("username-reporting.json").bufferedReader().use { it.readText() }).apply {
    put("public_key_pem", context.assets.open(getString("public_key_file")).bufferedReader().use { it.readText() })
  },
  private val send: (String, String) -> Boolean = ::postUsername,
) {
  private val root = File(context.noBackupFilesDir, "username-reports")
  private val prefs = context.getSharedPreferences("username-reports-v1", Context.MODE_PRIVATE)
  private val attempts = mutableMapOf<String, Long>()
  private fun file(id: String): AtomicFile {
    require(UUID.fromString(id).toString() == id)
    return AtomicFile(File(root, "$id.json"))
  }
  private fun configured() = config.optBoolean("enabled", false) &&
    config.optString("public_key_pem").isNotBlank() && config.optString("receiver_url").isNotBlank()

  @Synchronized fun prepare(id: String, username: String) {
    if (!configured() || prefs.getBoolean(id, false) || file(id).baseFile.exists()) return
    val timestamp = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT)
      .withZone(ZoneOffset.UTC).format(Instant.now())
    val encrypted = encryptUsername(username, config.getString("public_key_pem"), timestamp)
    check(root.isDirectory || root.mkdirs())
    val target = file(id)
    val out = target.startWrite()
    try {
      out.write(encrypted.toString().toByteArray(Charsets.UTF_8))
      target.finishWrite(out)
    } catch (error: Exception) { target.failWrite(out); throw error }
  }

  @Synchronized fun report(id: String, eligible: Boolean, foreground: Boolean, tor: Boolean) {
    if (!configured() || !eligible || !foreground || tor || prefs.getBoolean(id, false)) return
    val target = file(id)
    if (!target.baseFile.exists() && !File(target.baseFile.path + ".bak").exists()) return
    val now = SystemClock.elapsedRealtime()
    if (attempts[id]?.let { now - it < 60000 } == true) return
    attempts[id] = now
    // Analytics network waits must not hold up the native wallet operation queue.
    Thread({
      runCatching {
        require(target.baseFile.length() <= 4096)
        val body = target.openRead().bufferedReader().use { it.readText() }
        if (send(config.getString("receiver_url"), body)) check(prefs.edit().putBoolean(id, true).commit())
      }
    }, "wallet-username-report").start()
  }

  @Synchronized fun remove(id: String) {
    file(id).delete()
    check(prefs.edit().remove(id).commit())
    attempts.remove(id)
  }
}
