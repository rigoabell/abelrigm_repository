#!/usr/bin/env python3
"""Rig Setup - new machine developer environment bootstrapper.

A tiny, dependency-free web app (Python standard library only) that detects and
installs the common tools you need to build almost anything with Cursor.

It serves a small web UI, detects the host OS and package manager, reports which
tools are already present, and installs missing ones using the right command for
the current platform (apt / dnf / pacman / zypper / Homebrew / winget / choco /
official install scripts).

Run it with:  python3 app.py   (see start.sh / start.ps1 for convenience launchers)
"""

from __future__ import annotations

import json
import os
import platform
import queue
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HOST = os.environ.get("RIG_SETUP_HOST", "127.0.0.1")
PORT = int(os.environ.get("RIG_SETUP_PORT", "8765"))
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# ---------------------------------------------------------------------------
# Tool catalog
# ---------------------------------------------------------------------------
# Each tool declares:
#   id, name, category, icon, description
#   check:   binary name used to detect the tool (via shutil.which)
#   version: argv used to print a version string (best effort, optional)
#   install: mapping of "method" -> shell command string.
#            Methods: apt, dnf, pacman, zypper, brew, winget, choco,
#                     unix_script, npm  (chosen automatically at install time)

APT = "{{SUDO}} DEBIAN_FRONTEND=noninteractive apt-get install -y"

CATALOG = [
    # ---- Core CLI ----------------------------------------------------------
    {
        "id": "git", "name": "Git", "category": "Core CLI", "icon": "\U0001F500",
        "description": "Distributed version control. The foundation of everything.",
        "check": "git", "version": ["git", "--version"],
        "install": {
            "apt": f"{APT} git", "dnf": "{{SUDO}} dnf install -y git",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm git", "zypper": "{{SUDO}} zypper install -y git",
            "brew": "brew install git",
            "winget": "winget install --id Git.Git -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install git -y",
        },
    },
    {
        "id": "curl", "name": "curl", "category": "Core CLI", "icon": "\U0001F310",
        "description": "Transfer data over the network. Used by most install scripts.",
        "check": "curl", "version": ["curl", "--version"],
        "install": {
            "apt": f"{APT} curl", "dnf": "{{SUDO}} dnf install -y curl",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm curl", "zypper": "{{SUDO}} zypper install -y curl",
            "brew": "brew install curl",
            "winget": "winget install --id cURL.cURL -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install curl -y",
        },
    },
    {
        "id": "wget", "name": "wget", "category": "Core CLI", "icon": "\U0001F4E5",
        "description": "Retrieve files from the web from the command line.",
        "check": "wget", "version": ["wget", "--version"],
        "install": {
            "apt": f"{APT} wget", "dnf": "{{SUDO}} dnf install -y wget",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm wget", "zypper": "{{SUDO}} zypper install -y wget",
            "brew": "brew install wget", "choco": "choco install wget -y",
        },
    },
    {
        "id": "jq", "name": "jq", "category": "Core CLI", "icon": "\U0001F9E9",
        "description": "Command-line JSON processor.",
        "check": "jq", "version": ["jq", "--version"],
        "install": {
            "apt": f"{APT} jq", "dnf": "{{SUDO}} dnf install -y jq",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm jq", "zypper": "{{SUDO}} zypper install -y jq",
            "brew": "brew install jq",
            "winget": "winget install --id jqlang.jq -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install jq -y",
        },
    },
    {
        "id": "gh", "name": "GitHub CLI", "category": "Core CLI", "icon": "\U0001F419",
        "description": "GitHub from the terminal: PRs, issues, repos, auth.",
        "check": "gh", "version": ["gh", "--version"],
        "install": {
            "apt": ("(type -p wget >/dev/null || {{SUDO}} apt-get install -y wget) "
                    "&& {{SUDO}} mkdir -p -m 755 /etc/apt/keyrings "
                    "&& wget -nv -O- https://cli.github.com/packages/githubcli-archive-keyring.gpg "
                    "| {{SUDO}} tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null "
                    "&& {{SUDO}} chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg "
                    "&& echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] "
                    "https://cli.github.com/packages stable main\" "
                    "| {{SUDO}} tee /etc/apt/sources.list.d/github-cli.list >/dev/null "
                    "&& {{SUDO}} apt-get update && {{SUDO}} apt-get install -y gh"),
            "dnf": "{{SUDO}} dnf install -y gh", "pacman": "{{SUDO}} pacman -Sy --noconfirm github-cli",
            "brew": "brew install gh",
            "winget": "winget install --id GitHub.cli -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install gh -y",
        },
    },
    {
        "id": "build-essential", "name": "C/C++ Build Tools", "category": "Core CLI", "icon": "\U0001F528",
        "description": "Compilers and make (gcc/g++, make). Needed to build native code.",
        "check": "gcc", "version": ["gcc", "--version"],
        "install": {
            "apt": f"{APT} build-essential",
            "dnf": "{{SUDO}} dnf groupinstall -y 'Development Tools'",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm base-devel",
            "zypper": "{{SUDO}} zypper install -y -t pattern devel_basis",
            "brew": "xcode-select --install || true",
            "choco": "choco install visualstudio2022buildtools -y",
        },
    },
    {
        "id": "ripgrep", "name": "ripgrep", "category": "Core CLI", "icon": "\U0001F50D",
        "description": "Blazing-fast recursive code/text search (rg).",
        "check": "rg", "version": ["rg", "--version"],
        "install": {
            "apt": f"{APT} ripgrep", "dnf": "{{SUDO}} dnf install -y ripgrep",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm ripgrep", "zypper": "{{SUDO}} zypper install -y ripgrep",
            "brew": "brew install ripgrep",
            "winget": "winget install --id BurntSushi.ripgrep.MSVC -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install ripgrep -y",
        },
    },
    {
        "id": "cmake", "name": "CMake", "category": "Core CLI", "icon": "\U0001F9F0",
        "description": "Cross-platform build system generator.",
        "check": "cmake", "version": ["cmake", "--version"],
        "install": {
            "apt": f"{APT} cmake", "dnf": "{{SUDO}} dnf install -y cmake",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm cmake", "zypper": "{{SUDO}} zypper install -y cmake",
            "brew": "brew install cmake",
            "winget": "winget install --id Kitware.CMake -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install cmake -y",
        },
    },

    # ---- Languages & runtimes ---------------------------------------------
    {
        "id": "python", "name": "Python 3", "category": "Languages & Runtimes", "icon": "\U0001F40D",
        "description": "Python interpreter, pip and venv.",
        "check": "python3", "version": ["python3", "--version"],
        "install": {
            "apt": f"{APT} python3 python3-pip python3-venv",
            "dnf": "{{SUDO}} dnf install -y python3 python3-pip",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm python python-pip",
            "zypper": "{{SUDO}} zypper install -y python3 python3-pip",
            "brew": "brew install python",
            "winget": "winget install --id Python.Python.3.12 -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install python -y",
        },
    },
    {
        "id": "node", "name": "Node.js", "category": "Languages & Runtimes", "icon": "\U0001F7E9",
        "description": "JavaScript runtime (includes npm). LTS release.",
        "check": "node", "version": ["node", "--version"],
        "install": {
            "apt": "curl -fsSL https://deb.nodesource.com/setup_lts.x | {{SUDO}} -E bash - && {{SUDO}} apt-get install -y nodejs",
            "dnf": "curl -fsSL https://rpm.nodesource.com/setup_lts.x | {{SUDO}} -E bash - && {{SUDO}} dnf install -y nodejs",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm nodejs npm",
            "brew": "brew install node",
            "winget": "winget install --id OpenJS.NodeJS.LTS -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install nodejs-lts -y",
        },
    },
    {
        "id": "go", "name": "Go", "category": "Languages & Runtimes", "icon": "\U0001F439",
        "description": "The Go programming language toolchain.",
        "check": "go", "version": ["go", "version"],
        "install": {
            "apt": f"{APT} golang-go", "dnf": "{{SUDO}} dnf install -y golang",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm go", "zypper": "{{SUDO}} zypper install -y go",
            "brew": "brew install go",
            "winget": "winget install --id GoLang.Go -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install golang -y",
        },
    },
    {
        "id": "rust", "name": "Rust", "category": "Languages & Runtimes", "icon": "\U0001F980",
        "description": "Rust toolchain via rustup (rustc, cargo).",
        "check": "cargo", "version": ["cargo", "--version"],
        "install": {
            "unix_script": "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
            "brew": "brew install rustup-init && rustup-init -y",
            "winget": "winget install --id Rustlang.Rustup -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install rustup.install -y",
        },
    },
    {
        "id": "java", "name": "Java (OpenJDK)", "category": "Languages & Runtimes", "icon": "\U00002615",
        "description": "OpenJDK Java Development Kit.",
        "check": "java", "version": ["java", "-version"],
        "install": {
            "apt": f"{APT} default-jdk", "dnf": "{{SUDO}} dnf install -y java-latest-openjdk-devel",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm jdk-openjdk", "zypper": "{{SUDO}} zypper install -y java-openjdk-devel",
            "brew": "brew install openjdk",
            "winget": "winget install --id EclipseAdoptium.Temurin.21.JDK -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install temurin -y",
        },
    },
    {
        "id": "ruby", "name": "Ruby", "category": "Languages & Runtimes", "icon": "\U0001F48E",
        "description": "The Ruby programming language.",
        "check": "ruby", "version": ["ruby", "--version"],
        "install": {
            "apt": f"{APT} ruby-full", "dnf": "{{SUDO}} dnf install -y ruby",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm ruby", "zypper": "{{SUDO}} zypper install -y ruby",
            "brew": "brew install ruby",
            "winget": "winget install --id RubyInstallerTeam.Ruby.3.3 -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install ruby -y",
        },
    },
    {
        "id": "php", "name": "PHP", "category": "Languages & Runtimes", "icon": "\U0001F418",
        "description": "PHP command-line interpreter.",
        "check": "php", "version": ["php", "--version"],
        "install": {
            "apt": f"{APT} php-cli", "dnf": "{{SUDO}} dnf install -y php-cli",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm php", "zypper": "{{SUDO}} zypper install -y php8",
            "brew": "brew install php", "choco": "choco install php -y",
        },
    },
    {
        "id": "dotnet", "name": ".NET SDK", "category": "Languages & Runtimes", "icon": "\U0001F7EA",
        "description": "Build C#/F# apps with the .NET SDK.",
        "check": "dotnet", "version": ["dotnet", "--version"],
        "install": {
            "apt": f"{APT} dotnet-sdk-8.0", "dnf": "{{SUDO}} dnf install -y dotnet-sdk-8.0",
            "brew": "brew install --cask dotnet-sdk",
            "winget": "winget install --id Microsoft.DotNet.SDK.8 -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install dotnet-sdk -y",
        },
    },
    {
        "id": "deno", "name": "Deno", "category": "Languages & Runtimes", "icon": "\U0001F995",
        "description": "Secure runtime for JavaScript and TypeScript.",
        "check": "deno", "version": ["deno", "--version"],
        "install": {
            "unix_script": "curl -fsSL https://deno.land/install.sh | sh",
            "brew": "brew install deno",
            "winget": "winget install --id DenoLand.Deno -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install deno -y",
        },
    },
    {
        "id": "bun", "name": "Bun", "category": "Languages & Runtimes", "icon": "\U0001F35E",
        "description": "Fast all-in-one JavaScript runtime & toolkit.",
        "check": "bun", "version": ["bun", "--version"],
        "install": {
            "unix_script": "curl -fsSL https://bun.sh/install | bash",
            "npm": "npm install -g bun",
            "winget": "winget install --id Oven-sh.Bun -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
        },
    },

    # ---- JS package managers & tooling ------------------------------------
    {
        "id": "yarn", "name": "Yarn", "category": "JS Tooling", "icon": "\U0001F9F6",
        "description": "Fast, reliable JavaScript package manager.",
        "check": "yarn", "version": ["yarn", "--version"],
        "install": {
            "npm": "npm install -g yarn", "brew": "brew install yarn",
            "winget": "winget install --id Yarn.Yarn -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install yarn -y",
        },
    },
    {
        "id": "pnpm", "name": "pnpm", "category": "JS Tooling", "icon": "\U0001F4E6",
        "description": "Fast, disk space efficient package manager.",
        "check": "pnpm", "version": ["pnpm", "--version"],
        "install": {
            "npm": "npm install -g pnpm",
            "unix_script": "curl -fsSL https://get.pnpm.io/install.sh | sh -",
            "brew": "brew install pnpm",
            "winget": "winget install --id pnpm.pnpm -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
        },
    },
    {
        "id": "typescript", "name": "TypeScript", "category": "JS Tooling", "icon": "\U0001F4D8",
        "description": "TypeScript compiler (tsc), installed globally via npm.",
        "check": "tsc", "version": ["tsc", "--version"],
        "install": {"npm": "npm install -g typescript"},
    },
    {
        "id": "vercel", "name": "Vercel CLI", "category": "JS Tooling", "icon": "\U000025B2",
        "description": "Deploy front-end projects to Vercel from the CLI.",
        "check": "vercel", "version": ["vercel", "--version"],
        "install": {"npm": "npm install -g vercel"},
    },

    # ---- Containers, cloud & DevOps ---------------------------------------
    {
        "id": "docker", "name": "Docker", "category": "Containers & Cloud", "icon": "\U0001F433",
        "description": "Build and run containers. Uses the official convenience script on Linux.",
        "check": "docker", "version": ["docker", "--version"],
        "install": {
            "apt": "curl -fsSL https://get.docker.com | {{SUDO}} sh",
            "dnf": "curl -fsSL https://get.docker.com | {{SUDO}} sh",
            "brew": "brew install --cask docker",
            "winget": "winget install --id Docker.DockerDesktop -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install docker-desktop -y",
        },
    },
    {
        "id": "kubectl", "name": "kubectl", "category": "Containers & Cloud", "icon": "\U00002638",
        "description": "The Kubernetes command-line tool.",
        "check": "kubectl", "version": ["kubectl", "version", "--client"],
        "install": {
            "apt": ('curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" '
                    "&& {{SUDO}} install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl"),
            "dnf": ('curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" '
                    "&& {{SUDO}} install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl"),
            "brew": "brew install kubectl",
            "winget": "winget install --id Kubernetes.kubectl -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install kubernetes-cli -y",
        },
    },
    {
        "id": "terraform", "name": "Terraform", "category": "Containers & Cloud", "icon": "\U0001F30D",
        "description": "Infrastructure as code by HashiCorp.",
        "check": "terraform", "version": ["terraform", "--version"],
        "install": {
            "apt": ("wget -O- https://apt.releases.hashicorp.com/gpg "
                    "| {{SUDO}} gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg "
                    "&& echo \"deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] "
                    "https://apt.releases.hashicorp.com $(lsb_release -cs) main\" "
                    "| {{SUDO}} tee /etc/apt/sources.list.d/hashicorp.list "
                    "&& {{SUDO}} apt-get update && {{SUDO}} apt-get install -y terraform"),
            "brew": "brew tap hashicorp/tap && brew install hashicorp/tap/terraform",
            "winget": "winget install --id Hashicorp.Terraform -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install terraform -y",
        },
    },
    {
        "id": "awscli", "name": "AWS CLI", "category": "Containers & Cloud", "icon": "\U00002601",
        "description": "Command-line interface for Amazon Web Services.",
        "check": "aws", "version": ["aws", "--version"],
        "install": {
            "unix_script": ('(command -v unzip >/dev/null || {{SUDO}} apt-get install -y unzip) '
                            '&& curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip '
                            "&& unzip -q -o /tmp/awscliv2.zip -d /tmp && {{SUDO}} /tmp/aws/install --update "
                            "&& rm -rf /tmp/aws /tmp/awscliv2.zip"),
            "brew": "brew install awscli",
            "winget": "winget install --id Amazon.AWSCLI -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install awscli -y",
        },
    },
    {
        "id": "gcloud", "name": "Google Cloud CLI", "category": "Containers & Cloud", "icon": "\U00002601",
        "description": "Manage Google Cloud resources from the CLI.",
        "check": "gcloud", "version": ["gcloud", "--version"],
        "install": {
            "unix_script": "curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts",
            "brew": "brew install --cask google-cloud-sdk",
            "winget": "winget install --id Google.CloudSDK -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install gcloudsdk -y",
        },
    },

    # ---- Databases ---------------------------------------------------------
    {
        "id": "postgres-client", "name": "PostgreSQL Client", "category": "Databases", "icon": "\U0001F418",
        "description": "psql and libpq client tools for PostgreSQL.",
        "check": "psql", "version": ["psql", "--version"],
        "install": {
            "apt": f"{APT} postgresql-client", "dnf": "{{SUDO}} dnf install -y postgresql",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm postgresql-libs", "zypper": "{{SUDO}} zypper install -y postgresql",
            "brew": "brew install libpq",
            "winget": "winget install --id PostgreSQL.PostgreSQL -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install postgresql -y",
        },
    },
    {
        "id": "sqlite", "name": "SQLite", "category": "Databases", "icon": "\U0001F5C4",
        "description": "Self-contained, serverless SQL database engine.",
        "check": "sqlite3", "version": ["sqlite3", "--version"],
        "install": {
            "apt": f"{APT} sqlite3", "dnf": "{{SUDO}} dnf install -y sqlite",
            "pacman": "{{SUDO}} pacman -Sy --noconfirm sqlite", "zypper": "{{SUDO}} zypper install -y sqlite3",
            "brew": "brew install sqlite",
            "winget": "winget install --id SQLite.SQLite -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install sqlite -y",
        },
    },

    # ---- Editors -----------------------------------------------------------
    {
        "id": "vscode", "name": "Visual Studio Code", "category": "Editors", "icon": "\U0001F4DD",
        "description": "Popular code editor (great companion to Cursor).",
        "check": "code", "version": ["code", "--version"],
        "install": {
            "apt": ("wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/packages.microsoft.gpg "
                    "&& {{SUDO}} install -D -o root -g root -m 644 /tmp/packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg "
                    "&& echo \"deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] "
                    "https://packages.microsoft.com/repos/code stable main\" "
                    "| {{SUDO}} tee /etc/apt/sources.list.d/vscode.list > /dev/null "
                    "&& rm -f /tmp/packages.microsoft.gpg && {{SUDO}} apt-get update && {{SUDO}} apt-get install -y code"),
            "brew": "brew install --cask visual-studio-code",
            "winget": "winget install --id Microsoft.VisualStudioCode -e --scope user --disable-interactivity --accept-source-agreements --accept-package-agreements",
            "choco": "choco install vscode -y",
        },
    },
]

# ---------------------------------------------------------------------------
# System / package-manager detection
# ---------------------------------------------------------------------------

def detect_os():
    sys_name = platform.system()
    if sys_name == "Darwin":
        return "macos"
    if sys_name == "Windows":
        return "windows"
    return "linux"


def _os_pretty():
    os_id = detect_os()
    if os_id == "linux":
        try:
            with open("/etc/os-release") as fh:
                for line in fh:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"')
        except OSError:
            pass
        return "Linux"
    if os_id == "macos":
        return f"macOS {platform.mac_ver()[0]}".strip()
    return f"{platform.system()} {platform.release()}"


PM_ORDER = {
    "linux": ["apt", "dnf", "pacman", "zypper"],
    "macos": ["brew"],
    "windows": ["winget", "choco"],
}

PM_BINARY = {
    "apt": "apt-get", "dnf": "dnf", "pacman": "pacman", "zypper": "zypper",
    "brew": "brew", "winget": "winget", "choco": "choco",
}


def available_package_managers():
    found = []
    for pm, binary in PM_BINARY.items():
        if shutil.which(binary):
            found.append(pm)
    return found


def primary_package_manager():
    os_id = detect_os()
    available = set(available_package_managers())
    for pm in PM_ORDER.get(os_id, []):
        if pm in available:
            return pm
    return available.pop() if available else None


# Package managers that always require administrator/root privileges to install
# into system locations. brew, npm, and per-user install scripts stay in the
# home directory. winget is only invoked with --scope user so it does not ask
# for an administrator password.
SYSTEM_PACKAGE_MANAGERS = {"apt", "dnf", "pacman", "zypper", "choco"}

# Placeholder embedded in every command that would need elevation. It is
# resolved at run time based on the *detected* privileges of the current user
# so the app never simply assumes it is running as an administrator.
SUDO_TOKEN = "{{SUDO}} "


def _is_windows_admin():
    try:
        import ctypes  # noqa: WPS433 (import inside function is intentional)
        return bool(ctypes.windll.shell32.IsUserAnAdmin())  # type: ignore[attr-defined]
    except Exception:
        return False


def _compute_privileges():
    """Detect what elevation is genuinely available. Never assume admin."""
    os_id = detect_os()
    if os_id == "windows":
        is_admin = _is_windows_admin()
        return {
            "is_root": is_admin,
            "sudo_available": False,
            "sudo_nopasswd": is_admin,
            "elevation": "admin" if is_admin else "none",
        }

    is_root = hasattr(os, "geteuid") and os.geteuid() == 0
    sudo_available = shutil.which("sudo") is not None
    sudo_nopasswd = False
    if not is_root and sudo_available:
        try:
            proc = subprocess.run(
                ["sudo", "-n", "true"], capture_output=True, timeout=5,
            )
            sudo_nopasswd = proc.returncode == 0
        except Exception:
            sudo_nopasswd = False

    if is_root:
        elevation = "root"
    elif sudo_nopasswd:
        elevation = "sudo"           # can elevate right now without a password
    elif sudo_available:
        elevation = "sudo-password"  # sudo exists but would need a password
    else:
        elevation = "none"           # ordinary user, no way to elevate
    return {
        "is_root": is_root,
        "sudo_available": sudo_available,
        "sudo_nopasswd": sudo_nopasswd,
        "elevation": elevation,
    }


_PRIV_CACHE = None
_PRIV_LOCK = threading.Lock()


def privilege_info(refresh=False):
    global _PRIV_CACHE
    with _PRIV_LOCK:
        if _PRIV_CACHE is None or refresh:
            _PRIV_CACHE = _compute_privileges()
        return dict(_PRIV_CACHE)


def can_elevate_noninteractive():
    """True only when we can actually run privileged commands unattended."""
    priv = privilege_info()
    return priv["is_root"] or priv["sudo_nopasswd"]


def render_command(command):
    """Resolve the {{SUDO}} placeholder for the current privilege level."""
    priv = privilege_info()
    if priv["is_root"]:
        return command.replace(SUDO_TOKEN, "")
    return command.replace(SUDO_TOKEN, "sudo ")


def method_requires_root(method, command):
    if SUDO_TOKEN.strip() in command:
        return True
    return method in SYSTEM_PACKAGE_MANAGERS


def choose_install_command(tool):
    """Pick the best install command for this host.

    Returns (command, method, needs_admin). When the current account cannot
    elevate, user-space methods (install scripts, npm, Homebrew, winget) are
    preferred over system package managers so we never assume admin rights.
    Returns (None, None, False) when nothing is applicable.
    """
    installers = tool.get("install", {})
    os_id = detect_os()
    pm = primary_package_manager()

    # Candidate methods in default preference order (package manager first).
    candidates = []
    if os_id == "windows" and "windows_script" in installers:
        candidates.append(("windows_script", installers["windows_script"]))
    if pm and pm in installers:
        candidates.append((pm, installers[pm]))
    if os_id in ("linux", "macos") and "unix_script" in installers:
        candidates.append(("unix_script", installers["unix_script"]))
    if "npm" in installers and shutil.which("npm"):
        candidates.append(("npm", installers["npm"]))
    if "brew" in installers and shutil.which("brew"):
        candidates.append(("brew", installers["brew"]))

    seen, ordered = set(), []
    for method, command in candidates:
        if method in seen:
            continue
        seen.add(method)
        ordered.append((method, command))

    if not ordered:
        return None, None, False

    no_root = [(m, c) for m, c in ordered if not method_requires_root(m, c)]
    root_req = [(m, c) for m, c in ordered if method_requires_root(m, c)]

    if can_elevate_noninteractive():
        method, command = ordered[0]
        return command, method, method_requires_root(method, command)

    # Not an admin: prefer anything that works without elevation.
    if no_root:
        method, command = no_root[0]
        return command, method, False
    method, command = root_req[0]
    return command, method, True


def _augmented_path():
    """PATH plus the per-user bin dirs where no-admin installers place binaries."""
    home = os.path.expanduser("~")
    extra = [
        os.path.join(home, ".local", "bin"),
        os.path.join(home, "bin"),
        os.path.join(home, ".cargo", "bin"),
        os.path.join(home, ".deno", "bin"),
        os.path.join(home, ".bun", "bin"),
        os.path.join(home, "go", "bin"),
        os.path.join(home, ".npm-global", "bin"),
        os.path.join(home, "AppData", "Local", "Microsoft", "WindowsApps"),
        "/usr/local/bin", "/opt/homebrew/bin", "/snap/bin",
    ]
    parts = (os.environ.get("PATH", "") or "").split(os.pathsep)
    for entry in extra:
        if entry and entry not in parts:
            parts.append(entry)
    return os.pathsep.join(p for p in parts if p)


def detect_tool(tool):
    binary = tool["check"]
    path = shutil.which(binary, path=_augmented_path())
    version = None
    if path and tool.get("version"):
        try:
            argv = list(tool["version"])
            argv[0] = path  # run the resolved binary even if it's not on PATH
            proc = subprocess.run(
                argv, capture_output=True, text=True, timeout=8,
            )
            output = (proc.stdout or "") + (proc.stderr or "")
            for line in output.splitlines():
                if line.strip():
                    version = line.strip()
                    break
        except Exception:
            version = None
    cmd, method, needs_admin = choose_install_command(tool)
    return {
        "id": tool["id"], "name": tool["name"], "category": tool["category"],
        "icon": tool.get("icon", ""), "description": tool["description"],
        "installed": bool(path), "path": path, "version": version,
        "installable": bool(cmd), "method": method, "needs_admin": needs_admin,
    }


def catalog_status():
    return [detect_tool(tool) for tool in CATALOG]


def system_info():
    priv = privilege_info()
    return {
        "os": detect_os(),
        "os_pretty": _os_pretty(),
        "arch": platform.machine(),
        "hostname": platform.node(),
        "python": platform.python_version(),
        "package_manager": primary_package_manager(),
        "package_managers_available": available_package_managers(),
        "user": _current_user(),
        "elevation": priv["elevation"],
        "is_admin": priv["is_root"],
        "can_elevate": can_elevate_noninteractive(),
    }


def _current_user():
    for key in ("USER", "USERNAME", "LOGNAME"):
        if os.environ.get(key):
            return os.environ[key]
    try:
        import getpass
        return getpass.getuser()
    except Exception:
        return "unknown"


# ---------------------------------------------------------------------------
# Install jobs
# ---------------------------------------------------------------------------

class Job:
    def __init__(self, ids):
        self.id = uuid.uuid4().hex
        self.ids = ids
        self.lines = []  # list of {"ts","text","level"}
        self.statuses = {i: "queued" for i in ids}
        self.done = False
        self.prepared = set()  # package managers whose index we've refreshed
        self.lock = threading.Lock()

    def log(self, text, level="info"):
        with self.lock:
            self.lines.append({"ts": time.time(), "text": text, "level": level})

    def add_status(self, tool_id, status):
        with self.lock:
            self.statuses[tool_id] = status

    def snapshot(self, offset):
        with self.lock:
            return {
                "lines": self.lines[offset:],
                "next_offset": len(self.lines),
                "statuses": dict(self.statuses),
                "done": self.done,
            }


JOBS = {}
JOBS_LOCK = threading.Lock()
TOOLS_BY_ID = {t["id"]: t for t in CATALOG}


def _stream_command(job, command):
    job.log(f"$ {command}", level="cmd")
    env = dict(os.environ)
    env.setdefault("DEBIAN_FRONTEND", "noninteractive")
    try:
        proc = subprocess.Popen(
            command, shell=True, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1, env=env,
        )
    except Exception as exc:  # pragma: no cover - defensive
        job.log(f"Failed to launch command: {exc}", level="error")
        return 1
    assert proc.stdout is not None
    for line in proc.stdout:
        job.log(line.rstrip("\n"))
    proc.wait()
    return proc.returncode


def _run_job(job):
    for tool_id in job.ids:
        tool = TOOLS_BY_ID.get(tool_id)
        if not tool:
            with job.lock:
                job.statuses[tool_id] = "failed"
            job.log(f"Unknown tool: {tool_id}", level="error")
            continue

        current = detect_tool(tool)
        if current["installed"]:
            with job.lock:
                job.statuses[tool_id] = "installed"
            job.log(f"{tool['name']} already installed ({current['version'] or 'ok'}).", level="ok")
            continue

        command, method, needs_admin = choose_install_command(tool)
        if not command:
            with job.lock:
                job.statuses[tool_id] = "unsupported"
            job.log(f"No install method for {tool['name']} on this system.", level="error")
            continue

        # Never assume admin rights: if the only available method needs
        # elevation and we cannot elevate unattended, stop and explain instead
        # of blindly running sudo (which would fail or hang without a TTY).
        if needs_admin and not can_elevate_noninteractive():
            priv = privilege_info()
            with job.lock:
                job.statuses[tool_id] = "needs_admin"
            hint = (
                "no sudo/root available on this account"
                if priv["elevation"] == "none"
                else "sudo would require a password, which can't be entered here"
            )
            job.log(
                f"[ADMIN NEEDED] {tool['name']} can only be installed with "
                f"administrator rights ({hint}).",
                level="error",
            )
            job.log(
                f"  To install it, re-run with elevation, e.g.:  sudo {method} ...  "
                f"or ask an administrator. Command that would run:",
                level="info",
            )
            job.log(f"  {render_command(command)}", level="cmd")
            continue

        # Refresh the package index once per job so installs work on a fresh
        # machine with a stale/empty cache.
        if method == "apt" and "apt" not in job.prepared:
            job.log("Refreshing apt package index...", level="step")
            _stream_command(job, render_command("{{SUDO}} apt-get update"))
            job.prepared.add("apt")

        with job.lock:
            job.statuses[tool_id] = "installing"
        note = " (elevated)" if needs_admin else ""
        job.log(f"Installing {tool['name']} via {method}{note}...", level="step")
        rc = _stream_command(job, render_command(command))

        # Re-detect to confirm success regardless of exit code quirks.
        after = detect_tool(tool)
        if after["installed"]:
            with job.lock:
                job.statuses[tool_id] = "installed"
            job.log(f"[OK] {tool['name']} installed ({after['version'] or 'ok'}).", level="ok")
        else:
            with job.lock:
                job.statuses[tool_id] = "failed"
            job.log(f"[FAIL] {tool['name']} did not install (exit code {rc}).", level="error")

    with job.lock:
        job.done = True
    job.log("All tasks complete.", level="step")


def start_job(ids):
    job = Job(ids)
    with JOBS_LOCK:
        JOBS[job.id] = job
    threading.Thread(target=_run_job, args=(job,), daemon=True).start()
    return job


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "RigSetup/1.0"

    def log_message(self, *args):  # silence default noisy logging
        pass

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path):
        if not os.path.isfile(path):
            self.send_error(404, "Not found")
            return
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
        }.get(os.path.splitext(path)[1], "application/octet-stream")
        with open(path, "rb") as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/" or route == "/index.html":
            return self._send_file(os.path.join(WEB_DIR, "index.html"))
        if route == "/api/system":
            return self._send_json(system_info())
        if route == "/api/tools":
            return self._send_json({"tools": catalog_status()})
        if route == "/api/job":
            params = parse_qs(parsed.query)
            job_id = (params.get("id") or [""])[0]
            offset = int((params.get("offset") or ["0"])[0])
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                return self._send_json({"error": "unknown job"}, status=404)
            return self._send_json(job.snapshot(offset))

        # static assets from web/
        if route.startswith("/web/"):
            rel = route[len("/web/"):]
        else:
            rel = route.lstrip("/")
        safe = os.path.normpath(os.path.join(WEB_DIR, rel))
        if safe.startswith(WEB_DIR):
            return self._send_file(safe)
        self.send_error(404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/install":
            return self.send_error(404, "Not found")
        length = int(self.headers.get("Content-Length", "0"))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send_json({"error": "invalid JSON"}, status=400)
        ids = [i for i in data.get("ids", []) if i in TOOLS_BY_ID]
        if not ids:
            return self._send_json({"error": "no valid tool ids"}, status=400)
        job = start_job(ids)
        return self._send_json({"job_id": job.id, "ids": ids})


def main():
    open_browser = "--no-browser" not in sys.argv
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    info = system_info()
    print("=" * 60)
    print("  Rig Setup - new machine developer bootstrapper")
    print("=" * 60)
    print(f"  OS:              {info['os_pretty']} ({info['arch']})")
    print(f"  Package manager: {info['package_manager'] or 'none detected'}")
    print(f"  Tools in catalog: {len(CATALOG)}")
    print(f"  Open:            {url}")
    print("=" * 60)
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
