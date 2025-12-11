# 🔐 The State of Passkeys: Artifacts Repository

This repository contains the artifacts for the paper **"The State of Passkeys: Studying the Adoption and Security of Passkeys on the Web"**, accepted at the **35th USENIX Security Symposium 2026**.

## 📂 Repository Structure

Our artifacts are organized into five main components:

| Directory | Description |
|-----------|-------------|
| 📡 [`./radar`](#-passkeys-radar) | Source code of the PASSKEYS-RADAR |
| 🔍 [`./detector`](#-well-known-detector) | Source code for scanning well-known files |
| 🛠️ [`./tools`](#️-passkeys-attacker) | Source code of the PASSKEYS-ATTACKER |
| 💾 [`./data`](#-data-artifacts) | Data artifacts including community directories and lists |
| 📊 [`./notebooks`](#-analysis-notebooks) | Jupyter notebooks for analysis and figure generation |

## 📡 PASSKEYS-RADAR

**Location:** [`./radar`](./radar)

A comprehensive tool for aggregating and analyzing passkey adoption across multiple directories and websites. The radar continuously monitors 12 different passkey directories to track adoption trends.

📖 See [`./radar/README.md`](./radar/README.md) for setup and usage instructions.

## 🔍 Well-Known Detector

**Location:** [`./detector`](./detector)

Source code for scanning and analyzing well-known files across websites. This tool crawls the web to detect passkey-related configuration files.

### Components
- 📁 `./detector/taskly` — Main application with Docker orchestration
- 📁 `./detector/tasks` — Task definitions and configurations

📖 See [`./detector/taskly/README.md`](./detector/taskly/README.md) for setup instructions.

## 🛠️ PASSKEYS-ATTACKER

**Location:** [`./tools`](./tools)

A comprehensive security testing toolkit for WebAuthn (passkey) implementations. This tool provides full emulation of both the client (browser) and authenticator layers, enabling security analysis of relying party implementations.

### Components
- 📁 `./tools/frontend` — Vite-based web application
- 📁 `./tools/backend` — Express.js API server
- 📁 `./tools/extension` — Chrome extension for WebAuthn interception

📖 See [`./tools/README.md`](./tools/README.md) for setup and usage instructions.

## 💾 Data Artifacts

**Location:** [`./data`](./data)

Contains all data artifacts collected and processed by the PASSKEYS-RADAR.

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
| 📄 `sites.txt` | List of analyzed websites |

### Generated Figures

The `./notebooks/charts/` directory contains all generated figures used in the paper.
