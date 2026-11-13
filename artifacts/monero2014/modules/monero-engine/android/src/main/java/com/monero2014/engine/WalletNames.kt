package com.monero2014.engine

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class WalletNames {
  private fun key(): SecretKey {
    val alias = "monero-wallet-names-v1"
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }

  fun encrypt(id: String, name: String): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    cipher.updateAAD("wallet-name-v1:$id".toByteArray())
    return Base64.encodeToString(cipher.iv + cipher.doFinal(name.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
  }

  fun decrypt(id: String, encrypted: String): String {
    val bytes = Base64.decode(encrypted, Base64.NO_WRAP)
    require(bytes.size >= 28) { "Encrypted wallet name is unreadable." }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
    cipher.updateAAD("wallet-name-v1:$id".toByteArray())
    return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }
}
