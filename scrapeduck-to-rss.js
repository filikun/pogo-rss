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

// Format date to RSS pubDate with local timezone offset
function formatRssDateLocal(date) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const dayName = days[date.getDay()];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  const tzOffset = -date.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHours = Math.floor(Math.abs(tzOffset) / 60).toString().padStart(2, '0');
  const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');

  return `${dayName}, ${day} ${month} ${year} ${hours}:${minutes}:${seconds} ${tzSign}${tzHours}${tzMinutes}`;
}

function buildRss(events, title, description) {
  const items = events.map((event) => {
    const startDate = new Date(event.start);
    const pubDate = formatRssDateLocal(startDate);

    const timeInfo = formatRelative(event.start, event.end);
    const imageTag = event.image
      ? `<enclosure url="${escapeXml(event.image)}" type="image/png" />`
      : '';

    return `
    <item>
      <title>${escapeXml(event.name)}</title>
      <link>${event.link}</link>
      <description>${escapeXml(`${event.eventType} – ${timeInfo}`)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(event.eventID || '')}</guid>
      ${imageTag}
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

function groupByEventType(events) {
  const map = new Map();
  events.forEach(event => {
    const type = event.eventType || 'unknown';
    if (!map.has(type)) {
      map.set(type, []);
    }
    map.get(type).push(event);
  });
  return map;
}

// Create docs folder if not exists
if (!fs.existsSync('docs')) {
  fs.mkdirSync('docs');
}

// Run script
fetchJson(sourceUrl).then((allEvents) => {
  const grouped = groupByEventType(allEvents);

  console.log('Found event types:', [...grouped.keys()]);

  for (const [eventType, events] of grouped) {
    // Sort ascending by start date (soonest first)
    const sortedEvents = events.sort((a, b) => new Date(a.start) - new Date(b.start));
    const title = `Pokémon GO Events - ${eventType}`;
    const description = `All events with eventType "${eventType}".`;

    const rss = buildRss(sortedEvents, title, description);

    const safeName = eventType.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(`docs/pogo-${safeName}.xml`, rss);
  }

  console.log('✅ Created RSS feeds per eventType in docs/');
}).catch(console.error);
