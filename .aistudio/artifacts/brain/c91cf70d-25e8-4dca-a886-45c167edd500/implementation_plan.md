# Android Release Build Minification and ProGuard Optimization Plan

Enable code obfuscation, dead-code stripping, and resource shrinking for the Android release build while ensuring all Capacitor bridge interfaces, JavaScript interfaces, native broadcast receivers, and home screen widgets operate seamlessly.

### User Review & Critical Decisions

> [!IMPORTANT]
> Enabling `minifyEnabled true` without explicit rules strips reflection-based plugins and `@JavascriptInterface` methods that Capacitor and WebViews require. The proposed ProGuard configuration explicitly preserves Capacitor plugin annotations, WebView bridges, custom AppWidget providers, and SMS broadcast receivers while maintaining readable line numbers in crash stack traces.

- **Confirmed Decision 1**: Set both `minifyEnabled true` and `shrinkResources true` on the `release` build type in `android/app/build.gradle`.
- **Confirmed Decision 2**: Preserve line numbers and source file attributes (`-keepattributes SourceFile,LineNumberTable`) for actionable crash diagnostics.
- **Confirmed Decision 3**: Keep Capacitor plugins (`@CapacitorPlugin`, `@PluginMethod`), `@JavascriptInterface`, and native dashboard components (`SmsReceiver`, `ScratchPadWidgetProvider`, `SpendingWidgetProvider`, `ScreenTimeWidgetProvider`).

---

### 1. Overview & Core Concept

- **What It Does**: Shrinks the final release APK size, strips unused resources, obfuscates sensitive business logic, and protects runtime reflection hooks required by Capacitor.
- **Target Persona**: Release builds distributed to users, drastically reducing download size while bolstering code protection.
- **Key Value**: Optimal APK footprint and runtime performance without runtime crashes or JavaScript bridge breaks.

---

### 2. Architecture & Configuration

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│       android/app/build.gradle       │     │   android/app/proguard-rules.pro     │
│                                      │     │                                      │
│  buildTypes {                        │     │  -keep Capacitor plugins & methods   │
│    release {                         │────>│  -keep @JavascriptInterface bridge   │
│      minifyEnabled true              │     │  -keep native widgets & receivers    │
│      shrinkResources true            │     │  -keepattributes LineNumberTable     │
│      proguardFiles ...               │     │  -dontwarn optional references       │
│    }                                 │     │                                      │
│  }                                   │     │                                      │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

#### Detailed Changes
1. **`android/app/build.gradle`**:
   - Update `buildTypes.release` to set `minifyEnabled true` and `shrinkResources true`.
2. **`android/app/proguard-rules.pro`**:
   - Add rules for Capacitor core, plugins, and bridge reflection.
   - Add rules for WebView `@JavascriptInterface`.
   - Add rules for `com.zikenn.dashboard` receivers (`SmsReceiver`) and widget providers.
   - Preserve line numbers for stack trace demangling.

---

### 3. Verification Plan

1. Verify `android/app/build.gradle` and `android/app/proguard-rules.pro` syntax.
2. Run test suite (`npm test`) and compilation verification (`compile_applet`, `lint_applet`).
3. Confirm clean integration for release builds.
