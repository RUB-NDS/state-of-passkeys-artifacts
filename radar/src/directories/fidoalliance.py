import requests


def get_entries():
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Origin': 'https://fidoalliance.org',
        'Pragma': 'no-cache',
        'Referer': 'https://fidoalliance.org/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'x-algolia-api-key': 'b83a2ab0788bd5464f347b02c42ba4be',
        'x-algolia-application-id': '5O3OQH0390',
    }
    data = '{"requests":[{"indexName":"fido_posts_comm_deployments","params":"attributesToSnippet=%5B%22content%3A10%22%5D&facets=%5B%22taxonomies.product-type%22%5D&highlightPostTag=__%2Fais-highlight__&highlightPreTag=__ais-highlight__&hitsPerPage=10000&maxValuesPerFacet=10000&page=0&query=&tagFilters="}]}'
    r = requests.post('https://5o3oqh0390-dsn.algolia.net/1/indexes/*/queries', headers=headers, data=data)
    r_json = r.json()
    entries = r_json["results"][0]["hits"]
    return entries
