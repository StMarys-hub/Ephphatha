import urllib.request
import json
import re

days_to_test = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 50, 100, 200, 365]
with open('data/youtube_bible_in_a_year_365.json', encoding='utf-8') as f:
    d = json.load(f)

for day in days_to_test:
    info = d['days'].get(str(day))
    if not info:
        print(f"Day {day}: NOT FOUND IN JSON")
        continue
    vid = info['video_id']
    embed_url = f"https://www.youtube.com/embed/{vid}"
    try:
        req = urllib.request.Request(embed_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        res = urllib.request.urlopen(req)
        body = res.read().decode('utf-8', errors='ignore')
        
        # Check playability status in ytInitialPlayerResponse
        status_match = re.search(r'"playabilityStatus":\{"status":"([^"]+)"', body)
        status = status_match.group(1) if status_match else "UNKNOWN"
        reason_match = re.search(r'"reason":"([^"]+)"', body)
        reason = reason_match.group(1) if reason_match else ""
        
        print(f"Day {day:3d} ({vid}): status={status} reason={reason} title={info['title'][:45]}")
    except Exception as e:
        print(f"Day {day:3d} ({vid}): HTTP ERROR {e}")
