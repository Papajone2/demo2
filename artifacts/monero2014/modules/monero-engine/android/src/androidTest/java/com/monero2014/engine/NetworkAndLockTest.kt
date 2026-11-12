package com.monero2014.engine

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.util.Log
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NetworkAndLockTest {
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
      assertEquals("https://xmr.nodely.dev:18089", engine.snapshot()["daemon"])
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
