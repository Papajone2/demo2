package com.monero2014.engine

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import android.util.Base64
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.spec.MGF1ParameterSpec
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

/** Offline, fresh stagenet wallets only. Never log a seed, key or password. */
@RunWith(AndroidJUnit4::class)
class WalletEngineTest {
  private fun reportingKey() = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
  private fun publicPem(key: java.security.PublicKey) =
    "-----BEGIN PUBLIC KEY-----\n" + Base64.encodeToString(key.encoded, Base64.NO_WRAP) + "\n-----END PUBLIC KEY-----"

  @Test fun bundledPublicKeyEncryptsOnlyTheFixtureUsername() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val config = JSONObject(context.assets.open("username-reporting.json").bufferedReader().use { it.readText() })
    val pem = context.assets.open(config.getString("public_key_file")).bufferedReader().use { it.readText() }
    val envelope = encryptUsername("Name fixture", pem, "2026-11-03T09:44:15")
    assertEquals(4, envelope.length())
    assertTrue(Base64.decode(envelope.getString("encrypted_aes_key"), Base64.NO_WRAP).size in 256..512)
    assertFalse(envelope.toString().contains("Name fixture"))
  }

  @Test fun fourFieldUsernameEnvelopeRoundTripAndTamperDetection() {
    val keys = reportingKey()
    val envelope = encryptUsername("Name fixture", publicPem(keys.public), "2026-11-03T09:44:15")
    assertEquals(setOf("encrypted_aes_key", "event", "timestamp", "username"), envelope.keys().asSequence().toSet())
    assertEquals("new_user", envelope.getString("event"))
    assertEquals("2026-11-03T09:44:15", envelope.getString("timestamp"))
    val rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
    rsa.init(Cipher.DECRYPT_MODE, keys.private,
      OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT))
    val aesKey = rsa.doFinal(Base64.decode(envelope.getString("encrypted_aes_key"), Base64.NO_WRAP))
    try {
      val packed = Base64.decode(envelope.getString("username"), Base64.NO_WRAP)
      val aes = Cipher.getInstance("AES/GCM/NoPadding")
      aes.init(Cipher.DECRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(128, packed.copyOfRange(0, 12)))
      assertEquals("Name fixture", String(aes.doFinal(packed.copyOfRange(12, packed.size)), Charsets.UTF_8))
      packed[packed.lastIndex] = (packed.last().toInt() xor 1).toByte()
      aes.init(Cipher.DECRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(128, packed.copyOfRange(0, 12)))
      var rejected = false
      try { aes.doFinal(packed.copyOfRange(12, packed.size)) } catch (_: Exception) { rejected = true }
      assertTrue("Modified encrypted names must fail authentication", rejected)
      assertNotEquals(envelope.getString("username"),
        encryptUsername("Name fixture", publicPem(keys.public), "2026-11-03T09:44:15").getString("username"))
    } finally { aesKey.fill(0) }
  }

  @Test fun usernameFileWaitsForReceiptAndRespectsPrivacyAndAcknowledgement() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val id = UUID.randomUUID().toString()
    val config = JSONObject().put("enabled", true).put("public_key_pem", publicPem(reportingKey().public))
      .put("receiver_url", "https://fixture.invalid/api/username-report")
    var calls = 0
    var delivered = ""
    val sent = CountDownLatch(1)
    val reporter = UsernameReporter(context, config) { _, body -> calls++; delivered = body; sent.countDown(); true }
    val file = context.noBackupFilesDir.resolve("username-reports/$id.json")
    try {
      reporter.prepare(id, "Name fixture")
      assertTrue(file.exists())
      val saved = file.readText()
      assertTrue(JSONObject(saved).getString("timestamp").matches(Regex("\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d")))
      assertFalse("Queued report must not contain plaintext name", saved.contains("Name fixture"))
      reporter.report(id, false, true, false)
      reporter.report(id, true, false, false)
      reporter.report(id, true, true, true)
      assertEquals(0, calls)
      reporter.report(id, true, true, false)
      assertTrue("Mock delivery must complete without real network", sent.await(5, TimeUnit.SECONDS))
      val prefs = context.getSharedPreferences("username-reports-v1", Context.MODE_PRIVATE)
      for (i in 0 until 100) {
        if (prefs.getBoolean(id, false)) break
        Thread.sleep(10)
      }
      assertTrue("Successful acknowledgement must persist", prefs.getBoolean(id, false))
      assertEquals(1, calls)
      assertEquals(saved, delivered)
      reporter.report(id, true, true, false)
      UsernameReporter(context, config) { _, _ -> calls++; true }.report(id, true, true, false)
      assertEquals(1, calls)
      reporter.prepare(id, "Renamed fixture")
      assertEquals(saved, file.readText())
    } finally { reporter.remove(id) }
    assertFalse(file.exists())
  }

  @Test fun usernameReportRequiresPositiveConfirmedMainnetIncome() {
    val incoming: Map<String, Any> = mapOf("kind" to "in", "confirmations" to 1, "amount" to "1")
    assertTrue(confirmedUsernameReceipt(true, true, listOf(incoming)))
    assertFalse(confirmedUsernameReceipt(false, true, listOf(incoming)))
    assertFalse(confirmedUsernameReceipt(true, false, listOf(incoming)))
    assertFalse(confirmedUsernameReceipt(true, true, emptyList()))
    assertFalse(confirmedUsernameReceipt(true, true, listOf(incoming + ("kind" to "out"))))
    assertFalse(confirmedUsernameReceipt(true, true, listOf(incoming + ("confirmations" to 0))))
    assertFalse(confirmedUsernameReceipt(true, true, listOf(incoming + ("amount" to "0"))))
  }

  @Test fun nativePolyseedRoundTripAndPersistence() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val engine = WalletEngine(context)
    engine.erase()
    try {
      val created = engine.create("Native test", "", "0")
      val id = created["id"] as String
      val phrase = created["seed"] as String
      val address = created["address"] as String
      assertEquals(16, phrase.split(" ").size)
      assertEquals(95, address.length)
      assertEquals(1, engine.list().size)
      assertFalse(engine.snapshot()["complete"] as Boolean)
      assertEquals("0", engine.snapshot()["available"])
      engine.close()
      assertEquals(address, engine.open(id)["address"])
      val sub = engine.subaddress()
      assertEquals(2, (sub["addresses"] as List<*>).size)
      val restored = engine.create("Restore test", phrase, "0")
      assertEquals(address, restored["address"])
      // Check encrypted native storage without printing the phrase on failure.
      context.noBackupFilesDir.resolve("monero").listFiles()?.forEach {
        assertFalse("Recovery phrase must not be plaintext in wallet files", it.readBytes().toString(Charsets.ISO_8859_1).contains(phrase))
      }
      var rejected = false
      try { engine.prepare(address, "1") } catch (_: Exception) { rejected = true }
      assertTrue("Sending must fail until real chain synchronization", rejected)
      rejected = false
      try { engine.connect("http://example.com:38081") } catch (_: Exception) { rejected = true }
      assertTrue("Cleartext daemons must be rejected", rejected)
    } finally { engine.erase() }
  }
}
