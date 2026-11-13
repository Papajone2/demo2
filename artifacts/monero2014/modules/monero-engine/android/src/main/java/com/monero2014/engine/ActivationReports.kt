package com.monero2014.engine

import android.util.Base64
import org.json.JSONObject
import java.net.URL
import java.security.KeyFactory
import java.security.SecureRandom
import java.security.interfaces.RSAPublicKey
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec
import javax.net.ssl.HttpsURLConnection

internal fun activationAad(keyId: String, eventId: String) =
  "monero-wallet/activation/v1|$keyId|$eventId".toByteArray(Charsets.UTF_8)

internal fun activationReceiptEligible(mainnet: Boolean, synchronized: Boolean, txs: List<Map<String, Any>>) =
  mainnet && synchronized && txs.any {
    it["kind"] == "in" && (it["confirmations"] as Int) >= 1 && (it["amount"] as String).toULong() > 0uL
  }

internal fun encryptActivationName(name: String, pem: String, keyId: String, eventId: String): JSONObject {
  require(Regex("^[A-Za-z0-9_-]{1,64}$").matches(keyId)) { "Invalid analytics key identifier." }
  require(pem.startsWith("-----BEGIN PUBLIC KEY-----") && !pem.contains("PRIVATE KEY")) { "Use an RSA public key, never a private key." }
  val der = Base64.decode(pem.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replace(Regex("\\s"), ""), Base64.DEFAULT)
  val publicKey = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(der)) as RSAPublicKey
  require(publicKey.modulus.bitLength() in 2048..4096) { "Use an RSA public key of 2048–4096 bits." }
  val aes = ByteArray(32).also { SecureRandom().nextBytes(it) }
  val plaintext = name.toByteArray(Charsets.UTF_8)
  try {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(aes, "AES"))
    cipher.updateAAD(activationAad(keyId, eventId))
    val sealed = cipher.doFinal(plaintext)
    val wrapping = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
    wrapping.init(Cipher.ENCRYPT_MODE, publicKey, OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT))
    fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    return JSONObject().put("v", 1).put("event", "wallet_activated").put("eventId", eventId).put("keyId", keyId)
      .put("wrappedKey", encode(wrapping.doFinal(aes))).put("iv", encode(cipher.iv)).put("ciphertext", encode(sealed))
  } finally { aes.fill(0); plaintext.fill(0) }
}

internal fun postActivation(url: String, envelope: String): Boolean {
  val target = URL(url)
  require(target.protocol == "https" && target.userInfo == null && target.query == null && target.ref == null) {
    "Use an HTTPS relay URL without credentials or query parameters."
  }
  val connection = target.openConnection() as HttpsURLConnection
  try {
    connection.instanceFollowRedirects = false
    connection.connectTimeout = 5000
    connection.readTimeout = 5000
    connection.requestMethod = "POST"
    connection.setRequestProperty("Content-Type", "application/json")
    connection.doOutput = true
    connection.outputStream.use { it.write(envelope.toByteArray(Charsets.UTF_8)) }
    return connection.responseCode in listOf(200, 202)
  } finally { connection.disconnect() }
}
