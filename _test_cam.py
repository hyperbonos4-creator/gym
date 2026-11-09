from facial_webhook import _isapi_digest, _isapi_basic, _http_get_raw

ip, port = "192.168.100.120", 80
user, pw = "admin", "Estaeswq1"

paths = [
    "/ISAPI/Streaming/channels/101/picture",
    "/ISAPI/Streaming/channels/102/picture",
    "/cgi-bin/snapshot.cgi",
    "/snapshot.jpg",
]

print(f"Probando {ip}:{port} con {user}:{pw}\n")

for path in paths:
    status, body, www = _http_get_raw(ip, port, path, None, 3.0)
    print(f"  {path}")
    print(f"    sin auth: status={status} body={len(body)}b www={www[:60] if www else None}")
    if status in (401, 403):
        buf = _isapi_digest(ip, port, path, user, pw)
        if buf:
            print(f"    Digest OK: {len(buf)} bytes ✓ IMAGEN")
            continue
        buf2 = _isapi_basic(ip, port, path, user, pw)
        if buf2:
            print(f"    Basic OK: {len(buf2)} bytes ✓ IMAGEN")
            continue
        print(f"    Credenciales NO funcionaron")
    elif status == 200 and len(body) > 500:
        print(f"    Sin auth OK ✓ IMAGEN")
    print()
