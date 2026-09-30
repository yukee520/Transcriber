package com.rntest

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Passing null prevents Android from restoring the fragment state,
    // which react-native-screens cannot handle. Without this, the app
    // crashes when returning from background after the OS killed the
    // process (see react-native-screens issue #17).
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "rn-blank-template"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
