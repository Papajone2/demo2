package com.monero2014.engine

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.util.Log
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NetworkAndLockTest {
  @Test fun communityDefaultMigratesWithoutReplacingCustomOrTorNodes() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val engine = WalletEngine(context)
    engine.erase()
    val prefs = context.getSharedPreferences("native-wallets-v1", android.content.Context.MODE_PRIVATE)
    try {
      prefs.edit().putString("daemon-0", "https://xmr.nodely.dev:18089").commit()
      engine.create("Node policy", "", "0", 0)
      assertEquals("https://xmr-node.cakewallet.com:18081", engine.snapshot()["daemon"])
      // Later explicit choices must not be repeatedly overwritten.
      prefs.edit().putString("daemon-0", "https://xmr.nodely.dev:18089").commit()
      assertEquals("https://xmr.nodely.dev:18089", engine.snapshot()["daemon"])
      prefs.edit().putString("daemon-0", "https://example.com:18089").commit()
      assertEquals("https://example.com:18089", engine.snapshot()["daemon"])
      val onion = "http://" + "b".repeat(56) + ".onion:18089"
      prefs.edit().putBoolean("tor", true).putString("daemon-0", onion).commit()
      assertEquals(onion, engine.snapshot()["daemon"])
    } finally { engine.erase() }
  }
  @Test fun torPolicyFailsClosedAndBackgroundStopsSync() {
    assertEquals("https", validateNode("https://example.com:18089", false).scheme)
    for (url in listOf("http://example.com", "https://user:pass@example.com", "https://example.com?x=1")) {
      assertTrue(runCatching { validateNode(url, false) }.isFailure)
    }
    assertTrue(runCatching { validateNode("https://example.com", true) }.isFailure)
    assertTrue(runCatching { validateNode("http://short.onion", true) }.isFailure)
    val onion = "http://" + "a".repeat(56) + ".onion:18081"
    assertEquals("http", validateNode(onion, true).scheme)
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val engine = WalletEngine(context)
    engine.erase()
    try {
      val id = engine.create("Offline only", "", "0")["id"] as String
      // No Orbot is installed in CI. A failed connection still persists Tor
      // mode and the onion node, never falling back to a public endpoint.
      assertTrue(runCatching { engine.configureNode(onion, true) }.isFailure)
      assertEquals(true, engine.privacy()["tor"])
      assertEquals(onion, engine.snapshot()["daemon"])
      assertEquals(false, engine.snapshot()["complete"])
      assertTrue(runCatching { engine.connect("https://example.com") }.isFailure)
      engine.suspend()
      assertTrue(runCatching { engine.connect(onion) }.isFailure)
      assertEquals(1, engine.list().size)
      engine.resume(); engine.open(id)
      assertEquals("0", engine.snapshot()["available"])
    } finally { engine.erase() }
  }
  @Test fun nativeLockMatchesExistingVerifierAndIsFast() {
    val start = System.nanoTime()
    val hash = deriveLockSecret("2468", "000102030405060708090a0b0c0d0e0f", 60000)
    val millis = (System.nanoTime() - start) / 1000000
    assertEquals("087e515636df1651b1884148d6f8fe469d1cb3f79dafc9b436f6aac0711cdb4c", hash)
    Log.i("WalletTests", "Native PIN derivation: ${millis}ms, 60000 PBKDF2 iterations")
    assertTrue("Native PIN derivation exceeded five seconds", millis < 5000)
    assertTrue(deriveLockSecret("Ａbcdefgh", "000102030405060708090a0b0c0d0e0f", 60000) ==
      deriveLockSecret("Abcdefgh", "000102030405060708090a0b0c0d0e0f", 60000))
  }

  @Test fun networksRemainSeparateAndRecoveryRoundTrips() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val engine = WalletEngine(context)
    engine.erase()
    try {
      val test = engine.create("Test", "", "0")
      val testId = test["id"] as String
      assertTrue((test["address"] as String).startsWith("5"))
      assertEquals("stagenet", engine.snapshot()["network"])
      val main = engine.create("Real", "", "0", 0)
      val mainId = main["id"] as String
      assertTrue((main["address"] as String).startsWith("4"))
      assertEquals("mainnet", engine.snapshot()["network"])
      assertEquals("https://xmr-node.cakewallet.com:18081", engine.snapshot()["daemon"])
      assertTrue(main["seed"] == engine.secret(mainId, true)) // Never print recovery words in assertions.
      assertTrue(Regex("[0-9a-f]{64}").matches(engine.secret(mainId, false)))
      assertTrue(test["seed"] == engine.secret(testId, true)) // Reveal inactive account without switching networks.
      assertEquals("mainnet", engine.snapshot()["network"])
      engine.open(testId)
      assertEquals("stagenet", engine.snapshot()["network"])
      // Upgrade simulation: old public catalog entries have no network field.
      val prefs = context.getSharedPreferences("native-wallets-v1", 0)
      val catalog = org.json.JSONArray(prefs.getString("catalog", "[]"))
      assertEquals(2, catalog.length())
      for (i in 0 until catalog.length()) if (catalog.getJSONObject(i).getString("id") == testId) catalog.getJSONObject(i).remove("network")
      assertTrue(prefs.edit().putString("catalog", catalog.toString()).commit())
      assertEquals("stagenet", engine.list().first { it["id"] == testId }["network"])
      assertTrue(engine.list().first { it["id"] == testId }["needsCustomization"] == true)
      engine.profile(testId, "Original design", "monero")
      assertTrue(engine.list().first { it["id"] == testId }["needsCustomization"] == false)
      engine.close()
      engine.open(mainId)
      assertEquals("mainnet", engine.snapshot()["network"])
    } finally { engine.erase() }
  }
}
