const https = require('https');
const fs = require('fs');

const sourceUrl = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function escapeXml(str) {
  return str?.replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  )) || '';
}

function formatRelative(start, end) {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate <= now && endDate >= now) {
    const endsIn = Math.round((endDate - now) / (1000 * 60 * 60));
    return `Happening now – ends in ~${endsIn}h`;
  }

  const delta = startDate - now;
  const days = Math.round(delta / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
}

function buildRss(events, title, description) {
  const items = events.map((event) => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const pubDate = startDate.toUTCString();

    const timeInfo = formatRelative(event.start, event.end);

    return `
    <item>
      <title>${escapeXml(event.name)}</title>
      <link>${event.link}</link>
      <description>${escapeXml(`${event.eventType} – ${timeInfo}`)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(event.id)}</guid>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>https://leekduck.com/events/</link>
    <description>${escapeXml(description)}</description>
    ${items}
  </channel>
</rss>`;
}

function filterCurrent(events) {
  const now = new Date();
  return events
    .filter(e => new Date(e.start) <= now && new Date(e.end) >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 1);
}

function filterUpcoming(events) {
  const now = new Date();
  return events
    .filter(e => new Date(e.start) > now)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Run script
fetchJson(sourceUrl).then((allEvents) => {
  const current = filterCurrent(allEvents);
  const upcoming = filterUpcoming(allEvents);

  fs.writeFileSync('pogo-current.xml', buildRss(current, 'Pokémon GO - Current Event', 'The event that is ongoing now.'));
  fs.writeFileSync('pogo-upcoming.xml', buildRss(upcoming, 'Pokémon GO - Upcoming Events', 'All upcoming events starting after now.'));

  console.log('✅ Generated pogo-current.xml and pogo-upcoming.xml (no emojis)');
}).catch(console.error);
