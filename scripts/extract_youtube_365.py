import subprocess
import json
import re
import sys

def main():
    yt_dlp_path = r'C:\Users\jimmy\AppData\Roaming\Python\Python314\Scripts\yt-dlp.exe'
    playlist_url = 'https://www.youtube.com/playlist?list=PLeXS0cAkuTPqFMtZQ379qdEmcfxO1SvXc'

    print("Fetching playlist data from YouTube via yt-dlp...")
    cmd = [yt_dlp_path, '--flat-playlist', '-J', playlist_url]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if res.returncode != 0:
        print("Error fetching playlist:", res.stderr)
        sys.exit(1)

    data = json.loads(res.stdout)
    entries = data.get('entries', [])
    print(f"Total playlist entries received: {len(entries)}")

    days_map = {}
    special_map = []
    day_pattern = re.compile(r'Day\s+(\d+)\s*:\s*(.+?)(?:\s*—|\s*-\s*|\s*\(with|\s*\||$)', re.IGNORECASE)

    for entry in entries:
        title = (entry.get('title') or '').strip()
        vid_id = (entry.get('id') or '').strip()
        if not vid_id:
            continue
        url = f'https://www.youtube.com/watch?v={vid_id}'
        match = day_pattern.search(title)
        if match:
            day_num = int(match.group(1))
            ep_title = match.group(2).strip()
            # If there are duplicates, keep the one matching Fr. Mike Schmitz
            if day_num not in days_map or 'Fr. Mike Schmitz' in title:
                days_map[day_num] = {
                    'day': day_num,
                    'title': title,
                    'episode_title': ep_title,
                    'video_id': vid_id,
                    'youtube_url': url
                }
        else:
            special_map.append({
                'title': title,
                'video_id': vid_id,
                'youtube_url': url
            })

    print(f"Total unique daily episodes mapped: {len(days_map)}")
    missing = [d for d in range(1, 366) if d not in days_map]
    print(f"Missing days: {missing}")

    output_path = 'data/youtube_bible_in_a_year_365.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'channel_title': 'The Bible in a Year & More: Fr. Mike & Jeff Cavins',
            'playlist_id': 'PLeXS0cAkuTPqFMtZQ379qdEmcfxO1SvXc',
            'total_days_mapped': len(days_map),
            'days': days_map,
            'special_episodes': special_map
        }, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved complete mapping to {output_path}")

if __name__ == '__main__':
    main()
