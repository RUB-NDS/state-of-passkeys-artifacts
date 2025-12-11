import json
from requests import Session
from requests.exceptions import RequestException, ConnectionError, Timeout, TooManyRedirects, JSONDecodeError
from urllib.parse import urlparse
from typing import Iterable, Tuple
from tldextract import extract
from configs import wellknown
from modules.logging import get_logger
from modules.schedule import schedule_origin
from browser.requests import session, chrome_macos_session


logger = get_logger(__name__)


def probe(
    url: str,
    timeout: int = 5,
    session: Session = session(),
    remove_headers: list = [],
    custom_headers: dict = {},
    check_code: int = [200],
    check_mime: str = None,
    check_keys_in_header: list = [],
    check_parse_json: bool = False,
    check_keys_in_json: list = [],
    allow_empty_json: bool = False
) -> Tuple[bool, None|str, None|str]:
    logger.debug(f"Probe url: {url}")
    # remove headers
    for k in remove_headers:
        session.headers.pop(k, None)
    # custom headers
    for k, v in custom_headers.items():
        session.headers.update({k: v})
    # probe url
    try:
        r = session.get(url, timeout=timeout)
    except ConnectionError as e:
        logger.debug(f"Connection error while probing {url}: {e}")
        return False, "connection error", None
    except Timeout as e:
        logger.debug(f"Timeout error while probing {url}: {e}")
        return False, "timeout error", None
    except TooManyRedirects as e:
        logger.debug(f"Too many redirects error while probing {url}: {e}")
        return False, "too many redirects", None
    except RequestException as e:
        logger.debug(f"Request error while probing {url}: {e}")
        return False, "request error", None
    # check code
    if check_code and r.status_code not in check_code:
        logger.debug(f"Invalid code while probing {url}: {r.status_code} != {check_code}")
        return False, "invalid code", None
    # check mime
    if check_mime and "content-type" not in r.headers:
        logger.debug(f"Invalid mime while probing {url}")
        return False, "invalid mime", None
    if check_mime and check_mime not in r.headers["content-type"]:
        logger.debug(f"Invalid mime while probing {url}: {r.headers['content-type']} != {check_mime}")
        return False, "invalid mime", None
    # check keys in header
    if check_keys_in_header:
        if not all(k in r.headers.keys() for k in check_keys_in_header):
            logger.debug(f"Invalid key in header while probing {url}")
            return False, "invalid key in header", None
    # check parse json
    if check_parse_json:
        try:
            r.json()
        except JSONDecodeError as e:
            logger.debug(f"Invalid json while probing {url}: {e}")
            return False, "invalid json", None
    # check keys in json
    if check_keys_in_json:
        try:
            data = r.json()
            if not any(k in data for k in check_keys_in_json):
                if not (allow_empty_json is True and not data):
                    logger.debug(f"Invalid key in json while probing {url}")
                    return False, "invalid key in json", None
        except JSONDecodeError as e:
            logger.debug(f"Invalid key in json while probing {url}: {e}")
            return False, "invalid key in json", None
    return True, None, r.text


def schedule(scan_config: wellknown.ScanConfig, task_config: wellknown.TaskConfig) -> Iterable[wellknown.AnalysisConfig]:
    for analysis_config in schedule_origin(scan_config, task_config):
        yield analysis_config


def start(task_config: wellknown.TaskConfig, analysis_config: wellknown.AnalysisConfig) -> dict:
    result = {}

    origin = analysis_config.origin
    scheme = urlparse(origin).scheme
    etld = extract(origin).registered_domain

    # ping
    success, error, data = probe(origin, session=chrome_macos_session())
    result["ping"] = {"success": success, "error": error, "data": None}

    # Well-Known URIs: https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml

    # https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig
    success, error, data = probe(
        f"{origin}/.well-known/openid-configuration",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["issuer", "authorization_endpoint", "token_endpoint"]
    )
    result["openid_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://openid.net/specs/openid-connect-discovery-1_0.html#IssuerDiscovery
    # https://www.rfc-editor.org/rfc/rfc7033.html
    success, error, data = probe(
        f"{origin}/.well-known/webfinger?resource=acct%3Acarol%40example.com&rel=http%3A%2F%2Fopenid.net%2Fspecs%2Fconnect%2F1.0%2Fissuer",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["subject", "links"]
    )
    result["webfinger"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://datatracker.ietf.org/doc/html/rfc8414#section-3
    success, error, data = probe(
        f"{origin}/.well-known/oauth-authorization-server",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["issuer", "authorization_endpoint", "token_endpoint"]
    )
    result["oauth_authorization_server"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://datatracker.ietf.org/doc/html/draft-looker-oauth-client-discovery-01#section-3
    success, error, data = probe(
        f"{origin}/.well-known/oauth-client",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["client_uri", "client_name", "redirect_uris"]
    )
    result["oauth_client"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://w3c-fedid.github.io/FedCM/#idp-api-well-known
    success, error, data = probe(
        f"{scheme}://{etld}/.well-known/web-identity",
        custom_headers={
            "Accept": "application/json",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Dest": "webidentity",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
            "Priority": "u=4, i",
            "Connection": "keep-alive",
        },
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["provider_urls", "accounts_endpoint", "login_url"]
    )
    result["web_identity"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-well-known-openid-credentia
    success, error, data = probe(
        f"{origin}/.well-known/openid-credential-issuer",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["credential_issuer", "authorization_servers", "credential_endpoint"]
    )
    result["openid_credential_issuer"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://mozilla.github.io/id-specs/docs/formats/well-known/
    success, error, data = probe(
        f"{origin}/.well-known/browserid",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["disabled", "authority", "authentication", "provisioning", "keys"]
    )
    result["browserid"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets
    success, error, data = probe(
        f"{origin}/.well-known/jwks.json",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["keys"]
    )
    result["jwks"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://backstage.forgerock.com/docs/am/7/uma-guide/configure-uma-discovery.html
    success, error, data = probe(
        f"{origin}/.well-known/uma2-configuration",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["issuer", "authorization_endpoint", "token_endpoint"]
    )
    result["uma2_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://w3c.github.io/webappsec-passkey-endpoints/passkey-endpoints.html
    success, error, data = probe(
        f"{origin}/.well-known/passkey-endpoints",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["enroll", "manage"]
    )
    result["passkey_endpoints"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://www.w3.org/TR/webauthn-3/#sctn-validating-relation-origin
    success, error, data = probe(
        f"{origin}/.well-known/webauthn",
        session=chrome_macos_session(),
        remove_headers=["Cookie", "Referer"],
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["origins"]
    )
    result["webauthn"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://gluu.org/docs/gluu-server/4.0/authn-guide/U2F/#u2f-discovery-endpoint
    success, error, data = probe(
        f"{origin}/.well-known/fido-configuration",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True
    )
    result["fido_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://gluu.org/docs/gluu-server/4.0/authn-guide/U2F/#u2f-discovery-endpoint
    success, error, data = probe(
        f"{origin}/.well-known/fido-2fa-configuration",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True
    )
    result["fido_2fa_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://gluu.org/docs/gluu-server/4.0/authn-guide/fido2/
    # https://docs.jans.io/v1.1.5/contribute/implementation-design/jans-fido2/#components-of-the-fido2-ecosystem-in-janssen
    success, error, data = probe(
        f"{origin}/.well-known/fido2-configuration",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True
    )
    result["fido2_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://w3c.github.io/webappsec-change-password-url
    success, error, data = probe(
        f"{origin}/.well-known/change-password",
        session=chrome_macos_session(),
        check_code=[302, 303, 307],
        check_keys_in_header=["Location"]
    )
    result["change_password"] = {"success": success, "error": error, "data": None}

    # https://w3c-ccg.github.io/did-method-web/#create-register
    success, error, data = probe(
        f"{origin}/.well-known/did.json",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["id", "verificationMethod", "authentication", "assertionMethod"]
    )
    result["did"] = {"success": success, "error": error, "data": None}

    # https://identity.foundation/.well-known/resources/did-configuration/#well-known-uris
    success, error, data = probe(
        f"{origin}/.well-known/did-configuration.json",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["@context", "linked_dids"]
    )
    result["did_configuration"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://datatracker.ietf.org/doc/html/draft-ietf-gnap-resource-servers-09#name-rs-facing-as-discovery
    success, error, data = probe(
        f"{origin}/.well-known/gnap-as-rs",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["grant_request_endpoint", "introspection_endpoint", "token_formats_supported", "resource_registration_endpoint", "key_proofs_supported"]
    )
    result["gnap_as_rs"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-13#section-3
    success, error, data = probe(
        f"{origin}/.well-known/oauth-protected-resource",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["resource", "authorization_servers", "bearer_methods_supported", "scopes_supported", "resource_documentation"]
    )
    result["oauth_protected_resource"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://openid.net/specs/openid-federation-1_0.html#name-well-known-uri-registry
    success, error, data = probe(
        f"{origin}/.well-known/openid-federation",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["iss", "sub", "metadata", "jwks", "authority_hints"]
    )
    result["openid_federation"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API/Related_website_sets
    success, error, data = probe(
        f"{origin}/.well-known/related-website-set.json",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["primary", "associatedSites", "serviceSites", "rationaleBySite", "ccTLDs"]
    )
    result["related_website_set"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    # https://www.rfc-editor.org/rfc/rfc9727
    success, error, data = probe(
        f"{origin}/.well-known/api-catalog",
        session=chrome_macos_session(),
        check_code=[200],
        check_parse_json=True,
        check_keys_in_json=["linkset"]
    )
    result["api_catalog"] = {"success": success, "error": error, "data": json.loads(data) if success else None}

    return result
