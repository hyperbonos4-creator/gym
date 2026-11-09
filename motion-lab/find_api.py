import re
html = open(r"C:\Users\Hide\Desktop\Gym\motion-lab\innerscene.html", encoding="utf-8").read()
paths = sorted(set(re.findall(r"/api/[^\"'\s<>]+", html)))
print("api", len(paths))
for path in paths:
    print(path)
print("--- file mentions ---")
for match in re.findall(r".{0,80}human-base-rigged.{0,80}", html):
    print(match.replace("\n", " ")[:200])
