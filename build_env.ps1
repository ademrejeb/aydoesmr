# TechDebt AI - Build Environment Setup
# Run this before cargo commands, or source it: . .\build_env.ps1

$msvcRoot = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
$sdkVer = "10.0.26100.0"
$sdkRoot = "C:\Program Files (x86)\Windows Kits\10"

$env:LIB = "$msvcRoot\lib\x64;$sdkRoot\Lib\$sdkVer\ucrt\x64;$sdkRoot\Lib\$sdkVer\um\x64;$sdkRoot\Lib\$sdkVer\shared\x64"
$env:INCLUDE = "$msvcRoot\include;$sdkRoot\Include\$sdkVer\ucrt;$sdkRoot\Include\$sdkVer\um;$sdkRoot\Include\$sdkVer\winrt;$sdkRoot\Include\$sdkVer\shared"
$env:PATH = "$msvcRoot\bin\HostX64\x64;$env:USERPROFILE\.cargo\bin;$env:PATH"

Write-Host "Build environment ready." -ForegroundColor Green
