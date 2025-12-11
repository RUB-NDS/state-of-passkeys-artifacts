import os
import re
import subprocess
from datetime import datetime
from src.helpers import update_or_clone_repo


repo_url = "https://github.com/bitwarden/passkeys-index.git"
repo_dir = "/tmp/repo-passkeys-index"
repo_file = "README.md"


def get_entries():
    entries = []
    update_or_clone_repo(repo_url, repo_dir)

    with open(os.path.join(repo_dir, repo_file), "r") as f:
        readme = f.read()
        lines = readme.split("\n")

        table_start_marker = "| Logo | Site/Company name | Site URL | Features |"
        table_end_marker   = "### **Developer tools** {#developer-tools}"

        in_table = False
        for line in lines:
            if table_start_marker in line:
                in_table = True
                continue
            if table_end_marker in line:
                in_table = False
            if not in_table:
                continue
            if line.strip().startswith("| --- |"):
                continue
            if not line.strip():
                continue

            # | ![logo](...) | <name> | [label](url) | ![Login](...) ![MFA](...) |
            columns = [col.strip() for col in line.split("|")]
            assert len(columns) == 6 or len(columns) == 7

            name = columns[2]
            match = re.search(r"\((https://[^\)]+)\)", columns[3])
            url = match.group(1) if match else None

            features = []
            if "Login" in columns[4]:
                features.append("login")
            if "MFA" in columns[4].upper():
                features.append("mfa")

            entries.append({
                "name": name,
                "url": url,
                "features": features
            })

    return entries


def get_history():
    history = []
    update_or_clone_repo(repo_url, repo_dir)
    cwd = os.getcwd()
    os.chdir(repo_dir)
    commits = subprocess.check_output(["git", "rev-list", "--reverse", "HEAD"]).decode().split()
    for c in commits:
        subprocess.check_call(["git", "checkout", c])
        commit_date = subprocess.check_output(["git", "show", "-s", "--format=%ci", c]).decode().strip()
        date_str = datetime.strptime(commit_date, "%Y-%m-%d %H:%M:%S %z").strftime("%Y-%m-%d-%H-%M-%S")

        entries = []

        if os.path.exists(repo_file):
            with open(os.path.join(repo_dir, repo_file), "r") as f:
                readme = f.read()
                lines = readme.split("\n")

                table_start_marker = "| Logo | Site/Company name | Site URL | Features |"
                table_end_marker   = "### **Developer tools** {#developer-tools}"

                in_table = False
                for line in lines:
                    if table_start_marker in line:
                        in_table = True
                        continue
                    if table_end_marker in line:
                        in_table = False
                    if not in_table:
                        continue
                    if line.strip().startswith("| --- |"):
                        continue
                    if not line.strip():
                        continue

                    # | ![logo](...) | <name> | [label](url) | ![Login](...) ![MFA](...) |
                    columns = [col.strip() for col in line.split("|")]
                    assert len(columns) == 6 or len(columns) == 7

                    name = columns[2]
                    match = re.search(r"\((https://[^\)]+)\)", columns[3])
                    url = match.group(1) if match else None

                    features = []
                    if "Login" in columns[4]:
                        features.append("login")
                    if "MFA" in columns[4].upper():
                        features.append("mfa")

                    entries.append({"name": name, "url": url, "features": features})

        if os.path.exists("passkey-index.md") and not entries:
            with open(os.path.join(repo_dir, "passkey-index.md"), "r") as f:
                readme = f.read()
                lines = readme.split("\n")

                table_start_marker = "| Site name | URL |"
                table_end_marker   = "### **Developer tools**"

                in_table = False
                for line in lines:
                    if table_start_marker in line:
                        in_table = True
                        continue
                    if table_end_marker in line:
                        in_table = False
                    if not in_table:
                        continue
                    if line.strip().startswith("| --- |"):
                        continue
                    if not line.strip():
                        continue

                    # | <name> | [label](url) |
                    columns = [col.strip() for col in line.split("|")]
                    assert len(columns) == 4 or len(columns) == 3

                    name = columns[1]
                    match = re.search(r"\((https://[^\)]+)\)", columns[2])
                    url = match.group(1) if match else None

                    entries.append({"name": name, "url": url, "features": None})

        history.append({"id": date_str, "entries": entries})

    subprocess.check_call(["git", "checkout", "main"])
    os.chdir(cwd)
    return history
