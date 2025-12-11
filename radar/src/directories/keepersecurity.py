import requests
from time import sleep
from bs4 import BeautifulSoup
from src.helpers import get_ts_from_waybackmachine


def get_entries():
    r = requests.get("https://www.keepersecurity.com/blog/passkeys-directory/")
    j = r.json()

    entries = []
    for brand in j:
        name = brand["name"]
        category = brand["category"]
        methods = brand["supports"]
        signin = False
        mfa = False
        for method in methods:
            if method["value"] == "signIn":
                signin = True
            elif method["value"] == "mfa":
                mfa = True
        entries.append({"name": name, "category": category, "signin": signin, "mfa": mfa})

    return entries


def get_history():
    url = "https://www.keepersecurity.com/blog/passkeys-directory/"

    for ts in get_ts_from_waybackmachine(url):
        archive_url = f"https://web.archive.org/web/{ts}/{url}"
        sleep(10)
        archive_res = requests.get(archive_url, timeout=120)
        archive_soup = BeautifulSoup(archive_res.text, "html.parser")
        entries = []
        for brand in archive_soup.select(".brand"):
            name = brand["data-name"]
            category = brand["data-cat"]
            methods = brand.select_one(".suMethods")
            signin = methods.select_one(".signIn") is not None
            mfa = methods.select_one(".mfa") is not None
            entries.append({"name": name, "category": category, "signin": signin, "mfa": mfa})

        id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}-{ts[8:10]}-{ts[10:12]}-{ts[12:]}"
        yield {"id": id, "entries": entries}
