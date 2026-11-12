package com.monero2014.engine

import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MoneroEngineModule : Module() {
  private val engine by lazy { WalletEngine(requireNotNull(appContext.reactContext)) }
  override fun definition() = ModuleDefinition {
    Name("MoneroEngine")
    OnCreate {
      appContext.currentActivity?.runOnUiThread {
        appContext.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
    AsyncFunction("list") { engine.list() }
    AsyncFunction("create") { name: String, seed: String, height: String -> engine.create(name, seed, height) }
    AsyncFunction("open") { id: String -> engine.open(id) }
    AsyncFunction("connect") { url: String -> engine.connect(url) }
    AsyncFunction("snapshot") { engine.snapshot() }
    AsyncFunction("subaddress") { engine.subaddress() }
    AsyncFunction("profile") { id: String, name: String, icon: String -> engine.profile(id, name, icon) }
    AsyncFunction("remove") { id: String -> engine.remove(id) }
    AsyncFunction("prepare") { address: String, amount: String -> engine.prepare(address, amount) }
    AsyncFunction("commit") { token: String -> engine.commit(token) }
    AsyncFunction("discard") { engine.discard() }
    AsyncFunction("close") { engine.close() }
    AsyncFunction("erase") { engine.erase() }
    OnActivityEntersBackground { engine.close() }
    OnDestroy { engine.close() }
  }
}
