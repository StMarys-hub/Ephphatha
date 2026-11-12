import urllib.request
import re

for vid in ['BW0gXbEVYgA', 'WBg_xK44V0E', 'xs41k9YG7tQ']:
    url = f'https://www.youtube.com/embed/{vid}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
        matches = re.findall(r'"playabilityStatus":\{"status":"([^"]+)"', html)
        print(f'{vid}: playability = {matches}')
        titles = re.findall(r'<title>([^<]+)</title>', html)
        print(f'{vid}: title = {titles}')
        # Check if error message is in HTML
        if 'unplayable' in html.lower() or 'unavailable' in html.lower():
            err_text = re.findall(r'"reason":"([^"]+)"', html)
            print(f'{vid}: unplayable reason = {err_text}')
    except Exception as e:
        print(f'{vid}: error {e}')
