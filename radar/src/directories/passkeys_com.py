import re
import requests
from time import sleep
from bs4 import BeautifulSoup
from src.helpers import get_ts_from_waybackmachine


def get_entries():
    r = requests.get("https://www.passkeys.com/websites-with-passkey-support-sites-directory")
    s = BeautifulSoup(r.text, "html.parser")

    entries = []
    for e in s.select("h3:-soup-contains('List of Passkey-Supported Websites') ~ p"):
        name, description = [t.strip() for t in e.get_text(strip=True).split(":", 1)]
        a = e.find("a")
        link = a["href"] if a else None
        entries.append({"name": name, "description": description, "link": link})

    return entries


def get_history():
    url = "https://www.passkeys.com/websites-with-passkey-support-sites-directory"

    for ts in get_ts_from_waybackmachine(url):
        archive_url = f"https://web.archive.org/web/{ts}/{url}"
        sleep(10)
        archive_res = requests.get(archive_url, timeout=120)
        archive_soup = BeautifulSoup(archive_res.text, "html.parser")

        entries = []
        if archive_soup.find("h3", string="List of Passkey-Supported Websites"):
            for e in archive_soup.select("h3:-soup-contains('List of Passkey-Supported Websites') ~ p"):
                name, description = [t.strip() for t in e.get_text(strip=True).split(":", 1)]
                a = e.find("a")
                link = a["href"] if a else None
                entries.append({"name": name, "description": description, "link": link})
        else:
            paragraphs = archive_soup.find_all("p")
            pattern = re.compile(r"<strong>([^<>]*)</strong>\s*-\s*([^<>]*)")
            for p in paragraphs:
                matches = pattern.findall(str(p))
                for website, category in matches:
                    website = website.strip()
                    category = category.strip()
                    entries.append({"name": website, "description": category})

        id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}-{ts[8:10]}-{ts[10:12]}-{ts[12:]}"
        yield {"id": id, "entries": entries}
