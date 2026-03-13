# Firecrawl CLI installer for Windows
# Usage: irm https://firecrawl.dev/install.ps1 | iex
#
# Environment variables:
#   FIRECRAWL_INSTALL_DIR  - Override install directory
#   FIRECRAWL_VERSION      - Install a specific version (default: latest)

$ErrorActionPreference = "Stop"

$Repo = "firecrawl/cli"
$BinaryName = "firecrawl"

function Write-Info($msg)    { Write-Host "info   " -ForegroundColor Blue -NoNewline; Write-Host $msg }
function Write-Warn($msg)    { Write-Host "warn   " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err($msg)     { Write-Host "error  " -ForegroundColor Red -NoNewline; Write-Host $msg }
function Write-Ok($msg)      { Write-Host "success" -ForegroundColor Green -NoNewline; Write-Host " $msg" }

function Get-LatestVersion {
    $url = "https://api.github.com/repos/$Repo/releases/latest"
    $release = Invoke-RestMethod -Uri $url -Headers @{ "User-Agent" = "firecrawl-installer" }
    return $release.tag_name -replace "^v", ""
}

function Get-Platform {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64"   { return "x64" }
        "Arm64" { return "arm64" }
        default { throw "Unsupported architecture: $arch" }
    }
}

function Install-Firecrawl {
    $arch = Get-Platform
    Write-Info "Detected platform: windows-$arch"

    # Determine version
    if ($env:FIRECRAWL_VERSION) {
        $version = $env:FIRECRAWL_VERSION -replace "^v", ""
        Write-Info "Installing specified version: v$version"
    } else {
        Write-Info "Fetching latest version..."
        $version = Get-LatestVersion
        Write-Info "Latest version: v$version"
    }

    # Determine install directory
    if ($env:FIRECRAWL_INSTALL_DIR) {
        $installDir = $env:FIRECRAWL_INSTALL_DIR
    } else {
        $installDir = "$env:LOCALAPPDATA\firecrawl\bin"
    }

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    # Construct download URLs
    $binaryFile = "$BinaryName-windows-$arch.exe"
    $baseUrl = "https://github.com/$Repo/releases/download/v$version"
    $binaryUrl = "$baseUrl/$binaryFile"
    $checksumUrl = "$baseUrl/checksums.txt"

    # Download to temp directory
    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "firecrawl-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        Write-Info "Downloading firecrawl v$version for windows-$arch..."
        Invoke-WebRequest -Uri $binaryUrl -OutFile "$tmpDir\firecrawl.exe" -UseBasicParsing

        Write-Info "Downloading checksums..."
        Invoke-WebRequest -Uri $checksumUrl -OutFile "$tmpDir\checksums.txt" -UseBasicParsing

        # Verify checksum
        $checksums = Get-Content "$tmpDir\checksums.txt"
        $expectedLine = $checksums | Where-Object { $_ -match $binaryFile }
        if ($expectedLine) {
            $expectedHash = ($expectedLine -split "\s+")[0]
            $actualHash = (Get-FileHash "$tmpDir\firecrawl.exe" -Algorithm SHA256).Hash.ToLower()
            if ($actualHash -ne $expectedHash) {
                Write-Err "Checksum mismatch!"
                Write-Err "  Expected: $expectedHash"
                Write-Err "  Actual:   $actualHash"
                exit 1
            }
            Write-Info "Checksum verified."
        } else {
            Write-Warn "No checksum found for $binaryFile — skipping verification"
        }

        # Install
        Write-Info "Installing to $installDir\firecrawl.exe..."
        Copy-Item "$tmpDir\firecrawl.exe" "$installDir\firecrawl.exe" -Force

        # Add to PATH if needed
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$installDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$installDir;$userPath", "User")
            Write-Warn "$installDir added to your PATH. Restart your terminal for changes to take effect."
        }

        Write-Host ""
        Write-Ok "Firecrawl CLI v$version installed successfully!"
        Write-Host ""
        Write-Host "  Run 'firecrawl --help' to get started."
        Write-Host "  Run 'firecrawl login' to authenticate with your API key."
        Write-Host ""
    } finally {
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }
}

Install-Firecrawl
