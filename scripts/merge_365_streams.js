const fs = require('fs');

async function merge365() {
  // 1. Load YouTube 365 json
  const ytData = JSON.parse(fs.readFileSync('data/youtube_bible_in_a_year_365.json', 'utf8'));
  const ytDays = ytData.days || {};

  // 2. Fetch RSS feed for direct audio streams
  console.log('Fetching Ascension official audio feed...');
  const res = await fetch('https://feeds.fireside.fm/bibleinayear/rss');
  const xml = await res.text();
  const items = xml.split('<item>');
  const audioUrls = {};

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const titleMatch = item.match(/<title>([^<]+)<\/title>/);
    const encMatch = item.match(/<enclosure[^>]+url="([^"]+)"/);
    if (!titleMatch || !encMatch) continue;
    const title = titleMatch[1];
    const url = encMatch[1];
    const dayMatch = title.match(/Day\s+(\d+)\s*:/i);
    if (dayMatch) {
      const d = parseInt(dayMatch[1], 10);
      if (!audioUrls[d]) {
        audioUrls[d] = url;
      }
    }
  }

  console.log(`Found direct audio streams for ${Object.keys(audioUrls).length} days`);

  const merged = {};
  for (let d = 1; d <= 365; d++) {
    const key = String(d);
    const yt = ytDays[key] || {};
    merged[key] = {
      day: d,
      title: yt.title || `Day ${d}: The Bible in a Year (with Fr. Mike Schmitz)`,
      episode_title: yt.episode_title || `Day ${d}`,
      video_id: yt.video_id || '',
      youtube_url: yt.youtube_url || `https://www.youtube.com/results?search_query=Day+${d}+The+Bible+in+a+Year+Fr+Mike+Schmitz`,
      audio_url: audioUrls[d] || ''
    };
  }

  // Save merged JSON
  fs.writeFileSync('data/youtube_bible_in_a_year_365.json', JSON.stringify({
    ...ytData,
    days: merged
  }, null, 2), 'utf8');

  // Save merged JS
  const jsContent = `/**
 * EPHPHATHA 365-DAY BIBLE IN A YEAR (FR. MIKE SCHMITZ) OFFICIAL AUDIO & YOUTUBE DATASET
 * Zero-latency in-memory dictionary mapping all 365 days with official direct audio & YouTube metadata.
 */

export const YOUTUBE_365_MAP = ${JSON.stringify(merged, null, 2)};
`;
  fs.writeFileSync('src/domain/youtubeBibleMap.js', jsContent, 'utf8');
  console.log('Successfully generated merged 365-day dataset!');
}

merge365().catch(console.error);
