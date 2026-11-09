"""Lanza el proxy HTTPS como proceso independiente y verifica que escuche."""
import subprocess, sys, time, os, ssl, urllib.request as u
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

CWD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kiosk-proxy")
out = open(os.path.join(CWD, "proxy.out.log"), "w")
err = open(os.path.join(CWD, "proxy.err.log"), "w")

DETACHED = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
p = subprocess.Popen(["node", "proxy.js"], cwd=CWD, stdout=out, stderr=err,
                     shell=True, creationflags=DETACHED, close_fds=True)
print("lanzado pid", p.pid)

ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
ok = False
for i in range(12):
    time.sleep(1)
    try:
        r = u.urlopen("https://127.0.0.1:3443/health", timeout=3, context=ctx)
        print("health ->", r.status); ok = True; break
    except Exception as e:
        pass
if not ok:
    print("no respondio; revisa proxy.err.log")
    try:
        print(open(os.path.join(CWD, "proxy.err.log")).read()[-1000:])
    except Exception: pass
