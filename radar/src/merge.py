import json
import string
from pathlib import Path
from tldextract import extract

# Load entity map
entity_map = {}
entity_map_path = Path(__file__).parent / "core" / "data" / "entity_map.json"
if entity_map_path.exists():
    with open(entity_map_path, "r") as f:
        data = json.load(f)
        for k, v in data.items():
            for p in v["properties"]:
                entity_map[p] = k


def etld(domain: str):
    if domain == "nhs.uk":
        return "nhs.uk"
    if domain == "amazon.com.be":
        return "amazon.com.be"
    return extract(domain).registered_domain


def base(domain: str):
    if domain == "amazon.com.be":
        return "amazon"
    return extract(domain).domain


def norm(name: str):
    if isinstance(name, str):
        name = "".join(filter(lambda s: s in string.printable, name))
        return name.lower().replace(" ", "")
    return ""


def cmp_domain(domain1: str, domain2: str):
    if not isinstance(domain1, str) or not isinstance(domain2, str):
        return False

    # Check same eTLDs
    etld1 = etld(domain1)
    etld2 = etld(domain2)
    if not etld1 or not etld2:
        return False
    if etld1 == etld2:
        return True

    # Check same base domains
    bd1 = base(domain1)
    bd2 = base(domain2)
    if bd1 and bd2 and bd1 == bd2:
        return True

    # Check entity mapping
    if etld1 in entity_map and etld2 in entity_map:
        return entity_map[etld1] == entity_map[etld2]

    return False


def cmp_name(name1: str, name2: str):
    if not isinstance(name1, str) or not isinstance(name2, str):
        return False
    n1, n2 = norm(name1), norm(name2)
    match = False
    if n1 == n2:
        match = True
    # s1 = [norm(s) for s in name1.split() if len(s) >= 3]
    # s2 = [norm(s) for s in name2.split() if len(s) >= 3]
    # if set(s1) & set(s2):
    #     match = True
    if len(n1) >= 3 and n1 in [norm(s) for s in name2.split()]:
        match = True
    if len(n2) >= 3 and n2 in [norm(s) for s in name1.split()]:
        match = True
    # this could be made more robust by comparing only lone-word matches (i.e., "unity" should not be in "community")
    if "microsoft" in n1 and "microsoft" in n2:
        match = True
    if "twitter" in n1 and "twitter" in n2:
        match = True
    if "aws" in n1 and "aws" in n2:
        match = True
    return match


def cmp_name_with_alts(existing, new_name):
    """Check if new_name matches the existing entry's name or any of its alternative names"""
    if new_name is None or not isinstance(new_name, str):
        return False

    # Check against main name
    if existing["name"] is not None and cmp_name(existing["name"], new_name):
        return True

    # Check against alternative names
    if "alt" in existing:
        for alt in existing["alt"]:
            if cmp_name(alt, new_name):
                return True

    return False


def add_alt_name(existing, new_name):
    """Add alternative name to the existing entry if it differs and is not already present"""
    if new_name is None or not isinstance(new_name, str):
        return

    # Check if new_name is different from the existing name
    if existing["name"] is not None:
        if not cmp_name(existing["name"], new_name):
            # Names are different, add to alt if not already there
            if new_name not in existing["alt"]:
                existing["alt"].append(new_name)


def merge(combined: dict):
    merged = []
    conflicts = []

    # passkeys.directory
    for c in combined.get("directories", {}).get("passkeys.directory", []):
        if not (c["passkey_signin"] or c["passkey_mfa"]):
            continue
        # merge via domain and name
        assert c["domain"] is not None and c["name"] is not None
        assert c["passkey_signin"] or c["passkey_mfa"]
        existing = [e for e in merged if cmp_domain(e["domain"], c["domain"]) or cmp_name_with_alts(e, c["name"])]
        if existing:
            existing[0]["directories"].setdefault("passkeys.directory", []).append(c)
            add_alt_name(existing[0], c["name"])
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": c["passkey_signin"],
                "mfa": c["passkey_mfa"],
                "directories": {"passkeys.directory": [c]},
                "wellknown": {}
            })

    # passkeys-directory.dashlane.com
    for c in combined.get("directories", {}).get("passkeys-directory.dashlane.com", []):
        # merge via domain
        assert c["domain"] is not None
        existing = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        if existing:
            existing[0]["directories"].setdefault("passkeys-directory.dashlane.com", []).append(c)
        else:
            merged.append({
                "name": None,
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"passkeys-directory.dashlane.com": [c]},
                "wellknown": {}
            })

    # passkeyindex.io
    for c in combined.get("directories", {}).get("passkeyindex.io", []):
        if c["url"] is None:
            # merge via name
            assert c["name"] is not None
            # Handle null features
            has_features = c.get("features") is not None
            if has_features:
                assert "login" in c["features"] or "mfa" in c["features"]
            existing = [e for e in merged if cmp_name_with_alts(e, c["name"])]
            if existing:
                existing[0]["directories"].setdefault("passkeyindex.io", []).append(c)
                add_alt_name(existing[0], c["name"])
                # check signin
                if has_features and "login" in c["features"]:
                    if existing[0]["signin"] is False: conflicts.append(["signin mismatch", existing[0]])
                    else: existing[0]["signin"] = True
                elif has_features:
                    if existing[0]["signin"] is True: conflicts.append(["signin mismatch", existing[0]])
                    else: existing[0]["signin"] = False
                # check mfa
                if has_features and "mfa" in c["features"]:
                    if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                    else: existing[0]["mfa"] = True
                elif has_features:
                    if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                    else: existing[0]["mfa"] = False
            else:
                merged.append({
                    "name": c["name"],
                    "domain": None,
                    "alt": [],
                    "signin": "login" in c["features"] if has_features else None,
                    "mfa": "mfa" in c["features"] if has_features else None,
                    "directories": {"passkeyindex.io": [c]},
                    "wellknown": {}
                })
        else:
            # merge via domain or name
            assert c["url"] is not None and c["name"] is not None
            # Handle null features
            has_features = c.get("features") is not None
            if has_features:
                assert "login" in c["features"] or "mfa" in c["features"]
            existing_domain = [e for e in merged if cmp_domain(e["domain"], c["url"])]
            existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
            existing = existing_domain or existing_name or None
            if existing:
                existing[0]["directories"].setdefault("passkeyindex.io", []).append(c)
                add_alt_name(existing[0], c["name"])
                # check name
                if existing[0]["name"] is not None:
                    if not cmp_name(existing[0]["name"], c["name"]):
                        conflicts.append(["name mismatch", existing[0]])
                else:
                    existing[0]["name"] = c["name"]
                # check domain
                if existing[0]["domain"] is not None:
                    if not cmp_domain(existing[0]["domain"], c["url"]):
                        conflicts.append(["domain mismatch", existing[0]])
                else:
                    existing[0]["domain"] = etld(c["url"])
                # check signin
                if has_features and "login" in c["features"]:
                    if existing[0]["signin"] is False: conflicts.append(["signin mismatch", existing[0]])
                    else: existing[0]["signin"] = True
                elif has_features:
                    if existing[0]["signin"] is True: conflicts.append(["signin mismatch", existing[0]])
                    else: existing[0]["signin"] = False
                # check mfa
                if has_features and "mfa" in c["features"]:
                    if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                    else: existing[0]["mfa"] = True
                elif has_features:
                    if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                    else: existing[0]["mfa"] = False
            else:
                merged.append({
                    "name": c["name"],
                    "domain": etld(c["url"]),
                    "alt": [],
                    "signin": "login" in c["features"] if has_features else None,
                    "mfa": "mfa" in c["features"] if has_features else None,
                    "directories": {"passkeyindex.io": [c]},
                    "wellknown": {}
                })

    # passkeys.2fa.directory
    for c in combined.get("directories", {}).get("passkeys.2fa.directory", []):
        if not ("passwordless" in c and c["passwordless"] in ["required", "allowed"]) and not ("mfa" in c and c["mfa"] in ["required", "allowed"]):
            continue
        # merge via domain or name
        assert c["domain"] is not None and c["name"] is not None
        assert ("passwordless" in c and c["passwordless"] in ["required", "allowed"]) or ("mfa" in c and c["mfa"] in ["required", "allowed"])
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        existing = existing_domain or existing_name or None
        if existing:
            existing[0]["directories"].setdefault("passkeys.2fa.directory", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check name
            if existing[0]["name"] is not None:
                if not cmp_name(existing[0]["name"], c["name"]):
                    conflicts.append(["name mismatch", existing[0]])
            else:
                existing[0]["name"] = c["name"]
            # check domain
            if existing[0]["domain"] is not None:
                if not cmp_domain(existing[0]["domain"], c["domain"]):
                    conflicts.append(["domain mismatch", existing[0]])
            else:
                existing[0]["domain"] = etld(c["domain"])
            # check signin
            if "passwordless" in c and c["passwordless"] in ["required", "allowed"]:
                if existing[0]["signin"] is False: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = True
            else:
                if existing[0]["signin"] is True: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = False
            # check mfa
            if "mfa" in c and c["mfa"] in ["required", "allowed"]:
                if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = True
            else:
                if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = False
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": "passwordless" in c and c["passwordless"] in ["required", "allowed"],
                "mfa": "mfa" in c and c["mfa"] in ["required", "allowed"],
                "directories": {"passkeys.2fa.directory": [c]},
                "wellknown": {}
            })

    # 2fa.directory
    for c in combined.get("directories", {}).get("2fa.directory", []):
        if "tfa" not in c or "u2f" not in c["tfa"]:
            continue
        # merge via domain or name
        assert c["domain"] is not None and c["name"] is not None
        assert "u2f" in c["tfa"]
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        existing = existing_domain or existing_name or None
        if existing:
            existing[0]["directories"].setdefault("2fa.directory", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check name
            if existing[0]["name"] is not None:
                if not cmp_name(existing[0]["name"], c["name"]):
                    conflicts.append(["name mismatch", existing[0]])
            else:
                existing[0]["name"] = c["name"]
            # check domain
            if existing[0]["domain"] is not None:
                if not cmp_domain(existing[0]["domain"], c["domain"]):
                    conflicts.append(["domain mismatch", existing[0]])
            else:
                existing[0]["domain"] = etld(c["domain"])
            # check mfa
            if "u2f" in c["tfa"]:
                if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = True
            else:
                if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = False
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": None,
                "mfa": "u2f" in c["tfa"],
                "directories": {"2fa.directory": [c]},
                "wellknown": {}
            })

    # passkey.io
    for c in combined.get("directories", {}).get("passkeys.io", []):
        if c["domain"] is None or c["name"] is None or c["url"] is None:
            continue
        # merge via domain or name
        assert c["domain"] is not None and c["name"] is not None and c["url"] is not None
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        existing = existing_domain or existing_name or None
        if existing:
            existing[0]["directories"].setdefault("passkeys.io", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check name
            if existing[0]["name"] is not None:
                if not cmp_name(existing[0]["name"], c["name"]):
                    conflicts.append(["name mismatch", existing[0]])
            else:
                existing[0]["name"] = c["name"]
            # check domain
            if existing[0]["domain"] is not None:
                if not cmp_domain(existing[0]["domain"], c["domain"]):
                    conflicts.append(["domain mismatch", existing[0]])
            else:
                existing[0]["domain"] = etld(c["domain"])
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"passkeys.io": [c]},
                "wellknown": {}
            })

    # fidoalliance.org
    for c in combined.get("directories", {}).get("fidoalliance.org", []):
        # merge via name
        assert c["post_title"] is not None
        existing = [e for e in merged if cmp_name_with_alts(e, c["post_title"])]
        if existing:
            existing[0]["directories"].setdefault("fidoalliance.org", []).append(c)
            add_alt_name(existing[0], c["post_title"])
            # check domain
            # if existing[0]["domain"] is not None and "deployment_link" in c and c["deployment_link"] is not None:
            #     if not cmp_domain(existing[0]["domain"], c["deployment_link"]):
            #         conflicts.append(["domain mismatch", existing[0]])
            # elif "deployment_link" in c and c["deployment_link"] is not None:
            #     existing[0]["domain"] = etld(c["deployment_link"])
        else:
            merged.append({
                "name": c["post_title"],
                "domain": None,
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"fidoalliance.org": [c]},
                "wellknown": {}
            })

    # passkeys.com
    for c in combined.get("directories", {}).get("passkeys.com", []):
        # merge via name
        assert c["name"] is not None
        existing = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        if existing:
            existing[0]["directories"].setdefault("passkeys.com", []).append(c)
            add_alt_name(existing[0], c["name"])
        else:
            merged.append({
                "name": c["name"],
                "domain": None,
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"passkeys.com": [c]},
                "wellknown": {}
            })

    # enpass.io
    for c in combined.get("directories", {}).get("enpass.io", []):
        # merge via domain or name
        assert c["domain"] is not None and c["name"] is not None
        assert "sign_in" in c["usage_type"] or "mfa" in c["usage_type"]
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        existing = existing_domain or existing_name or None
        if existing:
            existing[0]["directories"].setdefault("enpass.io", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check name
            if existing[0]["name"] is not None:
                if not cmp_name(existing[0]["name"], c["name"]):
                    conflicts.append(["name mismatch", existing[0]])
            else:
                existing[0]["name"] = c["name"]
            # check domain
            if existing[0]["domain"] is not None:
                if not cmp_domain(existing[0]["domain"], c["domain"]):
                    conflicts.append(["domain mismatch", existing[0]])
            else:
                existing[0]["domain"] = etld(c["domain"])
            # check signin
            if "sign_in" in c["usage_type"]:
                if existing[0]["signin"] is False: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = True
            else:
                if existing[0]["signin"] is True: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = False
            # check mfa
            if "mfa" in c["usage_type"]:
                if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = True
            else:
                if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = False
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": "sign_in" in c["usage_type"],
                "mfa": "mfa" in c["usage_type"],
                "directories": {"enpass.io": [c]},
                "wellknown": {}
            })

    # keepersecurity.com
    for c in combined.get("directories", {}).get("keepersecurity.com", []):
        # merge via name
        assert c["name"] is not None
        assert c["signin"] is not None and c["mfa"] is not None
        existing = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        if existing:
            existing[0]["directories"].setdefault("keepersecurity.com", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check signin
            if c["signin"]:
                if existing[0]["signin"] is False: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = True
            else:
                if existing[0]["signin"] is True: conflicts.append(["signin mismatch", existing[0]])
                else: existing[0]["signin"] = False
            # check mfa
            if c["mfa"]:
                if existing[0]["mfa"] is False: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = True
            else:
                if existing[0]["mfa"] is True: conflicts.append(["mfa mismatch", existing[0]])
                else: existing[0]["mfa"] = False
        else:
            merged.append({
                "name": c["name"],
                "domain": None,
                "alt": [],
                "signin": c["signin"],
                "mfa": c["mfa"],
                "directories": {"keepersecurity.com": [c]},
                "wellknown": {}
            })

    # hideez.com
    for c in combined.get("directories", {}).get("hideez.com", []):
        # merge via name
        assert c["name"] is not None
        existing = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        if existing:
            existing[0]["directories"].setdefault("hideez.com", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check domain
            # if existing[0]["domain"] is not None and c["link"] is not None:
            #     if not cmp_domain(existing[0]["domain"], c["link"]):
            #         conflicts.append(["domain mismatch", existing[0]])
            # elif c["link"] is not None:
            #     existing[0]["domain"] = etld(c["link"])
        else:
            merged.append({
                "name": c["name"],
                "domain": None,
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"hideez.com": [c]},
                "wellknown": {}
            })

    # passkeys.2stable.com
    for c in combined.get("directories", {}).get("passkeys.2stable.com", []):
        # merge via domain or name
        assert c["domain"] is not None and c["name"] is not None
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["domain"])]
        existing_name = [e for e in merged if cmp_name_with_alts(e, c["name"])]
        existing = existing_domain or existing_name or None
        if existing:
            existing[0]["directories"].setdefault("passkeys.2stable.com", []).append(c)
            add_alt_name(existing[0], c["name"])
            # check name
            if existing[0]["name"] is not None:
                if not cmp_name(existing[0]["name"], c["name"]):
                    conflicts.append(["name mismatch", existing[0]])
            else:
                existing[0]["name"] = c["name"]
            # check domain
            if existing[0]["domain"] is not None:
                if not cmp_domain(existing[0]["domain"], c["domain"]):
                    conflicts.append(["domain mismatch", existing[0]])
            else:
                existing[0]["domain"] = etld(c["domain"])
        else:
            merged.append({
                "name": c["name"],
                "domain": etld(c["domain"]),
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {"passkeys.2stable.com": [c]},
                "wellknown": {}
            })

    # webauthn
    for c in combined.get("wellknown", {}).get("webauthn", []):
        # merge via domain
        assert c["origin"] is not None
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["origin"])]
        existing = existing_domain or None
        if existing:
            existing[0]["wellknown"].setdefault("webauthn", []).append(c)
        else:
            merged.append({
                "name": None,
                "domain": etld(c["origin"]),
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {},
                "wellknown": {"webauthn": [c]}
            })

    # endpoints
    for c in combined.get("wellknown", {}).get("endpoints", []):
        # merge via domain
        assert c["origin"] is not None
        existing_domain = [e for e in merged if cmp_domain(e["domain"], c["origin"])]
        existing = existing_domain or None
        if existing:
            existing[0]["wellknown"].setdefault("endpoints", []).append(c)
        else:
            merged.append({
                "name": None,
                "domain": etld(c["origin"]),
                "alt": [],
                "signin": None,
                "mfa": None,
                "directories": {},
                "wellknown": {"endpoints": [c]}
            })

    return merged, conflicts
