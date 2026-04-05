const podcasts = {};
let pageLoadTime = Date.now();
const MIN_LOAD_TIME = 30000; // 30 seconds
const MAX_HISTORY = 10; // Maximum number of battles to keep in history

// Check if it's time to show the Konami button
function checkShowKonamiButton() {
  const now = Date.now();
  const elapsedTime = now - pageLoadTime;

  // Show button only if both podcasts are loaded AND 30 seconds have passed
  if (podcasts[1] && podcasts[2] && elapsedTime >= MIN_LOAD_TIME) {
    document.getElementById('fight-button-container').style.display = 'flex';
  }
}

async function loadBoth() {
  const rss1 = document.getElementById('rss-1').value.trim();
  const rss2 = document.getElementById('rss-2').value.trim();
  const errorMsg = document.getElementById('error-msg');

  errorMsg.innerHTML = '';

  if (!rss1 || !rss2) {
    errorMsg.innerHTML = '<div class="error">Veuillez entrer les deux URL de flux RSS</div>';
    return;
  }

  try {
    errorMsg.innerHTML = '<div class="success">Chargement...</div>';

    const [p1, p2] = await Promise.all([
      fetchAndParseRSS(rss1),
      fetchAndParseRSS(rss2)
    ]);

    podcasts[1] = p1;
    podcasts[2] = p2;

    errorMsg.innerHTML = '';
    document.getElementById('results').style.display = 'block';

    // Save battle to history
    saveBattle(rss1, p1.title, p1.image, rss2, p2.title, p2.image);

    // Check if button should be shown
    checkShowKonamiButton();

    // Show START button when podcasts are loaded
    document.getElementById('startBtn').style.display = 'inline-block';

    renderPodcastCards();
    renderTimeline();
    renderHeatmap();
    renderEpisodeFullList();
    renderAvgDurationToday();
    render10DayHeatmap();
    renderAnalysisSummary();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Error:', error);
    errorMsg.innerHTML = `<div class="error">Erreur lors du chargement des podcasts: ${error.message}</div>`;
  }
}

// Battle History Management
function saveBattle(url1, title1, image1, url2, title2, image2) {
  const battles = getBattleHistory();

  const newBattle = {
    url1,
    title1,
    image1,
    url2,
    title2,
    image2,
    timestamp: new Date().toISOString()
  };

  // Check if this exact battle already exists at the top (avoid duplicates)
  if (battles.length > 0) {
    const lastBattle = battles[0];
    if (lastBattle.url1 === url1 && lastBattle.url2 === url2) {
      return; // Don't save duplicate
    }
  }

  battles.unshift(newBattle);

  // Keep only the last 10 battles
  if (battles.length > MAX_HISTORY) {
    battles.pop();
  }

  localStorage.setItem('podcastFighterHistory', JSON.stringify(battles));
}

function getBattleHistory() {
  const stored = localStorage.getItem('podcastFighterHistory');
  return stored ? JSON.parse(stored) : [];
}

function showHistoryModal() {
  const modal = document.getElementById('historyModal');
  const grid = document.getElementById('historyGrid');
  const battles = getBattleHistory();

  if (battles.length === 0) {
    grid.innerHTML = '<div class="history-empty">Aucune battle enregistrée</div>';
  } else {
    grid.innerHTML = battles.map((battle, idx) => {
      const date = new Date(battle.timestamp);
      const dateStr = date.toLocaleDateString('fr-FR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="battle-card" data-url1="${escapeHtml(battle.url1)}" data-url2="${escapeHtml(battle.url2)}" onclick="loadBattleFromHistoryCard(this)">
          <div class="battle-images">
            <div class="battle-image">
              ${battle.image1 ? `<img src="${battle.image1}" alt="${battle.title1}">` : '📻'}
            </div>
            <div class="battle-vs">VS</div>
            <div class="battle-image">
              ${battle.image2 ? `<img src="${battle.image2}" alt="${battle.title2}">` : '📻'}
            </div>
          </div>
          <div class="battle-names">
            <div class="battle-names-item">${battle.title1}</div>
            <div class="battle-names-item">${battle.title2}</div>
          </div>
          <div class="battle-date">${dateStr}</div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('show');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('show');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function loadBattleFromHistoryCard(element) {
  const url1 = element.dataset.url1;
  const url2 = element.dataset.url2;
  loadBattleFromHistory(url1, url2);
}

function loadBattleFromHistory(url1, url2) {
  // Fill in the input fields
  document.getElementById('rss-1').value = url1;
  document.getElementById('rss-2').value = url2;

  // Close the modal
  closeHistoryModal();

  // Scroll to the input area
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // User must click INSERT COIN to load
  const errorMsg = document.getElementById('error-msg');
  errorMsg.innerHTML = '<div class="success">URLs remplies! Cliquez sur INSÉRER PIÈCE pour charger.</div>';
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
  if (!response.ok) throw new Error('Impossible de récupérer le flux RSS');

  const xml = await response.text();
  return parseRSSXML(xml);
}

function parseRSSXML(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Format de flux RSS invalide');
  }

  const title = doc.querySelector('channel > title')?.textContent || 'Podcast Inconnu';
  const description = doc.querySelector('channel > description')?.textContent || '';

  let image = '';
  const imageUrl = doc.querySelector('channel > image > url')?.textContent;
  const iTunesImage = doc.querySelector('[xmlns\\:itunes] image, itunes\\:image')?.getAttribute('href');
  image = iTunesImage || imageUrl || '';

  const items = doc.querySelectorAll('item');
  const episodes = [];

  items.forEach(item => {
    const episodeTitle = item.querySelector('title')?.textContent || 'Sans titre';
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
        <div class="podcast-episodes-count">${p.episodes.length} Épisodes</div>
      </div>
    `;
  });

  container.innerHTML = html;
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
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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
    html += `<div class="heatmap-column"><h4>🎮 ${num === 1 ? 'JOUEUR UN' : 'JOUEUR DEUX'}</h4><div class="weekdays">`;

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

    // Find this player's best day
    const maxCountForPlayer = Math.max(...Object.values(dayCounts), 1);

    dayNames.forEach((name, idx) => {
      const count = dayCounts[idx] || 0;
      const intensity = maxCountForPlayer > 0 ? count / maxCountForPlayer : 0;
      const bgColor = `rgba(${num === 1 ? '255, 137, 171' : '255, 215, 9'}, ${0.05 + intensity * 0.3})`;

      // Highlight this player's best day(s)
      const isBestDay = count === maxCountForPlayer && count > 0;
      const borderColor = isBestDay ? (num === 1 ? '#ff89ab' : '#ffd709') : '#eee';
      const borderWidth = isBestDay ? '3px' : '1px';
      const boxShadow = isBestDay ? (num === 1 ? '0 0 12px rgba(255, 137, 171, 0.6)' : '0 0 12px rgba(255, 215, 9, 0.6)') : 'none';

      html += `
        <div class="day-cell" style="background: ${bgColor}; border-color: ${borderColor}; border-width: ${borderWidth}; box-shadow: ${boxShadow};">
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
    alert('Chargez les deux podcasts d\'abord!');
    return;
  }

  const modal = document.getElementById('fightModal');
  modal.classList.add('show');
  runFightAnimation();
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

  // Primary: Episodes count wins
  if (stats1.episodeCount > stats2.episodeCount) {
    return 1;
  } else if (stats2.episodeCount > stats1.episodeCount) {
    return 2;
  }

  // Tiebreaker: Total duration of today's episodes
  if (stats1.totalMinutes > stats2.totalMinutes) {
    return 1;
  } else if (stats2.totalMinutes > stats1.totalMinutes) {
    return 2;
  }

  // If completely tied, player 1 wins by default
  return 1;
}

function runFightAnimation() {
  const content = document.getElementById('fightContent');
  const winner = determineWinner();
  const stats1 = getTodayStats(1);
  const stats2 = getTodayStats(2);

  const actions = [
    '💥 COUP PUISSANT!',
    '⚡ ÉCLAIR FULGURANT!',
    '🔥 ATTAQUE INCENDIAIRE!',
    '💣 EXPLOSION!',
    '🌟 COUP SPÉCIAL!',
    '⚙️ COMBO CHAÎNÉ!',
    '🎯 COUP DIRECT!',
    '💫 ATTAQUE ULTIME!',
    '🌪️ COUP DE TORNADE!',
    '⭐ MÉGA EXPLOSION!'
  ];

  // ROUND 1 (0-2s)
  setTimeout(() => {
    let html = `<div class="round-title">⚔️ ROUND 1</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
    }
    content.innerHTML = html;
  }, 0);

  // ROUND 2 (2-4s)
  setTimeout(() => {
    let html = `<div class="round-title">⚔️ ROUND 2</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
    }
    content.innerHTML = html;
  }, 2000);

  // RÉSULTAT (4-8s+)
  setTimeout(() => {
    const winnerPodcast = podcasts[winner];

    let html = `
      <div class="winner-section" style="animation-delay: 0.5s;">
        <div class="winner-image" style="width: 300px; height: 300px; margin: 0 auto 40px; box-shadow: 0 0 60px rgba(255, 215, 9, 0.8); border-width: 6px;">
          ${winnerPodcast.image ? `<img src="${winnerPodcast.image}" alt="${winnerPodcast.title}">` : '<div style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 120px;">📻</div>'}
        </div>
        <div style="font-size: 4.5em; font-weight: 900; margin-bottom: 20px; color: #ffd709; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 20px rgba(255, 215, 9, 0.6);">${winnerPodcast.title}</div>
        <div style="font-size: 3.5em; color: #ff89ab; margin-bottom: 40px; font-weight: 700; letter-spacing: 2px; animation: pulse 1s infinite;">WIN!!!!</div>
      </div>
    `;
    content.innerHTML = html;
  }, 4000);

  // Analysis Summary (5-8s+)
  setTimeout(() => {
    const analysisHtml = renderAnalysisSummary(true);
    const analysisSection = document.createElement('div');
    analysisSection.style.marginTop = '40px';
    analysisSection.style.paddingTop = '30px';
    analysisSection.style.borderTop = '2px solid #ff00ff';
    analysisSection.innerHTML = `<div style="text-align: center; margin-bottom: 20px; font-size: 1.3em; color: #00ffff; font-weight: bold; text-shadow: 0 0 10px #00ffff;">🎯 Analyse Comparative</div>${analysisHtml}`;
    content.appendChild(analysisSection);

    // Add close button at the end
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-fight';
    closeBtn.textContent = 'FERMER';
    closeBtn.style.marginTop = '40px';
    closeBtn.onclick = () => document.getElementById('fightModal').classList.remove('show');
    content.appendChild(closeBtn);
  }, 5000);
}

// New Card: Full Episode List with Names
function renderEpisodeFullList() {
  const section = document.getElementById('episodes-full-list-section');
  if (!podcasts[1] || !podcasts[2]) return;

  const today = new Date().toDateString();
  const eps1 = podcasts[1].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);
  const eps2 = podcasts[2].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);

  let html = '<div class="episodes-horizontal-container">';

  // Podcast 1
  html += '<div class="episodes-podcast-column">';
  html += `<div class="episodes-podcast-header">${podcasts[1].title}</div>`;
  if (eps1.length > 0) {
    html += '<div class="episodes-list-items">';
    eps1.forEach(ep => {
      const duration = Math.round(ep.duration / 60);
      html += `<div class="episode-list-item">
                 <div class="episode-item-title">${ep.title}</div>
                 <div class="episode-item-duration">⏱️ ${duration} min</div>
               </div>`;
    });
    html += '</div>';
    html += `<div class="episode-count-badge">${eps1.length} épisode${eps1.length > 1 ? 's' : ''}</div>`;
  } else {
    html += '<div class="episodes-empty">Aucun épisode</div>';
  }
  html += '</div>';

  // Podcast 2
  html += '<div class="episodes-podcast-column">';
  html += `<div class="episodes-podcast-header">${podcasts[2].title}</div>`;
  if (eps2.length > 0) {
    html += '<div class="episodes-list-items">';
    eps2.forEach(ep => {
      const duration = Math.round(ep.duration / 60);
      html += `<div class="episode-list-item">
                 <div class="episode-item-title">${ep.title}</div>
                 <div class="episode-item-duration">⏱️ ${duration} min</div>
               </div>`;
    });
    html += '</div>';
    html += `<div class="episode-count-badge">${eps2.length} épisode${eps2.length > 1 ? 's' : ''}</div>`;
  } else {
    html += '<div class="episodes-empty">Aucun épisode</div>';
  }
  html += '</div>';

  html += '</div>';

  document.getElementById('full-list-grid').innerHTML = html;
  section.style.display = 'block';
}

// New Card: Average Duration Today
function renderAvgDurationToday() {
  const section = document.getElementById('avg-duration-today-section');
  if (!podcasts[1] || !podcasts[2]) return;

  const today = new Date().toDateString();
  const eps1 = podcasts[1].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);
  const eps2 = podcasts[2].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);

  const avgDuration1 = eps1.length > 0 ? Math.round(eps1.reduce((sum, ep) => sum + ep.duration, 0) / eps1.length) : 0;
  const avgDuration2 = eps2.length > 0 ? Math.round(eps2.reduce((sum, ep) => sum + ep.duration, 0) / eps2.length) : 0;

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  let html = '<div class="duration-horizontal-container">';
  html += `<div class="duration-card">
             <div class="duration-label">${podcasts[1].title}</div>
             <div class="duration-value">${formatDuration(avgDuration1)}</div>
           </div>`;
  html += `<div class="duration-card">
             <div class="duration-label">${podcasts[2].title}</div>
             <div class="duration-value">${formatDuration(avgDuration2)}</div>
           </div>`;
  html += '</div>';

  document.getElementById('avg-duration-grid').innerHTML = html;
  section.style.display = 'block';
}

// New Card: 10-Day Activity Heatmap
// Generate 10-day activity analysis
function generate10DayAnalysis(dates, dayCounts1, dayCounts2, pod1, pod2) {
  // Analyze by day of week
  const dayPatterns = { 0: { name: 'Dim', c1: [], c2: [] }, 1: { name: 'Lun', c1: [], c2: [] }, 2: { name: 'Mar', c1: [], c2: [] }, 3: { name: 'Mer', c1: [], c2: [] }, 4: { name: 'Jeu', c1: [], c2: [] }, 5: { name: 'Ven', c1: [], c2: [] }, 6: { name: 'Sam', c1: [], c2: [] } };

  dates.forEach(date => {
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    const dayOfWeek = date.getDay();
    dayPatterns[dayOfWeek].c1.push(dayCounts1[dateStr]);
    dayPatterns[dayOfWeek].c2.push(dayCounts2[dateStr]);
  });

  // Calculate averages for each day
  Object.keys(dayPatterns).forEach(day => {
    const pattern = dayPatterns[day];
    pattern.avg1 = pattern.c1.length > 0 ? (pattern.c1.reduce((a, b) => a + b) / pattern.c1.length) : 0;
    pattern.avg2 = pattern.c2.length > 0 ? (pattern.c2.reduce((a, b) => a + b) / pattern.c2.length) : 0;
  });

  // Identify patterns
  const monTueAvg1 = (dayPatterns[1].avg1 + dayPatterns[2].avg1) / 2;
  const monTueAvg2 = (dayPatterns[1].avg2 + dayPatterns[2].avg2) / 2;
  const wedThuAvg1 = (dayPatterns[3].avg1 + dayPatterns[4].avg1) / 2;
  const wedThuAvg2 = (dayPatterns[3].avg2 + dayPatterns[4].avg2) / 2;
  const friAvg1 = dayPatterns[5].avg1;
  const friAvg2 = dayPatterns[5].avg2;
  const weekendAvg1 = (dayPatterns[6].avg1 + dayPatterns[0].avg1) / 2;
  const weekendAvg2 = (dayPatterns[6].avg2 + dayPatterns[0].avg2) / 2;

  const maxAvg1 = Math.max(monTueAvg1, wedThuAvg1, friAvg1, weekendAvg1);
  const maxAvg2 = Math.max(monTueAvg2, wedThuAvg2, friAvg2, weekendAvg2);

  const isHighWeekend1 = weekendAvg1 > maxAvg1 * 0.6;
  const isHighWeekend2 = weekendAvg2 > maxAvg2 * 0.6;

  let analysis = `<div class="ten-day-analysis" style="margin-top: 32px; padding: 24px; background: rgba(0, 50, 100, 0.3); border: 2px solid #00ffff; border-radius: 4px; color: #00ff88; font-size: 0.95em; line-height: 1.8; text-align: left;">
    <div style="color: #ffff00; font-weight: 700; font-size: 1.05em; margin-bottom: 16px;">📊 Analyse de l'Activité</div>

    <div style="color: #00ff88; margin-bottom: 14px;">
      L'observation de l'activité sur 10 jours met en évidence une concentration des publications en ${friAvg1 > 0 || friAvg2 > 0 ? 'début et fin de semaine' : 'certains jours stratégiques'}, avec un pic ${friAvg1 > monTueAvg1 && friAvg2 > monTueAvg2 ? 'très marqué le vendredi' : 'identifié'} pour les deux podcasts.
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">Le vendredi apparaît comme le jour stratégique principal :</div>

    <div style="margin-left: 16px; margin-bottom: 14px; color: #00ff88;">
      • <span class="analysis-highlight" style="color: #ff00ff; font-weight: 700;">${pod1}</span> atteint un maximum de ${Math.round(friAvg1)} épisode${Math.round(friAvg1) > 1 ? 's' : ''}<br>
      • <span class="analysis-highlight" style="color: #ffd709; font-weight: 700;">${pod2}</span> y publie également son volume le plus élevé (${Math.round(friAvg2)} épisode${Math.round(friAvg2) > 1 ? 's' : ''})
    </div>

    <div style="color: #00ff88; margin-bottom: 14px;">
      En complément, le début de semaine (lundi et mardi) constitue un second temps fort, particulièrement pour <span style="color: #ff00ff; font-weight: 700;">${pod1}</span>, avec des volumes élevés (jusqu'à ${Math.round(Math.max(...dayPatterns[1].c1, ...dayPatterns[2].c1))} épisodes par jour), tandis que <span style="color: #ffd709; font-weight: 700;">${pod2}</span> reste stable autour de ${Math.round(monTueAvg2)} épisodes.
    </div>

    <div style="color: #00ff88; margin-bottom: 14px;">
      À l'inverse, le milieu de semaine (mercredi/jeudi) montre un léger ralentissement ${wedThuAvg1 < monTueAvg1 || wedThuAvg2 < monTueAvg2 ? '(baisse confirmée)' : ''}, avant une reprise nette le vendredi. Le week-end est ${isHighWeekend1 || isHighWeekend2 ? 'également actif' : 'plus calme'}, avec des volumes ${isHighWeekend1 || isHighWeekend2 ? 'significatifs et réguliers' : 'modérés et réguliers'} pour les deux podcasts.
    </div>
  </div>`;

  return analysis;
}

function render10DayHeatmap() {
  const section = document.getElementById('ten-day-activity-section');
  if (!podcasts[1] || !podcasts[2]) return;

  const dates = [];
  const dayCounts1 = {};
  const dayCounts2 = {};

  // Get last 10 days
  for (let i = 9; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    dates.push(date);
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    dayCounts1[dateStr] = 0;
    dayCounts2[dateStr] = 0;
  }

  // Count episodes
  podcasts[1].episodes.forEach(ep => {
    const epDate = new Date(ep.pubDate);
    epDate.setHours(0, 0, 0, 0);
    const dateStr = epDate.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    if (dayCounts1[dateStr] !== undefined) dayCounts1[dateStr]++;
  });

  podcasts[2].episodes.forEach(ep => {
    const epDate = new Date(ep.pubDate);
    epDate.setHours(0, 0, 0, 0);
    const dateStr = epDate.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    if (dayCounts2[dateStr] !== undefined) dayCounts2[dateStr]++;
  });

  const maxCount = Math.max(...dates.map(d => {
    const dateStr = d.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    return Math.max(dayCounts1[dateStr], dayCounts2[dateStr]);
  }));

  if (maxCount === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Find peak days for each podcast
  let maxDay1 = { date: '', count: 0, dayName: '' };
  let maxDay2 = { date: '', count: 0, dayName: '' };

  dates.forEach(date => {
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    const dayName = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];

    if (dayCounts1[dateStr] > maxDay1.count) {
      maxDay1 = { date: dateStr, count: dayCounts1[dateStr], dayName };
    }
    if (dayCounts2[dateStr] > maxDay2.count) {
      maxDay2 = { date: dateStr, count: dayCounts2[dateStr], dayName };
    }
  });

  let html = '<div class="ten-day-heatmap-container">';

  // Render 10 days horizontally
  dates.forEach(date => {
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    const c1 = dayCounts1[dateStr];
    const c2 = dayCounts2[dateStr];
    const intensity1 = maxCount > 0 ? c1 / maxCount : 0;
    const intensity2 = maxCount > 0 ? c2 / maxCount : 0;
    const bgColor1 = `rgba(255, 0, 255, ${0.2 + intensity1 * 0.8})`;
    const bgColor2 = `rgba(255, 215, 9, ${0.2 + intensity2 * 0.8})`;
    const borderColor1 = intensity1 > 0.7 ? '#ff00ff' : '#00ffff';
    const borderColor2 = intensity2 > 0.7 ? '#ffff00' : '#00ffff';

    const dayName = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];

    html += `
      <div class="ten-day-bar-group">
        <div class="ten-day-bars">
          <div class="ten-day-bar" style="background: ${bgColor1}; border-color: ${borderColor1};">
            <span>${c1}</span>
          </div>
          <div class="ten-day-bar" style="background: ${bgColor2}; border-color: ${borderColor2};">
            <span>${c2}</span>
          </div>
        </div>
        <div class="ten-day-label">
          <div style="font-weight: 600; color: #00ffff; font-size: 0.85em;">${dayName}</div>
          <div style="color: #00ff88; font-size: 0.75em;">${dateStr}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';

  // Add peak day information
  html += `<div class="ten-day-peak-info">
    <div style="color: #ff00ff; font-weight: 700; margin-top: 20px; font-size: 0.95em;">
      📌 ${podcasts[1].title}: Jour de pic = <span style="color: #ffff00;">${maxDay1.dayName} ${maxDay1.date}</span> (${maxDay1.count} épisode${maxDay1.count > 1 ? 's' : ''})
    </div>
    <div style="color: #ffd709; font-weight: 700; margin-top: 12px; font-size: 0.95em;">
      📌 ${podcasts[2].title}: Jour de pic = <span style="color: #ffff00;">${maxDay2.dayName} ${maxDay2.date}</span> (${maxDay2.count} épisode${maxDay2.count > 1 ? 's' : ''})
    </div>
  </div>`;

  // Generate and add analysis
  const analysis = generate10DayAnalysis(dates, dayCounts1, dayCounts2, podcasts[1].title, podcasts[2].title);
  html += analysis;

  document.getElementById('ten-day-heatmap').innerHTML = html;
}

// New Card: Analysis Summary
function renderAnalysisSummary(intoModal = false) {
  if (!podcasts[1] || !podcasts[2]) return '';

  const today = new Date().toDateString();

  // Get data for today
  const eps1Today = podcasts[1].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);
  const eps2Today = podcasts[2].episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);

  // Get data for last 7 days
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last7Days.push(d);
  }

  const eps1_7d = podcasts[1].episodes.filter(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    return last7Days.some(date => date.getTime() === d.getTime());
  });

  const eps2_7d = podcasts[2].episodes.filter(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    return last7Days.some(date => date.getTime() === d.getTime());
  });

  // Calculate average duration (today)
  const totalDur1Today = eps1Today.reduce((sum, ep) => sum + ep.duration, 0);
  const totalDur2Today = eps2Today.reduce((sum, ep) => sum + ep.duration, 0);
  const avgDur1Today = eps1Today.length > 0 ? Math.round(totalDur1Today / eps1Today.length / 60) : 0;
  const avgDur2Today = eps2Today.length > 0 ? Math.round(totalDur2Today / eps2Today.length / 60) : 0;

  // Calculate average duration (7 days)
  const totalDur1_7d = eps1_7d.reduce((sum, ep) => sum + ep.duration, 0);
  const totalDur2_7d = eps2_7d.reduce((sum, ep) => sum + ep.duration, 0);
  const avgDur1_7d = eps1_7d.length > 0 ? Math.round(totalDur1_7d / eps1_7d.length / 60) : 0;
  const avgDur2_7d = eps2_7d.length > 0 ? Math.round(totalDur2_7d / eps2_7d.length / 60) : 0;

  // Calculate frequency (episodes per day over 7 days)
  const freq1 = (eps1_7d.length / 7).toFixed(1);
  const freq2 = (eps2_7d.length / 7).toFixed(1);

  // Calculate total duration (7 days, in hours)
  const totalHours1_7d = Math.round(totalDur1_7d / 3600);
  const totalHours2_7d = Math.round(totalDur2_7d / 3600);

  const pod1 = podcasts[1].title;
  const pod2 = podcasts[2].title;

  let analysis = `<strong>Analyse Comparative sur la Période Observée</strong><br><br>`;

  // Section 1: Frequency Analysis
  analysis += `${eps1_7d.length > eps2_7d.length ? `<span class="analysis-highlight">${pod1}</span>` : `<span class="analysis-highlight">${pod2}</span>`} présente une activité de publication plus soutenue, avec une moyenne de <strong>${Math.max(freq1, freq2)}</strong> épisode${Math.max(freq1, freq2) > 1.5 ? 's' : ''} par jour, contre <strong>${Math.min(freq1, freq2)}</strong> épisode${Math.min(freq1, freq2) > 1 ? 's' : ''} quotidien${Math.min(freq1, freq2) > 1 ? 's' : ''} pour l'autre. Cette fréquence ${eps1_7d.length > eps2_7d.length ? 'plus élevée de ' + pod1 + ' traduit' : 'moins élevée de ' + pod1 + ' traduit'} une stratégie de présence ${eps1_7d.length > eps2_7d.length ? 'renforcée' : 'plus ciblée'} dans les flux d'écoute.<br><br>`;

  // Section 2: Duration Analysis
  if (avgDur1_7d !== avgDur2_7d) {
    const longerPod = avgDur1_7d > avgDur2_7d ? pod1 : pod2;
    const longerDur = Math.max(avgDur1_7d, avgDur2_7d);
    const shorterDur = Math.min(avgDur1_7d, avgDur2_7d);
    analysis += `En revanche, <span class="analysis-highlight">${longerPod}</span> se distingue par des formats plus longs, avec une durée moyenne d'environ <strong>${longerDur} minutes</strong> par épisode, soit ${Math.round((longerDur / shorterDur) * 10) / 10}x celle de l'autre (<strong>${shorterDur} minutes</strong>). Cela suggère un positionnement éditorial davantage orienté vers des contenus approfondis, là où l'autre privilégie des formats ${shorterDur < 15 ? 'courts et plus digestes' : 'modérés'}.<br><br>`;
  }

  // Section 3: 7-Day Rhythm
  analysis += `<strong>Rythme de Publication (7 Derniers Jours)</strong><br>`;
  analysis += `${eps1_7d.length >= eps2_7d.length ? pod1 : pod2} maintient une cadence ${eps1_7d.length >= eps2_7d.length ? 'élevée et régulière' : 'plus modérée'}, favorisant la récurrence d'exposition. ${eps1_7d.length < eps2_7d.length ? pod1 : pod2} adopte un rythme ${eps1_7d.length < eps2_7d.length ? 'plus modéré' : 'soutenu'}, ${totalHours1_7d !== totalHours2_7d ? 'compensé par une durée d\'écoute cumulée ' + (totalHours1_7d > totalHours2_7d ? 'supérieure' : 'équivalente') : 'avec une durée d\'écoute comparable'}.<br><br>`;

  // Section 4: Summary
  analysis += `<strong>Synthèse Positionnement</strong><br>`;
  if (eps1_7d.length > eps2_7d.length) {
    analysis += `<span class="analysis-highlight">${pod1}</span> = volume élevé, régularité, formats ${avgDur1_7d < 15 ? 'courts' : avgDur1_7d < 25 ? 'modérés' : 'longs'}<br>`;
    analysis += `<span class="analysis-highlight">${pod2}</span> = densité, formats ${avgDur2_7d > 20 ? 'longs' : 'modérés'}, approche éditoriale ${avgDur2_7d > 20 ? 'approfondie' : 'équilibrée'}`;
  } else {
    analysis += `<span class="analysis-highlight">${pod2}</span> = volume élevé, régularité, formats ${avgDur2_7d < 15 ? 'courts' : avgDur2_7d < 25 ? 'modérés' : 'longs'}<br>`;
    analysis += `<span class="analysis-highlight">${pod1}</span> = densité, formats ${avgDur1_7d > 20 ? 'longs' : 'modérés'}, approche éditoriale ${avgDur1_7d > 20 ? 'approfondie' : 'équilibrée'}`;
  }

  let html = `<div class="analysis-text">${analysis}</div>`;

  // If rendering to modal, return HTML string; otherwise render to page
  if (intoModal) {
    return html;
  } else {
    document.getElementById('analysis-text').innerHTML = html;
    const section = document.getElementById('analysis-summary-section');
    section.style.display = 'block';
  }
}

// Matrix Mode Functions
function showMatrixMode() {
  if (!podcasts[1] || !podcasts[2]) {
    alert('⚠️ You must load podcast feeds first');
    return;
  }

  document.body.classList.add('matrix-mode');
  const modal = document.getElementById('matrixModal');
  modal.classList.add('show');

  // Generate Matrix falling characters animation
  generateMatrixCharacters();

  // Populate Matrix data
  populateMatrixData();
}

function closeMatrixMode() {
  document.body.classList.remove('matrix-mode');
  const modal = document.getElementById('matrixModal');
  modal.classList.remove('show');

  // Clear falling characters
  document.querySelectorAll('.matrix-char').forEach(char => char.remove());
}

function generateMatrixCharacters() {
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

  for (let i = 0; i < 30; i++) {
    const char = document.createElement('div');
    char.className = 'matrix-char';
    char.textContent = chars[Math.floor(Math.random() * chars.length)];

    const x = Math.random() * window.innerWidth;
    const duration = 3 + Math.random() * 4;
    const delay = Math.random() * 2;

    char.style.left = x + 'px';
    char.style.top = '-30px';
    char.style.animationDuration = duration + 's';
    char.style.animationDelay = delay + 's';

    document.body.appendChild(char);

    setTimeout(() => {
      char.remove();
    }, (duration + delay) * 1000);
  }

  // Continuously generate new characters
  setInterval(() => {
    if (document.getElementById('matrixModal').classList.contains('show')) {
      const char = document.createElement('div');
      char.className = 'matrix-char';
      char.textContent = chars[Math.floor(Math.random() * chars.length)];

      const x = Math.random() * window.innerWidth;
      const duration = 3 + Math.random() * 4;

      char.style.left = x + 'px';
      char.style.top = '-30px';
      char.style.animationDuration = duration + 's';

      document.body.appendChild(char);

      setTimeout(() => {
        char.remove();
      }, duration * 1000);
    }
  }, 1500);
}

function populateMatrixData() {
  if (!podcasts[1] || !podcasts[2]) return;

  const pod1 = podcasts[1];
  const pod2 = podcasts[2];

  const today = new Date().toDateString();
  const eps1Today = pod1.episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);
  const eps2Today = pod2.episodes.filter(ep => new Date(ep.pubDate).toDateString() === today);

  // Stats
  const dur1 = eps1Today.length > 0 ? Math.round(eps1Today.reduce((s, e) => s + e.duration, 0) / eps1Today.length / 60) : 0;
  const dur2 = eps2Today.length > 0 ? Math.round(eps2Today.reduce((s, e) => s + e.duration, 0) / eps2Today.length / 60) : 0;

  const statsHtml = `
    <div class="matrix-stat">
      <div class="matrix-stat-label">&gt; ${pod1.title}</div>
      <div class="matrix-stat-value">${eps1Today.length}</div>
      <div class="matrix-stat-label">AVG: ${dur1}min</div>
    </div>
    <div class="matrix-stat">
      <div class="matrix-stat-label">&gt; ${pod2.title}</div>
      <div class="matrix-stat-value">${eps2Today.length}</div>
      <div class="matrix-stat-label">AVG: ${dur2}min</div>
    </div>
  `;
  document.getElementById('matrixStats').innerHTML = statsHtml;

  // Episodes
  const ep1Html = eps1Today.length > 0 ? eps1Today.map(ep => `
    <div class="matrix-item">&gt; ${ep.title.substring(0, 35)}...</div>
  `).join('') : '<div class="matrix-item">&gt; [NO_DATA_TODAY]</div>';

  const ep2Html = eps2Today.length > 0 ? eps2Today.map(ep => `
    <div class="matrix-item">&gt; ${ep.title.substring(0, 35)}...</div>
  `).join('') : '<div class="matrix-item">&gt; [NO_DATA_TODAY]</div>';

  const episodesHtml = `
    <div class="matrix-column">
      <div class="matrix-column-title">&gt;&gt; ${pod1.title.substring(0, 30)}</div>
      ${ep1Html}
    </div>
    <div class="matrix-column">
      <div class="matrix-column-title">&gt;&gt; ${pod2.title.substring(0, 30)}</div>
      ${ep2Html}
    </div>
  `;
  document.getElementById('matrixEpisodes').innerHTML = episodesHtml;

  // Timeline (7 days)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d);
  }

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const timeline = last7Days.map(date => {
    const dayStr = date.toDateString();
    const count1 = pod1.episodes.filter(ep => new Date(ep.pubDate).toDateString() === dayStr).length;
    const count2 = pod2.episodes.filter(ep => new Date(ep.pubDate).toDateString() === dayStr).length;
    const day = dayNames[date.getDay()];
    const dateNum = date.getDate().toString().padStart(2, '0');

    return `<div class="matrix-item">&gt; ${day} ${dateNum}: P1=${count1} P2=${count2}</div>`;
  }).join('');

  document.getElementById('matrixTimeline').innerHTML = timeline;

  // Analysis
  const winner = eps1Today.length > eps2Today.length ? pod1.title : pod2.title;
  const analysisText = `
> SYSTEM.ANALYSIS.EXECUTE()
> ========================
> PODCAST_1: ${pod1.title}
> EPISODES_TODAY: ${eps1Today.length}
> AVG_DURATION: ${dur1} minutes
>
> PODCAST_2: ${pod2.title}
> EPISODES_TODAY: ${eps2Today.length}
> AVG_DURATION: ${dur2} minutes
>
> WINNER: ${winner}
> STATUS: [ANALYSIS_COMPLETE]
> ========================
`.trim();

  document.getElementById('matrixAnalysis').textContent = analysisText;
}

// Close matrix modal when clicking outside
document.addEventListener('click', function(event) {
  const modal = document.getElementById('matrixModal');
  if (event.target === modal) {
    closeMatrixMode();
  }
});
