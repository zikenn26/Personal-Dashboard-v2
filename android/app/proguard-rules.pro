# ProGuard / R8 optimization and obfuscation rules for Zikenn Dashboard

# -----------------------------------------------------------------------------
# General Attributes & Diagnostics
# -----------------------------------------------------------------------------
# Preserve line numbers and source file names for crash reporting and stack traces
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes Signature

# -----------------------------------------------------------------------------
# WebView & JavaScript Interface Bridges
# -----------------------------------------------------------------------------
# Essential for Capacitor and WebView JS communication
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# -----------------------------------------------------------------------------
# Capacitor Core & Plugin Architecture
# -----------------------------------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}
-keep class com.getcapacitor.BridgeActivity { *; }
-keep class com.getcapacitor.Bridge { *; }
-keep class com.getcapacitor.Plugin { *; }

# Cordova compatibility plugins
-keep class org.apache.cordova.** { *; }
-keep interface org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**
-dontwarn com.getcapacitor.**

# -----------------------------------------------------------------------------
# Native App Components, Receivers, and Widgets
# -----------------------------------------------------------------------------
-keep class com.zikenn.dashboard.MainActivity { *; }
-keep class com.zikenn.dashboard.SmsReceiver { *; }
-keep class com.zikenn.dashboard.ScratchPadWidgetProvider { *; }
-keep class com.zikenn.dashboard.SpendingWidgetProvider { *; }
-keep class com.zikenn.dashboard.ScreenTimeWidgetProvider { *; }

# AndroidX Core & FileProvider
-keep class androidx.core.content.FileProvider { *; }
-keep class androidx.appcompat.** { *; }
-keep class androidx.core.app.NotificationCompat** { *; }

# -----------------------------------------------------------------------------
# Suppress benign missing class warnings
# -----------------------------------------------------------------------------
-dontwarn com.google.android.gms.**
-dontwarn okhttp3.**
-dontwarn okio.**
