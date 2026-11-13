package com.monero2014.engine

import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import java.text.Normalizer

/** Preserve the existing verifier format and work factor, using Android's native crypto. */
internal fun deriveLockSecret(secret: String, saltHex: String, iterations: Int): String {
  require(iterations in 60000..1000000 && saltHex.matches(Regex("[0-9a-f]{32}")))
  val salt = saltHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  val chars = Normalizer.normalize(secret, Normalizer.Form.NFKC).toCharArray()
  val spec = PBEKeySpec(chars, salt, iterations, 256)
  try {
    val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    try { return bytes.joinToString("") { "%02x".format(it.toInt() and 255) } }
    finally { bytes.fill(0) }
  } finally { spec.clearPassword(); chars.fill('\u0000'); salt.fill(0) }
}
