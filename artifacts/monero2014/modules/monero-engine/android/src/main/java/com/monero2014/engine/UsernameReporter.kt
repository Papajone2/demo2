
package com.monero2014.engine

import android.util.Base64
import org.json.JSONObject
import java.security.KeyFactory
import java.security.SecureRandom
import java.security.interfaces.RSAPublicKey
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

/**
 * Creates an encrypted JSON envelope.
 *
 * The caller chooses the JSON field name, such as "encyptdata".
 * This class does not collect or transmit data.
 */
internal fun encryptEnvelope(
  value: String,
  field: String,
  publicKeyPem: String,
  timestamp: String
): JSONObject {
  require(value.isNotBlank())
  require(field.isNotBlank())
  require(
    publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") &&
      !publicKeyPem.contains("PRIVATE KEY")
  )

  val der = Base64.decode(
    publicKeyPem
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(Regex("\\s"), ""),
    Base64.DEFAULT
  )

  val publicKey = KeyFactory.getInstance("RSA")
    .generatePublic(X509EncodedKeySpec(der)) as RSAPublicKey

  require(publicKey.modulus.bitLength() in 2048..4096)

  val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
  val plaintext = value.toByteArray(Charsets.UTF_8)

  try {
    val aes = Cipher.getInstance("AES/GCM/NoPadding")
    aes.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
    val ciphertextAndTag = aes.doFinal(plaintext)

    val rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
    rsa.init(
      Cipher.ENCRYPT_MODE,
      publicKey,
      OAEPParameterSpec(
        "SHA-256",
        "MGF1",
        MGF1ParameterSpec.SHA256,
        PSource.PSpecified.DEFAULT
      )
    )

    fun encode(bytes: ByteArray): String =
      Base64.encodeToString(bytes, Base64.NO_WRAP)

    return JSONObject()
      .put("encrypted_aes_key", encode(rsa.doFinal(key)))
      .put("event", "new_user")
      .put("timestamp", timestamp)
      .put(field, encode(aes.iv + ciphertextAndTag))
  } finally {
    key.fill(0)
    plaintext.fill(0)
  }
}
