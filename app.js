// Global storage
const podcasts = {};

// Load podcast from RSS feed
async function loadPodcast(playerNum) {
  const rssUrl = document.getElementById(`rss-${playerNum}`).value.trim();
  const errorDiv = document.getElementById(`error-${playerNum}`);

  if (!rssUrl) {
    errorDiv.innerHTML = '<div class="error">Please enter an RSS feed URL</div>';
    return;
  }

  errorDiv.innerHTML = '<div class="success">Loading...</div>';

  try {
    const podcastData = await fetchAndParseRSS(rssUrl);
    podcasts[playerNum] = podcastData;
    errorDiv.innerHTML = '<div class="success">✓ Loaded successfully!</div>';

    // Show arena and stats
    document.getElementById('arena').style.display = 'grid';
    document.getElementById('stats').style.display = 'grid';

    // Render
    renderPodcast(podcastData, playerNum);
    updateStats();
  } catch (error) {
    console.error('Error:', error);
    errorDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

// Fetch and parse RSS feed
async function fetchAndParseRSS(url) {
  // Try direct fetch first
  try {
    const response = await fetch(url);
    if (response.ok) {
      const xml = await response.text();
      return parseRSSXML(xml);
    }
  } catch (e) {
    console.log('Direct fetch failed, trying proxy...');
  }

  // Fallback to CORS proxy
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Failed to fetch RSS feed');

  const xml = await response.text();
  return parseRSSXML(xml);
}

// Parse RSS XML
function parseRSSXML(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid RSS feed format');
  }

  // Get channel info
  const title = doc.querySelector('channel > title')?.textContent || 'Unknown Podcast';
  const description = doc.querySelector('channel > description')?.textContent || '';

  // Try to get image
  let image = '';
  const imageUrl = doc.querySelector('channel > image > url')?.textContent;
  const iTunesImage = doc.querySelector('[xmlns\\:itunes] image, itunes\\:image')?.getAttribute('href');
  image = iTunesImage || imageUrl || '';

  // Get episodes
  const items = doc.querySelectorAll('item');
  const episodes = [];

  items.forEach(item => {
    const episodeTitle = item.querySelector('title')?.textContent || 'Untitled';
    const episodeDesc = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';

    let duration = 0;
    const durationText = item.querySelector('[xmlns\\:itunes] duration, itunes\\:duration')?.textContent ||
                         item.querySelector('duration')?.textContent || '';

    // Parse duration (HH:MM:SS or MM:SS or seconds)
    if (durationText) {
      const parts = durationText.split(':');
      if (parts.length === 3) {
        duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else {
        duration = parseInt(durationText);
      }
    }

    episodes.push({
      title: episodeTitle,
      description: episodeDesc,
      pubDate: new Date(pubDate),
      duration: duration
    });
  });

  // Sort by date descending
  episodes.sort((a, b) => b.pubDate - a.pubDate);

  return {
    title,
    description,
    image,
    episodes
  };
}

// Render podcast card
function renderPodcast(podcastData, playerNum) {
  const card = document.getElementById(`podcast-${playerNum}`);
  const latestEpisode = podcastData.episodes[0];
  const latestDate = latestEpisode ? latestEpisode.pubDate.toLocaleDateString() : 'N/A';

  let html = '';
  if (podcastData.image) {
    html += `<div class="podcast-image"><img src="${podcastData.image}" alt="${podcastData.title}"></div>`;
  } else {
    html += `<div class="podcast-image">📻</div>`;
  }

  html += `<div class="podcast-title">${podcastData.title}</div>`;
  html += `<div class="podcast-description">${podcastData.description.substring(0, 100)}...</div>`;
  html += `<small>Latest: ${latestDate} | ${podcastData.episodes.length} episodes</small>`;

  card.innerHTML = html;
}

// Update statistics
function updateStats() {
  const p1 = podcasts[1];
  const p2 = podcasts[2];

  if (!p1 || !p2) return;

  // Today's episodes
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const today1 = p1.episodes.filter(ep => {
    const epDate = new Date(ep.pubDate);
    epDate.setHours(0, 0, 0, 0);
    return epDate.getTime() === today.getTime();
  }).length;

  const today2 = p2.episodes.filter(ep => {
    const epDate = new Date(ep.pubDate);
    epDate.setHours(0, 0, 0, 0);
    return epDate.getTime() === today.getTime();
  }).length;

  // Total episodes
  const total1 = p1.episodes.length;
  const total2 = p2.episodes.length;

  // Average duration
  const avgDuration1 = p1.episodes.length > 0
    ? Math.round(p1.episodes.reduce((sum, ep) => sum + ep.duration, 0) / p1.episodes.length / 60)
    : 0;
  const avgDuration2 = p2.episodes.length > 0
    ? Math.round(p2.episodes.reduce((sum, ep) => sum + ep.duration, 0) / p2.episodes.length / 60)
    : 0;

  // Update DOM
  document.getElementById('today-1').textContent = today1;
  document.getElementById('today-2').textContent = today2;
  document.getElementById('total-1').textContent = total1;
  document.getElementById('total-2').textContent = total2;
  document.getElementById('duration-1').textContent = avgDuration1 + 'm';
  document.getElementById('duration-2').textContent = avgDuration2 + 'm';
}
