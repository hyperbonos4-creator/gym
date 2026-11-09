import subprocess, os, re, sys, time

adb = os.path.abspath('platform-tools/adb.exe')

def run(*a, t=25):
    return subprocess.run([adb, *a], capture_output=True, text=True, timeout=t)

def dump():
    run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    return run('shell', 'cat', '/sdcard/ui.xml').stdout

def bounds_center(b):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', b)
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2

def find(xml, needle):
    hits = []
    for node in re.finditer(r'<node[^>]*>', xml):
        s = node.group(0)
        tm = re.search(r'text="([^"]*)"', s)
        cm = re.search(r'content-desc="([^"]*)"', s)
        bm = re.search(r'bounds="(\[\d+,\d+\]\[\d+,\d+\])"', s)
        label = (tm.group(1) if tm else '') + '|' + (cm.group(1) if cm else '')
        if needle.lower() in label.lower() and bm:
            hits.append((label, bm.group(1)))
    return hits

if __name__ == '__main__':
    xml = dump()
    needle = sys.argv[1] if len(sys.argv) > 1 else 'gym-access'
    hits = find(xml, needle)
    if not hits:
        print('NO MATCH for', needle)
        # print all clickable texts to help
        for node in re.finditer(r'<node[^>]*clickable="true"[^>]*>', xml):
            s = node.group(0)
            tm = re.search(r'text="([^"]*)"', s)
            bm = re.search(r'bounds="(\[\d+,\d+\]\[\d+,\d+\])"', s)
            if tm and tm.group(1) and bm:
                print('CLICK:', repr(tm.group(1))[:40], bm.group(1))
    else:
        for label, b in hits:
            cx, cy = bounds_center(b)
            print('MATCH:', repr(label)[:60], b, '-> tap', cx, cy)
        # tap the first match
        cx, cy = bounds_center(hits[0][1])
        run('shell', 'input', 'tap', str(cx), str(cy))
        print('tapped', cx, cy)
