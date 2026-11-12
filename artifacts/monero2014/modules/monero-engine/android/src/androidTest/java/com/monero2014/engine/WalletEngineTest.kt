package com.monero2014.engine

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Offline, fresh stagenet wallets only. Never log a seed, key or password. */
@RunWith(AndroidJUnit4::class)
class WalletEngineTest {
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
