package com.monero2014.engine

import android.util.Base64
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyPairGenerator
import java.security.spec.MGF1ParameterSpec
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

@RunWith(AndroidJUnit4::class)
class ActivationEncryptionTest {
  @Test fun onlyConfirmedPositiveMainnetIncomeQualifiesAfterSync() {
    val income: Map<String, Any> = mapOf("kind" to "in", "confirmations" to 1, "amount" to "1")
    assertTrue(activationReceiptEligible(true, true, listOf(income)))
    assertFalse(activationReceiptEligible(false, true, listOf(income)))
    assertFalse(activationReceiptEligible(true, false, listOf(income)))
    assertFalse(activationReceiptEligible(true, true, emptyList()))
    assertFalse(activationReceiptEligible(true, true, listOf(income + ("kind" to "out"))))
    assertFalse(activationReceiptEligible(true, true, listOf(income + ("confirmations" to 0))))
    assertFalse(activationReceiptEligible(true, true, listOf(income + ("amount" to "0"))))
  }

  @Test fun nameEnvelopeRoundTripAndAuthenticatedMetadata() {
    val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    val pem = "-----BEGIN PUBLIC KEY-----\n" + Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP) + "\n-----END PUBLIC KEY-----"
    val id = UUID.randomUUID().toString()
    val report = encryptActivationName("Name fixture", pem, "names-v1", id)
    assertEquals(setOf("v", "event", "eventId", "keyId", "wrappedKey", "iv", "ciphertext"), report.keys().asSequence().toSet())
    val wrapping = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
    wrapping.init(Cipher.DECRYPT_MODE, pair.private, OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT))
    val aes = wrapping.doFinal(Base64.decode(report.getString("wrappedKey"), Base64.NO_WRAP))
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      val iv = Base64.decode(report.getString("iv"), Base64.NO_WRAP)
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(aes, "AES"), GCMParameterSpec(128, iv))
      cipher.updateAAD(activationAad("names-v1", id))
      assertEquals("Name fixture", String(cipher.doFinal(Base64.decode(report.getString("ciphertext"), Base64.NO_WRAP))))
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(aes, "AES"), GCMParameterSpec(128, iv))
      cipher.updateAAD(activationAad("changed", id))
      var rejected = false
      try { cipher.doFinal(Base64.decode(report.getString("ciphertext"), Base64.NO_WRAP)) } catch (_: Exception) { rejected = true }
      assertTrue("Changed metadata must fail authentication", rejected)
      assertNotEquals(report.getString("ciphertext"), encryptActivationName("Name fixture", pem, "names-v1", id).getString("ciphertext"))
    } finally { aes.fill(0) }
  }

  @Test fun encryptedCatalogMigrationPreservesWalletAndBindsNameToId() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val engine = WalletEngine(context)
    engine.erase()
    try {
      val created = engine.create("Name fixture", "", "0")
      val id = created["id"] as String
      val address = created["address"]
      val prefs = context.getSharedPreferences("native-wallets-v1", Context.MODE_PRIVATE)
      var catalog = JSONArray(prefs.getString("catalog", "[]"))
      assertFalse(catalog.getJSONObject(0).has("name"))
      assertEquals("Name fixture", engine.list().first()["name"])
      val name = catalog.getJSONObject(0).getString("encryptedName")
      var rejected = false
      try { WalletNames().decrypt(UUID.randomUUID().toString(), name) } catch (_: Exception) { rejected = true }
      assertTrue("Encrypted name must be bound to its wallet", rejected)
      catalog.getJSONObject(0).remove("encryptedName")
      catalog.getJSONObject(0).put("name", "Legacy fixture")
      assertTrue(prefs.edit().putString("catalog", catalog.toString()).commit())
      assertEquals("Legacy fixture", engine.list().first()["name"])
      catalog = JSONArray(prefs.getString("catalog", "[]"))
      assertFalse("Migrated catalog must not retain plaintext name", catalog.getJSONObject(0).has("name"))
      engine.close()
      assertEquals(address, engine.open(id)["address"])
      assertFalse(catalog.getJSONObject(0).optBoolean("activationDisclosed", false))
      engine.profile(id, "Renamed fixture", "monero", true)
      assertEquals("Renamed fixture", engine.list().first()["name"])
      // No mainnet receipt or live network is used by this fixture.
      engine.reportActivation("""{"enabled":true}""")
      assertFalse(prefs.getBoolean("activation-sent-$id", false))
    } finally { engine.erase() }
  }
}
