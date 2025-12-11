import requests
from json import JSONDecodeError


def get_entries():
    data = {"pageId": 1, "usage_type": "all_listings", "ordering": "domain_a_to_z"}
    url = "https://www.enpass.io/wp-content/themes/enpass/pdirectory_response.php"
    r = requests.post(url, data=data)

    entries = []

    r_json = r.json()
    while r_json is not None:
        entries.extend(r_json["results"])
        data["pageId"] += 1
        try:
            r = requests.post(url, data=data)
            r_json = r.json()
        except JSONDecodeError:
            r_json = None

    return entries
