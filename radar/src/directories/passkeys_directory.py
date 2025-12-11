import requests


def get_sites():
    headers = {
        'accept': '*/*',
        'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-profile': 'public',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'cache-control': 'no-cache',
        'dnt': '1',
        'origin': 'https://passkeys.directory',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'x-client-info': 'supabase-js/2.8.0',
    }
    r = requests.get('https://apecbgwekadegtkzpwyh.supabase.co/rest/v1/sites?select=*', headers=headers)
    return r.json()


def get_requested_sites():
    headers = {
        'accept': '*/*',
        'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-profile': 'public',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'cache-control': 'no-cache',
        'dnt': '1',
        'origin': 'https://passkeys.directory',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'x-client-info': 'supabase-js/2.8.0',
    }
    r = requests.get('https://apecbgwekadegtkzpwyh.supabase.co/rest/v1/requested_sites?select=*', headers=headers)
    return r.json()


def get_token():
    headers = {
        'accept': '*/*',
        'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'cache-control': 'no-cache',
        'content-type': 'application/json;charset=UTF-8',
        'dnt': '1',
        'origin': 'https://passkeys.directory',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'x-client-info': 'supabase-js/2.8.0',
    }
    params = {
        'grant_type': 'password',
    }
    json_data = {
        'email': 'b83d141ad01be5a2251186f9a6b1c1dc@passage.id',
        'password': 'b83d141ad01be5a2251186f9a6b1c1dc',
        'data': {},
        'gotrue_meta_security': {},
    }
    r = requests.post('https://apecbgwekadegtkzpwyh.supabase.co/auth/v1/token', params=params, headers=headers, json=json_data)
    return r.json()


def get_votes():
    token = get_token()
    headers = {
        'accept': '*/*',
        'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-profile': 'public',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZWNiZ3dla2FkZWd0a3pwd3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk1MjAyNTAsImV4cCI6MTk5NTA5NjI1MH0.n7Is0JnMPSgYxZz2zHrnCu9BNyDZ3tVKHuHeaOT1_s8',
        'authorization': f'Bearer {token["access_token"]}',
        'cache-control': 'no-cache',
        'dnt': '1',
        'origin': 'https://passkeys.directory',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'x-client-info': 'supabase-js/2.8.0',
    }

    votes = []
    offset = 0
    limit = 5000
    has_more = True
    base = "https://apecbgwekadegtkzpwyh.supabase.co/rest/v1/votes"

    while has_more:
        url = f"{base}?select=*&offset={offset}&limit={limit}"
        r = requests.get(url, headers=headers)
        data = r.json()
        if not data:
            has_more = False
        else:
            votes.extend(data)
            offset += limit

    return votes


def get_entries():
    sites = get_sites()
    requested_sites = get_requested_sites()
    requested_sites_map = {site["id"]: site["count"] for site in requested_sites}
    entries = [{**site, "count": requested_sites_map.get(site["id"], -1)} for site in sites]
    return entries
