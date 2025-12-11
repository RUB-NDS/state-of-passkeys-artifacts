from enum import Enum


class Directories(str, Enum):
    dashlane = "passkeys-directory.dashlane.com"        # https://passkeys-directory.dashlane.com/ | history via github
    enpass = "enpass.io"                                # https://www.enpass.io/passkeys-catalogue/ | history via created_date (web archive available but broken pagination due to api)
    fidoalliance = "fidoalliance.org"                   # https://fidoalliance.org/passkeys-directory/ | history via post_date (web archive available but broken pagination due to api)
    hideez = "hideez.com"                               # https://hideez.com/de-de/pages/supported-services | history via web archive (Saved 2 times between June 25, 2024 and December 8, 2024)
    keepersecurity = "keepersecurity.com"               # https://www.keepersecurity.com/de_DE/passkeys-directory/ | history via web archive (Saved 1 time July 19, 2024)
    passkeyindex = "passkeyindex.io"                    # https://passkeyindex.io/ | history via github
    passkeys_com = "passkeys.com"                       # https://www.passkeys.com/websites-with-passkey-support-sites-directory | history via web archive (Saved 14 times between November 2, 2024 and March 29, 2025)
    passkeys_directory = "passkeys.directory"           # https://passkeys.directory/ | history via created_at (web archive available, Saved 601 times between November 17, 2022 and April 11, 2025)
    passkeys_io = "passkeys.io"                         # https://www.passkeys.io/who-supports-passkeys | history via web archive (Saved 78 times between September 21, 2023 and April 4, 2025)
    twofa_directory_passkeys = "passkeys.2fa.directory" # https://passkeys.2fa.directory/de/ | history via github
    twofa_directory = "2fa.directory"                   # https://2fa.directory/de/ | history via github
    twostable = "passkeys.2stable.com"                  # https://passkeys.2stable.com/services/ | history via web archive (Saved 7 times between December 9, 2023 and March 3, 2025)
