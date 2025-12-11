import logging
import requests
from time import sleep
from bs4 import BeautifulSoup
from src.helpers import get_ts_from_waybackmachine


logger = logging.getLogger(__name__)


def get_entries():
    r1 = requests.get("https://passkeys.2stable.com/services/")
    s1 = BeautifulSoup(r1.text, "html.parser")

    entries = []
    for e in s1.select("div#services-supporting-passkeys table tbody tr"):
        try:
            id = e.select_one("th").get_text(strip=True)
            name = e.select_one("td h6").get_text(strip=True)
            domain = e.select_one("td p.fw-normal").get_text(strip=True)
            details = f"https://passkeys.2stable.com{e.select_one('td > a')['href']}"

            logger.debug(f"Fetch details from: {details}")
            r2 = requests.get(details)
            s2 = BeautifulSoup(r2.text, "html.parser")
            containers = s2.select("body > div > div:nth-child(2) > div > div:nth-child(4) > div > div.list-group > div")

            # service
            # name = containers[0].select_one("p").get_text(strip=True)

            # website
            website = (a := containers[1].select_one("a#service")) and a["href"]
            # domain = (a := containers[1].select_one("a#service")) and a.get_text(strip=True)

            # setup
            setup = ((a := containers[2].select_one("a#set-up")) and a["href"]) or ((p := containers[2].select_one("p")) and p.get_text())

            # howto
            howto = containers[3].select_one("div").get_text()
            howto_links = [a["href"] for a in containers[3].select_one("div").select("a")]

            # recover
            recover = containers[4].select_one("div").get_text()
            recover_links = [a["href"] for a in containers[4].select_one("div").select("a")]

            entries.append({
                "id": id, "name": name, "domain": domain, "details": details,
                "website": website, "setup": setup, "howto": howto, "howto_links": howto_links,
                "recover": recover, "recover_links": recover_links
            })
        except Exception as e:
            continue

    return entries


def get_history():
    url = "https://passkeys.2stable.com/services/"

    for ts in get_ts_from_waybackmachine(url):
        archive_url = f"https://web.archive.org/web/{ts}/{url}"
        sleep(10)
        archive_res = requests.get(archive_url, timeout=120)
        archive_soup = BeautifulSoup(archive_res.text, "html.parser")

        entries = []
        for e in archive_soup.select("table:has(span.bg-success-subtle) > tbody > tr"):
            try:
                id = e.select_one("th").get_text(strip=True)
                name = e.select_one("td h6").get_text(strip=True)
                domain = e.select_one("td p.fw-normal").get_text(strip=True)
                details = f"https://web.archive.org{e.select_one('td > a')['href']}"
                entries.append({
                    "id": id, "name": name, "domain": domain, "details": details,
                    "website": None, "setup": None, "howto": None, "howto_links": None,
                    "recover": None, "recover_links": None
                })
            except:
                pass
        if not len(entries):
            for e in archive_soup.select("table.shadow-sm > tbody > tr"):
                try:
                    id = e.select_one("th").get_text(strip=True)
                    name = e.select_one("td h6").get_text(strip=True)
                    domain = e.select_one("td p.fw-normal").get_text(strip=True)
                    details = f"https://web.archive.org{e.select_one('td > a')['href']}"
                    entries.append({
                        "id": id, "name": name, "domain": domain, "details": details,
                        "website": None, "setup": None, "howto": None, "howto_links": None,
                        "recover": None, "recover_links": None
                    })
                except:
                    pass

        id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}-{ts[8:10]}-{ts[10:12]}-{ts[12:]}"
        yield {"id": id, "entries": entries}
