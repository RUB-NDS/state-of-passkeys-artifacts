# Analysis Notebooks

Jupyter notebooks for analyzing evaluation data and generating paper figures. All notebooks reproduce the figures and numbers reported in the paper, with **six minor exceptions** documented below.

## Notebooks

| Notebook | Description |
|----------|-------------|
| `sheet.ipynb` | Main analysis notebook for evaluation data (`sheet.csv` and `./db`) |
| `sheet-mongo.ipynb` | Original notebook output from running against our MongoDB — matches all paper numbers |
| `radar.ipynb` | PASSKEYS-RADAR data analysis and statistics |
| `tranco.ipynb` | Tranco list analysis and ranking statistics |
| `wellknown_*.ipynb` | Well-known file detection analysis |

## Known Number Discrepancies

Six numbers in `sheet.ipynb` differ slightly from the paper. This section explains why and confirms that the discrepancies do not affect any claims or conclusions.

### Background

When generating the final numbers for the paper, we ran the notebook while connected to our Passkey-Attacker database. Unfortunately, the database export in `./db` was created slightly before the final evaluation finished. It contains most but not all history data, which causes six cells that use the `history()` function to show slightly lower counts than the paper reports.

The original database has since been deleted. However, we preserved the original notebook output in `sheet-mongo.ipynb`, which matches all paper numbers. The main results (Figure 5, Table 2) are generated from a separate, complete dataset (`sheet.xlsx`) and are **not affected**.

### Affected Numbers

Based on 208 confirmed independent passkey implementations (Section 4.2), the table below summarizes all discrepancies:

| Section | Statement | Paper | Artifacts | Diff |
|---------|-----------|------:|----------:|-----:|
| Key Attestation | Sites that request attestation | 66 (31.7%) | 64 (30.8%) | 0.9% |
| Key Attestation | Sites that explicitly disable attestation | 85 (40.9%) | 80 (38.5%) | 2.4% |
| Authenticator Selection | Sites that request a hardware authenticator | 22 (10.6%) | 20 (9.6%) | 1.0% |
| User Verification | Sites that require user verification | 82 (39.4%) | 76 (36.5%) | 2.9% |
| User Verification | Sites that disable UV but use passkeys only for 2FA | 18 (8.7%) | 16 (7.7%) | 1.0% |
| User Verification | Sites that disable UV but use passkeys for passwordless auth | 17 (8.2%) | 16 (7.7%) | 0.5% |

The average difference is **1.45%**, with a maximum of **2.9%**. These deviations do not change any statements in the paper. For example, the claim that "key attestation is rarely used" holds whether usage is 31.7% or 30.8%.

### Affected Cells in `sheet.ipynb`

| Cell | Paragraph | Change (Artifacts -> Paper) |
|-----:|-----------|---------------------------|
| 21 | Attestation | 80 -> 85, 60 -> 62 (62 + 4 = 66 who request it), 4 is correct |
| 22 | Authenticator Selection | 20 -> 22 (cross-platform) |
| 22 | User Verification | 76 -> 82, 32 -> 35 discouraged (35 - 17 = 18 for 2FA), 16 -> 17 |

Cells 17, 19, and 20 also use `history()` but are not referenced in the paper.

### Verification

To verify the correct numbers, compare `sheet-mongo.ipynb` with the paper. That notebook was run against the full database and its outputs match all reported numbers.
