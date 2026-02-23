# 🔐 The State of Passkeys: Artifacts Repository

This repository contains the artifacts for the paper **"The State of Passkeys: Studying the Adoption and Security of Passkeys on the Web"**, accepted at the **35th USENIX Security Symposium 2026**.

[![DOI](https://zenodo.org/badge/1114366317.svg)](https://doi.org/10.5281/zenodo.17898769)

## 💻 Environment

Our artifacts run on any modern GUI-based OS (x86 or ARM) capable of running Docker, Chrome, Python 3, and Pipenv. We tested and recommend **Ubuntu 24.04 LTS** or **macOS Tahoe 26.2** (on the host or in a VM). Windows 11 is untested but should work as well.

| Dependency | Tested Version |
|------------|---------------|
| Docker | 29.1.5+ (Compose v5.0.1+) |
| Chrome | 144.0.7559.97+ |
| Python | 3.11 (radar) / 3.14 (notebooks) |
| Pipenv | 2026.0.3 |

For detailed setup instructions, see the [Artifact Appendix](artifact-appendix.pdf) (§A.2–A.3).

## 📂 Repository Structure

Our artifacts are organized into six main components:

| Directory | Description |
|-----------|-------------|
| 📡 [`./radar`](#-passkeys-radar) | Source code of the PASSKEYS-RADAR |
| 🔍 [`./detector`](#-well-known-detector) | Source code for scanning well-known files |
| 🛠️ [`./tools`](#️-passkeys-attacker) | Source code of the PASSKEYS-ATTACKER |
| 🎓 [`./learning`](#-learning-platform) | Intentionally vulnerable learning platform |
| 💾 [`./data`](#-data-artifacts) | Data artifacts including community directories and lists |
| 📊 [`./notebooks`](#-analysis-notebooks) | Jupyter notebooks for analysis and figure generation |

## 📡 PASSKEYS-RADAR

**Location:** [`./radar`](./radar)

A comprehensive tool for aggregating and analyzing passkey adoption across multiple directories and websites. The radar continuously monitors 12 different passkey directories to track adoption trends.

📖 See [`./radar/README.md`](./radar/README.md) for setup and usage instructions.

## 🔍 Well-Known Detector

**Location:** [`./detector`](./detector)

Scans 18M CrUX domains to detect passkey-related well-known files (`/.well-known/passkey_endpoints` and `/.well-known/webauthn`).

### Components
- 📁 `./detector/taskly` — Parallel-execution framework with Docker orchestration (not part of our contribution)
- 📁 `./detector/tasks` — Scanning task definitions (our contribution)

📖 See [`./detector/README.md`](./detector/README.md) for setup instructions.

## 🛠️ PASSKEYS-ATTACKER

**Location:** [`./tools`](./tools)

A comprehensive security testing toolkit for WebAuthn (passkey) implementations. This tool provides full emulation of both the client (browser) and authenticator layers, enabling security analysis of relying party implementations.

### Components
- 📁 `./tools/frontend` — Vite-based web application
- 📁 `./tools/backend` — Express.js API server
- 📁 `./tools/extension` — Chrome extension for WebAuthn interception

📖 See [`./tools/README.md`](./tools/README.md) for setup and usage instructions.

## 🎓 Learning Platform

**Location:** [`./learning`](./learning)

An intentionally vulnerable learning platform for artifact evaluation. Covers all vulnerabilities from Table 2 in the paper and enables safe, controlled experimentation with PASSKEYS-ATTACKER.

📖 See [`./learning/README.md`](./learning/README.md) for setup and usage instructions.

## 💾 Data Artifacts

**Location:** [`./data`](./data)

Contains all generated data since 2021, including aggregated passkey directories and well-known scan results.

## 📊 Analysis Notebooks

**Location:** [`./notebooks`](./notebooks)

Jupyter notebooks for analyzing evaluation data and generating paper figures.

### Main Notebooks

| Notebook | Description |
|----------|-------------|
| 📓 `sheet.ipynb` | Main analysis notebook for evaluation data (`sheet.csv`) |
| 📓 `radar.ipynb` | PASSKEYS-RADAR data analysis and statistics |
| 📓 `tranco.ipynb` | Tranco list analysis and ranking statistics |
| 📓 `wellknown_*.ipynb` | Well-known file detection analysis |

### Data Files

| File | Description |
|------|-------------|
| 📄 `sheet.csv` | Main evaluation dataset |
| 📄 `sheet.xlsx` | Evaluation data in Excel format |
| 📄 `*-combined.json` | Aggregated websites from all sources |
| 📄 `*-merged.json` | Deduplicated list of passkey-enabled sites |
| 📄 `*-sites.txt` | List of analyzed websites |

### Generated Figures

The `./notebooks/charts/` directory contains all generated figures used in the paper.
