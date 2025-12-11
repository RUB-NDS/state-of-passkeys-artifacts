import os
import json
import subprocess
from datetime import datetime
from src.helpers import update_or_clone_repo


repo_url = "https://github.com/2factorauth/passkeys.git"
repo_dir = "/tmp/repo-twofa-directory-passkeys"
entries_dir = os.path.join(repo_dir, "entries")


def get_entries():
    entries = []
    update_or_clone_repo(repo_url, repo_dir)

    subdirs = [
        os.path.join(entries_dir, d)
        for d in os.listdir(entries_dir)
        if os.path.isdir(os.path.join(entries_dir, d))
    ]
    for subdir in subdirs:
        files = [
            f for f in os.listdir(subdir)
            if f.endswith(".json")
        ]
        for file in files:
            file_path = os.path.join(subdir, file)
            domain = file[:-5] # remove .json
            with open(file_path, "r") as f:
                json_data = json.load(f)
            name = list(json_data.keys())[0]
            data = list(json_data.values())[0]
            entries.append({"domain": domain, "name": name, **data})

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

        if not os.path.exists(entries_dir) or not os.path.isdir(entries_dir):
            continue

        subdirs = [
            os.path.join(entries_dir, d)
            for d in os.listdir(entries_dir)
            if os.path.isdir(os.path.join(entries_dir, d))
        ]
        for subdir in subdirs:
            files = [
                f for f in os.listdir(subdir)
                if f.endswith(".json")
            ]
            for file in files:
                file_path = os.path.join(subdir, file)
                domain = file[:-5] # remove .json
                with open(file_path, "r") as f:
                    json_data = json.load(f)
                name = list(json_data.keys())[0]
                data = list(json_data.values())[0]
                entries.append({"domain": domain, "name": name, **data})

        if not len(entries):
            continue

        history.append({"id": date_str, "entries": entries})

    subprocess.check_call(["git", "checkout", "master"])
    os.chdir(cwd)
    return history
