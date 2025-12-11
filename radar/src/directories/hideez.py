import requests
from time import sleep
from bs4 import BeautifulSoup
from src.helpers import get_ts_from_waybackmachine


def get_entries():
    r = requests.get("https://hideez.com/de-de/pages/supported-services")
    s = BeautifulSoup(r.text, "html.parser")

    entries = []
    for service in s.select(".ServiceBlock"):
        name = service.select_one(".ServiceBlock--heading").get_text(strip=True)
        content = service.select_one(".ServiceBlock--content").get_text(strip=True)
        link = (a := service.select_one(".ServiceBlock--link")) and a["href"]
        entries.append({"name": name, "content": content, "link": link})

    return entries


def get_history():
    url = "https://hideez.com/de-de/pages/supported-services"

    for ts in get_ts_from_waybackmachine(url):
        archive_url = f"https://web.archive.org/web/{ts}/{url}"
        sleep(10)
        archive_res = requests.get(archive_url, timeout=120)
        archive_soup = BeautifulSoup(archive_res.text, "html.parser")

        entries = []
        for service in archive_soup.select(".ServiceBlock"):
            name = service.select_one(".ServiceBlock--heading").get_text(strip=True)
            content = service.select_one(".ServiceBlock--content").get_text(strip=True)
            link = (a := service.select_one(".ServiceBlock--link")) and a["href"]
            entries.append({"name": name, "content": content, "link": link})

        id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}-{ts[8:10]}-{ts[10:12]}-{ts[12:]}"
        yield {"id": id, "entries": entries}
