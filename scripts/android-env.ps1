$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$JdkHome = Join-Path $Root ".local-android\jdk"
$SdkRoot = Join-Path $Root ".local-android\sdk"

$env:JAVA_HOME = $JdkHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:Path = "$JdkHome\bin;$SdkRoot\cmdline-tools\latest\bin;$SdkRoot\platform-tools;$env:Path"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
java -version
sdkmanager --version
