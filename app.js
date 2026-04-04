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
    errorMsg.innerHTML = '<div class="success">Loading...</div>';
    
    const [p1, p2] = await Promise.all([
      fetchAndParseRSS(rss1),
      fetchAndParseRSS(rss2)
    ]);

    podcasts[1] = p1;
    podcasts[2] = p2;

    errorMsg.innerHTML = '';
    document.getElementById('results').style.display = 'block';
    document.getElementById('fight-button-container').style.display = 'flex';

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
  let html = '';

  [1, 2].forEach(num => {
    const p = podcasts[num];

    html += `
      <div class="podcast-card">
        ${p.image ? `<div class="podcast-image"><img src="${p.image}" alt="${p.title}"></div>` : '<div class="podcast-image">📻</div>'}
        <div class="podcast-title">${p.title}</div>
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

  // Player One
  html += `<div class="episodes-list">`;
  html += `<h4>🎮 PLAYER ONE — ${todayEps1.length} Episode${todayEps1.length !== 1 ? 's' : ''}</h4>`;
  if (todayEps1.length > 0) {
    todayEps1.forEach(ep => {
      html += `<div class="episode-item">📌 ${ep.title}</div>`;
    });
    html += `<div class="duration-box"><div class="duration-label">Average Duration</div><div class="duration-value">${avgDur1}m</div></div>`;
  } else {
    html += `<div class="episode-item" style="color: #999; font-style: italic;">No episodes released today</div>`;
  }
  html += `</div>`;

  // Player Two
  html += `<div class="episodes-list">`;
  html += `<h4>🎮 PLAYER TWO — ${todayEps2.length} Episode${todayEps2.length !== 1 ? 's' : ''}</h4>`;
  if (todayEps2.length > 0) {
    todayEps2.forEach(ep => {
      html += `<div class="episode-item">📌 ${ep.title}</div>`;
    });
    html += `<div class="duration-box"><div class="duration-label">Average Duration</div><div class="duration-value" style="color: #ffd709;">${avgDur2}m</div></div>`;
  } else {
    html += `<div class="episode-item" style="color: #999; font-style: italic;">No episodes released today</div>`;
  }
  html += `</div>`;

  html += '</div>';

  document.getElementById('episodes-grid').innerHTML = html;
}

function renderTimeline() {
  const section = document.getElementById('timeline-section');
  const counts1 = [];
  const counts2 = [];
  const dates = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);

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
    const d = dates[i];
    const dayName = days[d.getDay()];
    const dateStr = (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getDate().toString().padStart(2, '0');
    const c1 = counts1[i];
    const c2 = counts2[i];
    const h1 = Math.max((c1 / maxCount) * 140, c1 > 0 ? 20 : 0);
    const h2 = Math.max((c2 / maxCount) * 140, c2 > 0 ? 20 : 0);

    html += `
      <div class="timeline-bar">
        <div class="bar-container">
          <div class="bar bar-1" style="height: ${h1}px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
            <span style="color: white; font-weight: 700; font-size: 0.9em;">${c1 > 0 ? c1 : ''}</span>
          </div>
          <div class="bar bar-2" style="height: ${h2}px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
            <span style="color: white; font-weight: 700; font-size: 0.9em;">${c2 > 0 ? c2 : ''}</span>
          </div>
        </div>
        <div class="bar-label" style="margin-top: 8px;">
          <div style="font-weight: 600; color: #333; font-size: 0.9em;">${dayName}</div>
          <div style="color: #999; font-size: 0.8em;">${dateStr}</div>
        </div>
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
    html += `<div class="heatmap-column"><h4>🎮 Player ${num === 1 ? 'One' : 'Two'}</h4><div class="weekdays">`;

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
      const bgColor = `rgba(${num === 1 ? '255, 137, 171' : '255, 215, 9'}, ${0.05 + intensity * 0.3})`;
      const borderColor = intensity > 0.5 ? (num === 1 ? '#ff89ab' : '#ffd709') : '#eee';

      html += `
        <div class="day-cell" style="background: ${bgColor}; border-color: ${borderColor};">
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

// FIGHT SYSTEM
function startFight() {
  if (!podcasts[1] || !podcasts[2]) {
    alert('Load both podcasts first!');
    return;
  }

  const modal = document.getElementById('fightModal');
  modal.classList.add('show');
  runFightAnimation();

  setTimeout(() => {
    modal.classList.remove('show');
  }, 8000);
}

function getTodayStats(playerNum) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayEpisodes = podcasts[playerNum].episodes.filter(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const episodeCount = todayEpisodes.length;
  const totalDuration = todayEpisodes.reduce((sum, ep) => sum + ep.duration, 0);
  const avgDuration = episodeCount > 0 ? Math.round(totalDuration / episodeCount / 60) : 0;
  const totalMinutes = Math.round(totalDuration / 60);

  return {
    episodeCount,
    avgDuration,
    totalMinutes,
    episodes: todayEpisodes
  };
}

function determineWinner() {
  const stats1 = getTodayStats(1);
  const stats2 = getTodayStats(2);

  // Scoring algorithm
  let score1 = 0;
  let score2 = 0;

  // Episodes count (most important)
  if (stats1.episodeCount > stats2.episodeCount) {
    score1 += 40;
  } else if (stats2.episodeCount > stats1.episodeCount) {
    score2 += 40;
  } else if (stats1.episodeCount > 0) {
    score1 += 20;
    score2 += 20;
  }

  // Average duration
  if (stats1.avgDuration > stats2.avgDuration) {
    score1 += 20;
  } else if (stats2.avgDuration > stats1.avgDuration) {
    score2 += 20;
  }

  // Total content (minutes)
  if (stats1.totalMinutes > stats2.totalMinutes) {
    score1 += 40;
  } else if (stats2.totalMinutes > stats1.totalMinutes) {
    score2 += 40;
  }

  return score1 > score2 ? 1 : score2 > score1 ? 2 : 1;
}

function runFightAnimation() {
  const content = document.getElementById('fightContent');
  const winner = determineWinner();
  const stats1 = getTodayStats(1);
  const stats2 = getTodayStats(2);

  const actions = [
    '💥 POWER PUNCH!',
    '⚡ LIGHTNING STRIKE!',
    '🔥 FIRE ATTACK!',
    '💣 EXPLOSION!',
    '🌟 SPECIAL MOVE!',
    '⚙️ COMBO HIT!',
    '🎯 DIRECT HIT!',
    '💫 ULTIMATE ATTACK!'
  ];

  let html = '';
  let delay = 0;

  // ROUND 1
  html += `<div class="round-title" style="animation-delay: ${delay}s;">ROUND 1</div>`;
  delay += 0.5;

  for (let i = 0; i < 2; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    html += `<div class="fight-action" style="animation-delay: ${delay}s;">${action}</div>`;
    delay += 0.6;
  }

  // ROUND 2
  html += `<div class="round-title" style="animation-delay: ${delay}s;">ROUND 2</div>`;
  delay += 0.5;

  for (let i = 0; i < 2; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    html += `<div class="fight-action" style="animation-delay: ${delay}s;">${action}</div>`;
    delay += 0.6;
  }

  // WINNER
  const winnerPodcast = podcasts[winner];
  const winnerStats = winner === 1 ? stats1 : stats2;
  const loserStats = winner === 1 ? stats2 : stats1;

  let explanation = '';
  if (winnerStats.episodeCount > loserStats.episodeCount) {
    explanation += `<strong>${podcasts[winner].title}</strong> released <strong>${winnerStats.episodeCount}</strong> episode${winnerStats.episodeCount > 1 ? 's' : ''} today vs ${loserStats.episodeCount} for its opponent. `;
  }
  if (winnerStats.totalMinutes > loserStats.totalMinutes) {
    explanation += `With <strong>${winnerStats.totalMinutes}</strong> minutes of content, it dominated the airwaves. `;
  }
  if (winnerStats.avgDuration > loserStats.avgDuration) {
    explanation += `Average episode duration of <strong>${winnerStats.avgDuration}m</strong> shows quality content!`;
  }

  html += `
    <div class="winner-section" style="animation-delay: ${delay}s;">
      <div class="round-title">🏆 WINNER 🏆</div>
      <div class="winner-image">
        ${winnerPodcast.image ? `<img src="${winnerPodcast.image}" alt="${winnerPodcast.title}">` : '<div style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">📻</div>'}
      </div>
      <div class="winner-name">${winnerPodcast.title}</div>
      <div class="winner-title">CHAMPION!</div>
      <div class="winner-explanation">${explanation}</div>
      <button class="close-fight" onclick="document.getElementById('fightModal').classList.remove('show');">CLOSE</button>
    </div>
  `;

  content.innerHTML = html;
}
