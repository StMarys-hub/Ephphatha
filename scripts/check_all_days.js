async function testAll() {
  const res = await fetch('https://feeds.fireside.fm/bibleinayear/rss');
  const xml = await res.text();
  const items = xml.split('<item>');
  const days = {};

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
      if (!days[d]) {
        days[d] = { day: d, title, url };
      }
    }
  }

  const keys = Object.keys(days).map(Number).sort((a,b) => a-b);
  console.log('Total days matched from official feed:', keys.length);
  const missing = [];
  for (let d = 1; d <= 365; d++) {
    if (!days[d]) missing.push(d);
  }
  console.log('Missing days count:', missing.length);
  if (missing.length > 0) {
    console.log('Missing days:', missing);
  }
  console.log('Sample Day 1:', days[1]);
  console.log('Sample Day 2:', days[2]);
  console.log('Sample Day 365:', days[365]);
}
testAll();
