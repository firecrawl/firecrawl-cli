#!/usr/bin/env bash
set -euo pipefail

# Firecrawl CLI installer
# Usage: curl -fsSL https://firecrawl.dev/install.sh | bash
#
# Detects OS/arch, downloads the correct binary from GitHub Releases,
# verifies checksum, and installs to ~/.local/bin (or /usr/local/bin with sudo).
#
# Environment variables:
#   FIRECRAWL_INSTALL_DIR  - Override install directory (default: ~/.local/bin)
#   FIRECRAWL_VERSION      - Install a specific version (default: latest)

REPO="firecrawl/cli"
BINARY_NAME="firecrawl"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' RESET=''
fi

info()  { echo -e "${BLUE}${BOLD}info${RESET}  $*"; }
warn()  { echo -e "${YELLOW}${BOLD}warn${RESET}  $*"; }
error() { echo -e "${RED}${BOLD}error${RESET} $*" >&2; }
success() { echo -e "${GREEN}${BOLD}success${RESET} $*"; }

detect_os() {
  local os
  os="$(uname -s)"
  case "$os" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) error "Unsupported OS: $os"; exit 1 ;;
  esac
}

detect_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)  echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) error "Unsupported architecture: $arch"; exit 1 ;;
  esac
}

get_latest_version() {
  local url="https://api.github.com/repos/${REPO}/releases/latest"
  local version

  if command -v curl &>/dev/null; then
    version=$(curl -fsSL "$url" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  elif command -v wget &>/dev/null; then
    version=$(wget -qO- "$url" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one and retry."
    exit 1
  fi

  if [ -z "$version" ]; then
    error "Could not determine latest version. Check https://github.com/${REPO}/releases"
    exit 1
  fi

  # Strip leading 'v' if present
  echo "${version#v}"
}

download() {
  local url="$1"
  local dest="$2"

  if command -v curl &>/dev/null; then
    curl -fsSL --progress-bar "$url" -o "$dest"
  elif command -v wget &>/dev/null; then
    wget -q --show-progress "$url" -O "$dest"
  fi
}

verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual

  if command -v shasum &>/dev/null; then
    actual=$(shasum -a 256 "$file" | awk '{print $1}')
  elif command -v sha256sum &>/dev/null; then
    actual=$(sha256sum "$file" | awk '{print $1}')
  else
    warn "No SHA256 tool found — skipping checksum verification"
    return 0
  fi

  if [ "$actual" != "$expected" ]; then
    error "Checksum mismatch!"
    error "  Expected: $expected"
    error "  Actual:   $actual"
    exit 1
  fi
}

ensure_path() {
  local dir="$1"
  local shell_name
  shell_name="$(basename "${SHELL:-/bin/sh}")"

  case ":$PATH:" in
    *":$dir:"*) return ;;  # already in PATH
  esac

  local rc_file
  case "$shell_name" in
    zsh)  rc_file="$HOME/.zshrc" ;;
    bash) rc_file="$HOME/.bashrc" ;;
    fish) rc_file="$HOME/.config/fish/config.fish" ;;
    *)    rc_file="$HOME/.profile" ;;
  esac

  echo "" >> "$rc_file"
  if [ "$shell_name" = "fish" ]; then
    echo "set -gx PATH \"$dir\" \$PATH" >> "$rc_file"
  else
    echo "export PATH=\"$dir:\$PATH\"" >> "$rc_file"
  fi

  warn "$dir was not in your PATH. Added it to $rc_file"
  warn "Run 'source $rc_file' or open a new terminal to use firecrawl."
}

main() {
  local os arch version install_dir binary_suffix=""

  os="$(detect_os)"
  arch="$(detect_arch)"

  if [ "$os" = "windows" ]; then
    error "This script is for macOS/Linux. On Windows, use:"
    error "  irm https://firecrawl.dev/install.ps1 | iex"
    exit 1
  fi

  info "Detected platform: ${os}-${arch}"

  # Determine version
  if [ -n "${FIRECRAWL_VERSION:-}" ]; then
    version="${FIRECRAWL_VERSION#v}"
    info "Installing specified version: v$version"
  else
    info "Fetching latest version..."
    version="$(get_latest_version)"
    info "Latest version: v$version"
  fi

  # Determine install directory
  install_dir="${FIRECRAWL_INSTALL_DIR:-$HOME/.local/bin}"
  mkdir -p "$install_dir"

  # Construct download URLs
  local binary_name="${BINARY_NAME}-${os}-${arch}"
  local base_url="https://github.com/${REPO}/releases/download/v${version}"
  local binary_url="${base_url}/${binary_name}.tar.gz"
  local checksum_url="${base_url}/checksums.txt"

  # Download to temp directory
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  info "Downloading firecrawl v${version} for ${os}-${arch}..."
  download "$binary_url" "$tmp_dir/firecrawl.tar.gz"

  info "Downloading checksums..."
  download "$checksum_url" "$tmp_dir/checksums.txt"

  # Verify checksum
  local expected_checksum
  expected_checksum=$(grep "${binary_name}.tar.gz" "$tmp_dir/checksums.txt" | awk '{print $1}')
  if [ -n "$expected_checksum" ]; then
    info "Verifying checksum..."
    verify_checksum "$tmp_dir/firecrawl.tar.gz" "$expected_checksum"
  else
    warn "No checksum found for ${binary_name}.tar.gz — skipping verification"
  fi

  # Extract and install
  info "Extracting..."
  tar -xzf "$tmp_dir/firecrawl.tar.gz" -C "$tmp_dir"

  info "Installing to ${install_dir}/firecrawl..."
  mv "$tmp_dir/$binary_name" "$install_dir/firecrawl" 2>/dev/null \
    || mv "$tmp_dir/firecrawl" "$install_dir/firecrawl"
  chmod +x "$install_dir/firecrawl"

  # Ensure PATH includes install dir
  ensure_path "$install_dir"

  echo ""
  success "Firecrawl CLI v${version} installed successfully!"
  echo ""
  echo "  Run 'firecrawl --help' to get started."
  echo "  Run 'firecrawl login' to authenticate with your API key."
  echo ""
}

main "$@"
