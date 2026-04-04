const podcasts = {};

async function loadBoth() {
  const rss1 = document.getElementById('rss-1').value.trim();
  const rss2 = document.getElementById('rss-2').value.trim();
  const errorMsg = document.getElementById('error-msg');

  errorMsg.innerHTML = '';

  if (!rss1 || !rss2) {
    errorMsg.innerHTML = '<div class="error">Please enter both RSS feed URLs</div>';
    return;
  }

  try {
    errorMsg.innerHTML = '<div style="color: #ffd709;">Loading...</div>';
    
    const [p1, p2] = await Promise.all([
      fetchAndParseRSS(rss1),
      fetchAndParseRSS(rss2)
    ]);

    podcasts[1] = p1;
    podcasts[2] = p2;

    errorMsg.innerHTML = '';
    document.getElementById('results').style.display = 'block';

    renderPodcastCards();
    renderEpisodesToday();
    renderTimeline();
    renderHeatmap();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Error:', error);
    errorMsg.innerHTML = `<div class="error">Error loading podcasts: ${error.message}</div>`;
  }
}

async function fetchAndParseRSS(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const xml = await response.text();
      return parseRSSXML(xml);
    }
  } catch (e) {
    console.log('Direct fetch failed, trying proxy...');
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Failed to fetch RSS feed');

  const xml = await response.text();
  return parseRSSXML(xml);
}

function parseRSSXML(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid RSS feed format');
  }

  const title = doc.querySelector('channel > title')?.textContent || 'Unknown Podcast';
  const description = doc.querySelector('channel > description')?.textContent || '';

  let image = '';
  const imageUrl = doc.querySelector('channel > image > url')?.textContent;
  const iTunesImage = doc.querySelector('[xmlns\\:itunes] image, itunes\\:image')?.getAttribute('href');
  image = iTunesImage || imageUrl || '';

  const items = doc.querySelectorAll('item');
  const episodes = [];

  items.forEach(item => {
    const episodeTitle = item.querySelector('title')?.textContent || 'Untitled';
    const episodeDesc = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';

    let duration = 0;
    const durationText = item.querySelector('[xmlns\\:itunes] duration, itunes\\:duration')?.textContent ||
                         item.querySelector('duration')?.textContent || '';

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

  episodes.sort((a, b) => b.pubDate - a.pubDate);

  return { title, description, image, episodes };
}

function renderPodcastCards() {
  const container = document.getElementById('podcast-cards');
  const colors = ['#ff89ab', '#ffd709'];

  let html = '';
  [1, 2].forEach(num => {
    const p = podcasts[num];
    const color = colors[num - 1];

    html += `
      <div class="podcast-card">
        ${p.image ? `<div class="podcast-image"><img src="${p.image}" alt="${p.title}"></div>` : '<div class="podcast-image">📻</div>'}
        <div class="podcast-title" style="color: ${color};">${p.title}</div>
        <div class="podcast-description">${p.description}</div>
        <div class="podcast-episodes-count">${p.episodes.length} Episodes</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderEpisodesToday() {
  const section = document.getElementById('episodes-today-section');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayEps1 = podcasts[1].episodes.filter(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const todayEps2 = podcasts[2].episodes.filter(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  if (todayEps1.length === 0 && todayEps2.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const avgDur1 = todayEps1.length > 0 ? Math.round(todayEps1.reduce((s, e) => s + e.duration, 0) / todayEps1.length / 60) : 0;
  const avgDur2 = todayEps2.length > 0 ? Math.round(todayEps2.reduce((s, e) => s + e.duration, 0) / todayEps2.length / 60) : 0;

  let html = '<div class="episodes-grid">';

  [1, 2].forEach(num => {
    const eps = num === 1 ? todayEps1 : todayEps2;
    const color = num === 1 ? '#ff89ab' : '#ffd709';
    const avgDur = num === 1 ? avgDur1 : avgDur2;

    html += `<div class="episodes-list">`;
    eps.forEach(ep => {
      html += `<div class="episode-item">${ep.title}</div>`;
    });
    html += `</div>`;
  });

  html += '</div>';

  document.getElementById('episodes-grid').innerHTML = html;
  document.getElementById('avg-duration-1').textContent = avgDur1 + 'm';
  document.getElementById('avg-duration-2').textContent = avgDur2 + 'm';
}

function renderTimeline() {
  const section = document.getElementById('timeline-section');
  const counts1 = [];
  const counts2 = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const c1 = podcasts[1].episodes.filter(ep => {
      const ed = new Date(ep.pubDate);
      ed.setHours(0, 0, 0, 0);
      return ed.getTime() === d.getTime();
    }).length;

    const c2 = podcasts[2].episodes.filter(ep => {
      const ed = new Date(ep.pubDate);
      ed.setHours(0, 0, 0, 0);
      return ed.getTime() === d.getTime();
    }).length;

    counts1.push(c1);
    counts2.push(c2);
  }

  const maxCount = Math.max(...counts1, ...counts2);
  if (maxCount === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  let html = '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const dayName = days[d.getDay()];
    const h1 = (counts1[i] / maxCount) * 150;
    const h2 = (counts2[i] / maxCount) * 150;

    html += `
      <div class="timeline-bar">
        <div class="bar-count">${Math.max(counts1[i], counts2[i])}</div>
        <div class="bar-container">
          <div class="bar bar-1" style="height: ${h1}px;"></div>
          <div class="bar bar-2" style="height: ${h2}px;"></div>
        </div>
        <div class="bar-label">${dayName}</div>
      </div>
    `;
  }

  document.getElementById('timeline').innerHTML = html;
}

function renderHeatmap() {
  const section = document.getElementById('heatmap-section');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days10 = [];

  for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days10.push(d);
  }

  let html = '<div class="heatmap-grid">';

  [1, 2].forEach(num => {
    const color = num === 1 ? '#ff89ab' : '#ffd709';
    const title = num === 1 ? podcasts[1].title : podcasts[2].title;

    html += `<div class="heatmap-column"><h4>${title}</h4><div class="weekdays">`;

    const dayCounts = {};
    days10.forEach(d => {
      const dow = d.getDay();
      if (!dayCounts[dow]) dayCounts[dow] = 0;

      const eps = podcasts[num].episodes.filter(ep => {
        const ed = new Date(ep.pubDate);
        ed.setHours(0, 0, 0, 0);
        const dd = new Date(d);
        dd.setHours(0, 0, 0, 0);
        return ed.getTime() === dd.getTime();
      });

      dayCounts[dow] += eps.length;
    });

    const maxDay = Math.max(...Object.values(dayCounts), 1);

    dayNames.forEach((name, idx) => {
      const count = dayCounts[idx] || 0;
      const intensity = maxDay > 0 ? count / maxDay : 0;
      const bgColor = `rgba(${num === 1 ? '255, 137, 171' : '255, 215, 9'}, ${0.1 + intensity * 0.5})`;

      html += `
        <div class="day-cell" style="background: ${bgColor}; border-color: ${intensity > 0.5 ? color : 'rgba(255, 255, 255, 0.1)'};">
          <div class="day-count">${count}</div>
          <div class="day-label">${name}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += '</div>';
  document.getElementById('heatmap').innerHTML = html;
}
