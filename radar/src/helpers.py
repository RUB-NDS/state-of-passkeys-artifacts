import os
import requests
from git import Repo
from time import sleep
from datetime import datetime
from urllib.parse import quote


def update_or_clone_repo(repo_url, repo_path):
    if os.path.exists(os.path.join(repo_path, ".git")):
        repo = Repo(repo_path)
        origin = repo.remotes.origin
        origin.pull()
    else:
        Repo.clone_from(repo_url, repo_path)


def get_closest_id(ids, target_id):
    ids_dt = [datetime.strptime(id, "%Y-%m-%d-%H-%M-%S") for id in ids]
    target_dt = datetime.strptime(target_id, "%Y-%m-%d-%H-%M-%S")
    closest_dt = min([dt for dt in ids_dt if dt <= target_dt], key=lambda dt: abs(dt - target_dt), default=None)
    return closest_dt.strftime("%Y-%m-%d-%H-%M-%S") if closest_dt else None


def get_all_ids(path):
    ids = []
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith(".json"):
                ids.append(file[:-5])
    return ids


def get_ts_from_waybackmachine(url):
    print(f"Wayback Machine Timestamps for: {url}")

    years_url = f"https://web.archive.org/__wb/sparkline?output=json&url={quote(url)}&collection=web"
    try: years_res = requests.get(years_url, headers={"referer": "https://web.archive.org"}, timeout=120)
    except: return
    years_json = years_res.json()
    years_dict = years_json.get("years", {}) # {'2024': [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]}
    years = [k for k, v in years_dict.items()] # ['2024']
    first_ts = years_json.get("first_ts")
    last_ts = years_json.get("last_ts")
    status = years_json.get("status", {})

    for year in years:
        days_url = f"https://web.archive.org/__wb/calendarcaptures/2?url={quote(url)}&date={year}&groupby=day"
        sleep(10)
        try: days_res = requests.get(days_url, headers={"referer": "https://web.archive.org"}, timeout=120) # {"items":[[625,200,1],[1208,200,1]]}
        except: continue
        days_json = days_res.json()
        days_items = days_json.get("items", [])
        for day_item in days_items:
            monthday = str(day_item[0]).zfill(4)
            day_code = day_item[1]

            if day_code != 200:
                continue

            time_url = f"https://web.archive.org/__wb/calendarcaptures/2?url={quote(url)}&date={year}{monthday}"
            sleep(10)
            try: time_res = requests.get(time_url, headers={"referer": "https://web.archive.org"}, timeout=120) # {"colls":[["commoncrawl"]],"items":[[210329,200,0]]}
            except: continue
            time_json = time_res.json()
            time_items = time_json.get("items", [])
            for time_item in time_items:
                hms = str(time_item[0]).zfill(6)
                time_code = time_item[1]

                if time_code != 200:
                    continue

                timestamp = f"{year}{monthday}{hms}"
                print(f"\t-> {timestamp}")
                yield timestamp


if __name__ == "__main__":
    print(get_ts_from_waybackmachine("https://hideez.com/de-de/pages/supported-services"))
