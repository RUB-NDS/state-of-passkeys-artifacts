import os
import json
import subprocess
from datetime import datetime
from src.helpers import update_or_clone_repo


repo_url = "https://github.com/Dashlane/passkeys-resources"
repo_dir = "/tmp/repo-dashlane"
repo_file = "resources/compatible-domains.json"


def get_entries():
    entries = []
    update_or_clone_repo(repo_url, repo_dir)
    with open(os.path.join(repo_dir, repo_file), "r") as f:
        domains = json.load(f)
        for d in domains:
            entries.append({"domain": d})
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
        if not os.path.exists(repo_file):
            continue

        with open(repo_file, "r") as f:
            try:
                domains = json.load(f)
                entries = [{"domain": d} for d in domains]
                history.append({"id": date_str, "entries": entries})
            except:
                pass

    subprocess.check_call(["git", "checkout", "main"])
    os.chdir(cwd)
    return history
