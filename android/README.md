# GoHoot Android

Open the **android** directory in Android Studio. The app runs on Android 8.0 and later. The local APK targets Android 16 and uses JDK 17, the Android 36 SDK, and the checked-in Gradle 8.13 wrapper.

Run the Gradle wrapper from the Android project directory.

    .\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug

The debug-signed APK is written to **app/build/outputs/apk/debug/app-debug.apk**. Install it from Android Studio or use the following ADB command.

    adb install -r app/build/outputs/apk/debug/app-debug.apk

Tap **Set server** and enter the origin you use for GoHoot in your browser. On the Android emulator, a server running on the same PC is reachable at **http://10.0.2.2:3000** when GoHoot is serving on port 3000. On a phone, use the server's HTTPS URL or its reachable LAN HTTP address and port. For LAN HTTP, enter the scheme explicitly. DNS for plain HTTP is limited to private, loopback, and link-local addresses. To join from a QR invitation, open the invite in a scanner and paste or share the link into GoHoot.

The app uses the repository’s existing GoHoot server, account roles, signed sessions, join tickets, and live game events. Player history and solo results use the same server-side data as the browser. Hosts can switch to **Presenter view** from the live game menu. Reports use Android’s file picker to save an Excel workbook.

## Performance checks

Run the Macrobenchmark on a physical device to measure cold launch, round transitions, and puzzle reordering.

    .\gradlew.bat :benchmark:connectedBenchmarkAndroidTest

The benchmark launches a local game fixture, so it can measure the same Compose controls without needing a server. It reports frame duration and deadline overrun. Check the measured frame deadlines on a high-refresh device with animations enabled. The benchmark target uses a separate application ID, so it can run alongside the local debug APK.
