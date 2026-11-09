import re
import urllib.request

url = "https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1"
req = urllib.request.Request(url, headers={"User-Agent": "fuerza-elite-lab"})
html = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")
open(r"C:\Users\Hide\Desktop\Gym\motion-lab\innerscene.html", "w", encoding="utf-8").write(html)
print("bytes", len(html))
urls = sorted(set(re.findall(r"https?://[^\"'\s>]+\.glb", html)))
print("glb urls", len(urls))
for item in urls:
    print(item)
for needle in ("human-base", "download", ".glb", "cdn", "storage"):
    print(needle, html.lower().count(needle.lower()))
