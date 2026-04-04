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
    renderEpisodesToday();
    renderTimeline();
    renderHeatmap();

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

  // Joueur Un
  html += `<div class="episodes-list">`;
  html += `<h4>🎮 JOUEUR UN — ${todayEps1.length} Épisode${todayEps1.length !== 1 ? 's' : ''}</h4>`;
  if (todayEps1.length > 0) {
    todayEps1.forEach(ep => {
      html += `<div class="episode-item">📌 ${ep.title}</div>`;
    });
    html += `<div class="duration-box"><div class="duration-label">Durée Moyenne</div><div class="duration-value">${avgDur1}m</div></div>`;
  } else {
    html += `<div class="episode-item" style="color: #999; font-style: italic;">Aucun épisode sorti aujourd'hui</div>`;
  }
  html += `</div>`;

  // Joueur Deux
  html += `<div class="episodes-list">`;
  html += `<h4>🎮 JOUEUR DEUX — ${todayEps2.length} Épisode${todayEps2.length !== 1 ? 's' : ''}</h4>`;
  if (todayEps2.length > 0) {
    todayEps2.forEach(ep => {
      html += `<div class="episode-item">📌 ${ep.title}</div>`;
    });
    html += `<div class="duration-box"><div class="duration-label">Durée Moyenne</div><div class="duration-value" style="color: #ffd709;">${avgDur2}m</div></div>`;
  } else {
    html += `<div class="episode-item" style="color: #999; font-style: italic;">Aucun épisode sorti aujourd'hui</div>`;
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

  // ÉTAPE 1 (0-2s)
  setTimeout(() => {
    let html = `<div class="round-title">⚔️ ÉTAPE 1</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
    }
    content.innerHTML = html;
  }, 0);

  // ÉTAPE 2 (2-4s)
  setTimeout(() => {
    let html = `<div class="round-title">⚔️ ÉTAPE 2</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
    }
    content.innerHTML = html;
  }, 2000);

  // RÉSULTAT (4-8s+)
  setTimeout(() => {
    const winnerPodcast = podcasts[winner];
    const winnerStats = winner === 1 ? stats1 : stats2;
    const loserStats = winner === 1 ? stats2 : stats1;

    let explanation = '';
    if (winnerStats.episodeCount > loserStats.episodeCount) {
      explanation += `<strong>${podcasts[winner].title}</strong> a sorti <strong>${winnerStats.episodeCount}</strong> épisode${winnerStats.episodeCount > 1 ? 's' : ''} aujourd'hui vs ${loserStats.episodeCount}. `;
    }
    if (winnerStats.totalMinutes > loserStats.totalMinutes) {
      explanation += `<strong>${winnerStats.totalMinutes}</strong> minutes de contenu vs ${loserStats.totalMinutes}. `;
    }
    if (winnerStats.avgDuration > loserStats.avgDuration) {
      explanation += `Durée moyenne: <strong>${winnerStats.avgDuration}m</strong> vs ${loserStats.avgDuration}m!`;
    }

    let html = `
      <div class="winner-section" style="animation-delay: 0.5s;">
        <div class="winner-image" style="width: 300px; height: 300px; margin: 0 auto 40px; box-shadow: 0 0 60px rgba(255, 215, 9, 0.8); border-width: 6px;">
          ${winnerPodcast.image ? `<img src="${winnerPodcast.image}" alt="${winnerPodcast.title}">` : '<div style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 120px;">📻</div>'}
        </div>
        <div style="font-size: 4.5em; font-weight: 900; margin-bottom: 20px; color: #ffd709; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 20px rgba(255, 215, 9, 0.6);">${winnerPodcast.title}</div>
        <div style="font-size: 3.5em; color: #ff89ab; margin-bottom: 40px; font-weight: 700; letter-spacing: 2px; animation: pulse 1s infinite;">WIN!!!!</div>
        <div style="font-size: 1.2em; line-height: 2; color: #ccc; text-align: left; max-width: 700px; margin: 0 auto; padding: 30px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border-left: 4px solid #ffd709;">${explanation}</div>
        <button class="close-fight" onclick="document.getElementById('fightModal').classList.remove('show');" style="margin-top: 40px;">FERMER</button>
      </div>
    `;
    content.innerHTML = html;
  }, 4000);
}
