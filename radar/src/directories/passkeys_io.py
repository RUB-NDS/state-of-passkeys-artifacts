import requests
from time import sleep
from bs4 import BeautifulSoup
from src.helpers import get_ts_from_waybackmachine


def get_entries():
    r = requests.get("https://www.passkeys.io/who-supports-passkeys")
    s = BeautifulSoup(r.text, "html.parser")

    entries = []
    for e in s.select(".text-wrap"):
        name = e.select_one("div").get_text(strip=True)
        a = e.select_one("a")
        url = a["href"] if a else None
        domain = a.get_text(strip=True) if a else None
        entries.append({"domain": domain, "name": name, "url": url})

    return entries


def get_history():
    url = "https://www.passkeys.io/who-supports-passkeys"

    for ts in get_ts_from_waybackmachine(url):
        archive_url = f"https://web.archive.org/web/{ts}/{url}"
        sleep(10)
        archive_res = requests.get(archive_url, timeout=120)
        archive_soup = BeautifulSoup(archive_res.text, "html.parser")

        entries = []
        for e in archive_soup.select(".text-wrap"):
            name = e.select_one("div").get_text(strip=True)
            a = e.select_one("a")
            href = a["href"] if a else None
            domain = a.get_text(strip=True) if a else None
            entries.append({"domain": domain, "name": name, "url": href})

        id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}-{ts[8:10]}-{ts[10:12]}-{ts[12:]}"
        yield {"id": id, "entries": entries}
