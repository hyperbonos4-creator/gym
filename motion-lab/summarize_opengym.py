import json
import urllib.request

raw = urllib.request.urlopen("https://assiamahs.github.io/opengym3d/exercises.json").read()
data = json.loads(raw)
print("count", len(data))
lanes = {}
for item in data:
    lane = item["license"]["lane"]
    lanes[lane] = lanes.get(lane, 0) + 1
print("lanes", lanes)
print("qa_not_pass", sum(1 for x in data if not x.get("qa", {}).get("pass")))
print("---")
for item in data:
    qa = item.get("qa", {})
    print(
        f"{item['id']:28} {item['license']['lane']:8} pack={str(item['license'].get('pack')):5} "
        f"equip={item.get('equipment','?'):12} pattern={item.get('pattern','?'):16} "
        f"pass={qa.get('pass')} fails={qa.get('fails')} crit={qa.get('critical_fails')}"
    )
