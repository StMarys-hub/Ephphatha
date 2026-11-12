async function main() {
  const res = await fetch('https://feeds.fireside.fm/bibleinayear/rss');
  const xml = await res.text();
  const items = xml.split('<item>');
  console.log('Total items in feed:', items.length);

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const titleMatch = item.match(/<title>([^<]+)<\/title>/);
    const encMatch = item.match(/<enclosure[^>]+url="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';
    const url = encMatch ? encMatch[1] : '';
    if (
      title.startsWith('Day 1:') ||
      title.startsWith('Day 2:') ||
      title.startsWith('Day 3:') ||
      title.startsWith('Day 10:')
    ) {
      console.log(title, '-->', url);
    }
  }
}
main();
