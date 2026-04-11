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

// Check if Matrix button (Konami code) should be shown
function checkShowMatrixButton() {
  const now = Date.now();
  const elapsedTime = now - pageLoadTime;

  if (podcasts[1] && podcasts[2] && elapsedTime >= MIN_LOAD_TIME) {
    document.getElementById('matrixButton').style.display = 'inline-block';
  } else {
    // Check again after 1 second if condition not met
    setTimeout(checkShowMatrixButton, 1000);
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

    // Hide INSERT COIN button and show FIGHT button when podcasts are loaded
    document.getElementById('insertCoinBtn').style.display = 'none';
    document.getElementById('startBtn').style.display = 'inline-block';

    // Show Matrix button when both podcasts loaded AND 30 seconds elapsed
    checkShowMatrixButton();

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

// NEW: Get stats for last 7 days (rolling window)
function getLast7DaysStats(playerNum) {
  const episodes = podcasts[playerNum].episodes;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const last7Days = episodes.filter(ep => {
    const pubDate = new Date(ep.pubDate);
    return pubDate >= sevenDaysAgo && pubDate <= now;
  });

  // Calculate stats
  const totalEpisodes = last7Days.length;
  const totalDuration = last7Days.reduce((sum, ep) => sum + (ep.duration || 0), 0);
  const totalMinutes = Math.round(totalDuration / 60);
  const avgDurationPerEpisode = totalEpisodes > 0 ? Math.round(totalDuration / totalEpisodes / 60) : 0;
  const avgEpisodesPerDay = Math.round((totalEpisodes / 7) * 10) / 10;

  // Count active days (days with at least 1 episode)
  const activeDays = new Set();
  last7Days.forEach(ep => {
    const d = new Date(ep.pubDate);
    d.setHours(0, 0, 0, 0);
    activeDays.add(d.getTime());
  });
  const consistencyScore = activeDays.size; // 0-7

  // Recency: Check if active in last 3 days
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const recentEpisodes = last7Days.filter(ep => new Date(ep.pubDate) >= threeDaysAgo);
  const isRecent = recentEpisodes.length > 0;

  return {
    totalEpisodes,
    totalMinutes,
    avgEpisodesPerDay,
    avgDurationPerEpisode,
    consistencyScore,
    isRecent,
    activeDays: activeDays.size
  };
}

// NEW: Calculate score using multi-criteria approach
function calculatePlayerScore(playerNum) {
  const stats = getLast7DaysStats(playerNum);
  let score = 0;
  const breakdown = {};

  // 1. PRODUCTIVITÉ TOTALE (25 pts max)
  // Podcasts avec ~150 eps/7j = 25 pts
  const prodScore = Math.min(25, (stats.totalEpisodes / 150) * 25);
  breakdown.productivité = {
    label: 'Productivité',
    value: stats.totalEpisodes + ' épisodes',
    points: Math.round(prodScore)
  };
  score += prodScore;

  // 2. FRÉQUENCE MOYENNE (25 pts max)
  // ~21 éps/jour = 25 pts
  const freqScore = Math.min(25, (stats.avgEpisodesPerDay / 21) * 25);
  breakdown.fréquence = {
    label: 'Fréquence',
    value: stats.avgEpisodesPerDay.toFixed(1) + ' épisodes/jour',
    points: Math.round(freqScore)
  };
  score += freqScore;

  // 3. DURÉE TOTALE (20 pts max)
  // ~450 min = 25 pts
  const durationScore = Math.min(20, (stats.totalMinutes / 450) * 20);
  breakdown.durée = {
    label: 'Durée',
    value: stats.totalMinutes + ' minutes',
    points: Math.round(durationScore)
  };
  score += durationScore;

  // 4. CONSISTANCE/RÉGULARITÉ (15 pts max)
  // 7/7 jours = 15 pts
  const consistScore = (stats.consistencyScore / 7) * 15;
  breakdown.consistance = {
    label: 'Régularité',
    value: stats.consistencyScore + '/7 jours actifs',
    points: Math.round(consistScore)
  };
  score += consistScore;

  // 5. RÉCENCE (15 pts max)
  // Actif dans les 3 derniers jours = 15 pts, sinon décrémente
  let recencyScore = 15;
  if (!stats.isRecent) {
    recencyScore = 5; // Pénalité si inactif
  }
  breakdown.récence = {
    label: 'Récence',
    value: stats.isRecent ? 'Actif récemment ✓' : 'Inactif',
    points: recencyScore
  };
  score += recencyScore;

  return {
    totalScore: Math.round(score),
    breakdown: breakdown,
    stats: stats
  };
}

// NEW: Determine winner using multi-criteria scoring
function determineWinner() {
  const score1 = calculatePlayerScore(1);
  const score2 = calculatePlayerScore(2);

  console.log('Player 1 Score:', score1);
  console.log('Player 2 Score:', score2);

  // Store scores globally for display after fight
  window.lastFightScores = { 1: score1, 2: score2 };

  if (score1.totalScore > score2.totalScore) {
    return 1;
  } else if (score2.totalScore > score1.totalScore) {
    return 2;
  }

  // If tied, player 1 wins by default
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
    playSoundEffect('round'); // Round start sound
    let html = `<div class="round-title">⚔️ ROUND 1</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
      // Play hit sound for each action
      setTimeout(() => playSoundEffect('hit'), i * 400 + 100);
    }
    content.innerHTML = html;
  }, 0);

  // ROUND 2 (2-4s)
  setTimeout(() => {
    playSoundEffect('round'); // Round start sound
    let html = `<div class="round-title">⚔️ ROUND 2</div>`;
    for (let i = 0; i < 2; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      html += `<div class="fight-action" style="animation-delay: ${i * 0.4}s;">${action}</div>`;
      // Play hit sound for each action
      setTimeout(() => playSoundEffect('hit'), i * 400 + 100);
    }
    content.innerHTML = html;
  }, 2000);

  // RÉSULTAT (4-8s+)
  setTimeout(() => {
    playSoundEffect('explosion'); // Explosion sound for dramatic effect
    setTimeout(() => playSoundEffect('victory'), 300); // Victory fanfare

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
// Generate 10-day activity analysis with narrative structure
function generate10DayAnalysis(dates, dayCounts1, dayCounts2, pod1, pod2) {
  // Analyze by day of week
  const dayPatterns = {
    0: { name: 'Dim', c1: [], c2: [] },
    1: { name: 'Lun', c1: [], c2: [] },
    2: { name: 'Mar', c1: [], c2: [] },
    3: { name: 'Mer', c1: [], c2: [] },
    4: { name: 'Jeu', c1: [], c2: [] },
    5: { name: 'Ven', c1: [], c2: [] },
    6: { name: 'Sam', c1: [], c2: [] }
  };

  dates.forEach(date => {
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });
    const dayOfWeek = date.getDay();
    dayPatterns[dayOfWeek].c1.push(dayCounts1[dateStr] || 0);
    dayPatterns[dayOfWeek].c2.push(dayCounts2[dateStr] || 0);
  });

  // Calculate averages and totals for each day
  Object.keys(dayPatterns).forEach(day => {
    const pattern = dayPatterns[day];
    pattern.avg1 = pattern.c1.length > 0 ? pattern.c1.reduce((a, b) => a + b) / pattern.c1.length : 0;
    pattern.avg2 = pattern.c2.length > 0 ? pattern.c2.reduce((a, b) => a + b) / pattern.c2.length : 0;
    pattern.max1 = pattern.c1.length > 0 ? Math.max(...pattern.c1) : 0;
    pattern.max2 = pattern.c2.length > 0 ? Math.max(...pattern.c2) : 0;
  });

  // Analyze patterns by period
  const monTueAvg1 = (dayPatterns[1].avg1 + dayPatterns[2].avg1) / 2;
  const monTueAvg2 = (dayPatterns[1].avg2 + dayPatterns[2].avg2) / 2;
  const wedThuAvg1 = (dayPatterns[3].avg1 + dayPatterns[4].avg1) / 2;
  const wedThuAvg2 = (dayPatterns[3].avg2 + dayPatterns[4].avg2) / 2;
  const friAvg1 = dayPatterns[5].avg1;
  const friAvg2 = dayPatterns[5].avg2;
  const weekendAvg1 = (dayPatterns[6].avg1 + dayPatterns[0].avg1) / 2;
  const weekendAvg2 = (dayPatterns[6].avg2 + dayPatterns[0].avg2) / 2;

  // Find the actual peak day
  const allAvgs = {
    'monTue': { avg1: monTueAvg1, avg2: monTueAvg2, name: 'lundi-mardi' },
    'wedThu': { avg1: wedThuAvg1, avg2: wedThuAvg2, name: 'mercredi-jeudi' },
    'fri': { avg1: friAvg1, avg2: friAvg2, name: 'vendredi' },
    'weekend': { avg1: weekendAvg1, avg2: weekendAvg2, name: 'week-end' }
  };

  const peakDay1 = Object.entries(allAvgs).reduce((max, [key, val]) => val.avg1 > allAvgs[max].avg1 ? key : max, 'monTue');
  const peakDay2 = Object.entries(allAvgs).reduce((max, [key, val]) => val.avg2 > allAvgs[max].avg2 ? key : max, 'monTue');
  const peakDayName = allAvgs[peakDay1].name;

  // Determine postures
  const isIntensive1 = monTueAvg1 > wedThuAvg1; // High at start
  const isLinear2 = Math.abs(monTueAvg2 - wedThuAvg2) < 1; // Stable

  // Check if Friday is significant
  const isFridayPeak = friAvg1 > monTueAvg1 * 0.8 || friAvg2 > monTueAvg2 * 0.8;

  // Check weekend strength
  const weekendStrength1 = weekendAvg1 > (monTueAvg1 + wedThuAvg1) * 0.4;
  const weekendStrength2 = weekendAvg2 > (monTueAvg2 + wedThuAvg2) * 0.4;

  let analysis = `<div class="ten-day-analysis" style="margin-top: 32px; padding: 24px; background: rgba(0, 50, 100, 0.3); border: 2px solid #00ffff; border-radius: 4px; color: #00ff88; font-size: 0.95em; line-height: 1.8; text-align: left;">
    <div style="color: #ffff00; font-weight: 700; font-size: 1.05em; margin-bottom: 20px;">📊 Lecture des dynamiques de publication sur 10 jours</div>

    <div style="color: #00ff88; margin-bottom: 18px; font-style: italic;">
      La répartition des publications ne doit pas être lue comme une simple opposition "jours forts / jours faibles", mais comme une logique éditoriale structurée autour de trois temps clés dans la semaine.
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">◆ Le ${isFridayPeak ? 'vendredi est le point de convergence' : 'rythme éditorial se structure'} des deux stratégies</div>
    <div style="margin-left: 16px; margin-bottom: 18px; color: #00ff88;">
      ${isFridayPeak ? `Le vendredi concentre le volume maximal : ${Math.round(friAvg1)} épisodes pour <span style="color: #ff00ff; font-weight: 700;">${pod1}</span>, ${Math.round(friAvg2)} pour <span style="color: #ffd709; font-weight: 700;">${pod2}</span>. Cela traduit une volonté de capter une audience plus disponible à l'approche du week-end.` : `${allAvgs[peakDay1].name} concentre l'activité maximale pour <span style="color: #ff00ff; font-weight: 700;">${pod1}</span>, tandis que <span style="color: #ffd709; font-weight: 700;">${pod2}</span> atteint son pic ${allAvgs[peakDay2].name}.`}
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">◆ En amont, le début de semaine (lundi–mardi) joue un rôle d'installation</div>
    <div style="margin-left: 16px; margin-bottom: 18px; color: #00ff88;">
      ${isIntensive1 ? `<span style="color: #ff00ff; font-weight: 700;">${pod1}</span> y déploie des volumes élevés (${Math.round(monTueAvg1)} en moyenne), proches de ses pics, ce qui montre une stratégie offensive et continue.` : `<span style="color: #ff00ff; font-weight: 700;">${pod1}</span> établit un rythme de ${Math.round(monTueAvg1)} épisodes en moyenne.`}
      <br>${isLinear2 ? `<span style="color: #ffd709; font-weight: 700;">${pod2}</span> adopte une approche linéaire, avec un volume stable autour de ${Math.round(monTueAvg2)} épisodes, sans montée en puissance marquée.` : `<span style="color: #ffd709; font-weight: 700;">${pod2}</span> y monte progressivement à ${Math.round(monTueAvg2)} épisodes.`}
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">◆ Le milieu de semaine (mercredi–jeudi) correspond à un temps de respiration</div>
    <div style="margin-left: 16px; margin-bottom: 18px; color: #00ff88;">
      ${wedThuAvg1 < monTueAvg1 || wedThuAvg2 < monTueAvg2 ? 'Une baisse observable sur les deux podcasts traduit un ajustement du rythme,' : 'Un équilibre se maintient,'} avant ${isFridayPeak ? 'la montée en charge du vendredi.' : 'l\'ajustement final de la semaine.'}
      <span style="color: #ff00ff; font-weight: 700;">${pod1}</span> passe à ${Math.round(wedThuAvg1)} épisodes et <span style="color: #ffd709; font-weight: 700;">${pod2}</span> à ${Math.round(wedThuAvg2)}.
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">◆ Enfin, le week-end ${weekendStrength1 || weekendStrength2 ? 'prolonge la stratégie' : 'apaise le rythme'}</div>
    <div style="margin-left: 16px; margin-bottom: 18px; color: #00ff88;">
      ${weekendStrength1 || weekendStrength2 ? 'Le week-end ne constitue pas un creux, mais un prolongement maîtrisé, avec des volumes modérés mais réguliers (${Math.round(weekendAvg1)} et ${Math.round(weekendAvg2)} épisodes), permettant de maintenir la présence sans saturer l\'audience.' : 'Le week-end connaît une activité modérée (${Math.round(weekendAvg1)} et ${Math.round(weekendAvg2)} épisodes), consolidant la présence des deux podcasts.'}
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px; margin-top: 20px;">Ce que cela révèle :</div>
    <div style="margin-left: 16px; color: #00ff88;">
      • Une logique de pic ${isFridayPeak ? 'assumée le vendredi' : 'structurée autour de ' + allAvgs[peakDay1].name}, commune aux deux acteurs<br>
      • Une différence de posture en début de semaine : ${isIntensive1 ? 'intensité' : 'progression'} pour <span style="color: #ff00ff; font-weight: 700;">${pod1}</span> vs régularité pour <span style="color: #ffd709; font-weight: 700;">${pod2}</span><br>
      • Une gestion du rythme hebdomadaire pensée comme un cycle, et non comme une simple accumulation
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-top: 20px; margin-bottom: 10px; border-top: 1px solid #00ffff; padding-top: 16px;">En synthèse :</div>
    <div style="margin-left: 16px; color: #00ff88; font-style: italic;">
      ${isFridayPeak ? 'Le vendredi n\'est pas seulement le jour le plus actif, c\'est le point d\'orgue d\'une stratégie hebdomadaire structurée, appuyée par une montée en puissance progressive et un maintien de présence sur le week-end.' : 'Les deux podcasts organisent leur publication autour d\'une architecture hebdomadaire claire, révélant des stratégies distinctes mais complémentaires pour capter leur audience.'}
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
  // Only show analysis if a fight has been run (scores exist)
  if (!window.lastFightScores) return '';
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

  // Calculate key metrics for analysis
  const highVolumePod = freq1 >= freq2 ? { name: pod1, freq: freq1, dur: avgDur1_7d, total: totalHours1_7d }
                                        : { name: pod2, freq: freq2, dur: avgDur2_7d, total: totalHours2_7d };
  const lowVolumePod = freq1 < freq2 ? { name: pod1, freq: freq1, dur: avgDur1_7d, total: totalHours1_7d }
                                      : { name: pod2, freq: freq2, dur: avgDur2_7d, total: totalHours2_7d };

  const longFormatPod = avgDur1_7d > avgDur2_7d ? pod1 : pod2;
  const shortFormatPod = avgDur1_7d <= avgDur2_7d ? pod1 : pod2;
  const durationRatio = Math.round((Math.max(avgDur1_7d, avgDur2_7d) / Math.min(avgDur1_7d, avgDur2_7d)) * 100) / 100;

  const isHighVolumeIntensive = highVolumePod.freq >= 3;
  const isLowVolumeDeep = lowVolumePod.dur >= 25;
  const isBalancedEcosystem = Math.abs(highVolumePod.total - lowVolumePod.total) < 5;

  // Get score breakdown if available
  let scoreBreakdown = '';
  if (window.lastFightScores) {
    const scores = window.lastFightScores;
    const score1 = scores[1];
    const score2 = scores[2];

    scoreBreakdown = `
    <div style="background: rgba(0, 255, 255, 0.1); border: 2px solid #00ffff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="color: #00ffff; font-weight: 700; margin-bottom: 12px; font-size: 1.1em;">⚔️ SCORE DE COMBAT (7 DERNIERS JOURS)</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
        <div style="background: rgba(255, 0, 255, 0.2); padding: 12px; border-left: 4px solid #ff00ff;">
          <div style="color: #ff00ff; font-weight: 700; margin-bottom: 8px;">${podcasts[1].title}</div>
          <div style="font-size: 1.8em; color: #ffff00; font-weight: 900;">${score1.totalScore}</div>
          <div style="font-size: 0.9em; color: #00ff88;">/ 100 points</div>
        </div>

        <div style="background: rgba(255, 215, 9, 0.2); padding: 12px; border-left: 4px solid #ffd709;">
          <div style="color: #ffd709; font-weight: 700; margin-bottom: 8px;">${podcasts[2].title}</div>
          <div style="font-size: 1.8em; color: #ffff00; font-weight: 900;">${score2.totalScore}</div>
          <div style="font-size: 0.9em; color: #00ff88;">/ 100 points</div>
        </div>
      </div>

      <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px; font-size: 0.95em;">Détail par Critère:</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9em;">
        ${Object.entries(score1.breakdown).map(([key, data]) => `
          <div style="background: rgba(255, 0, 255, 0.1); padding: 8px; border-radius: 4px;">
            <div style="color: #ff00ff; font-weight: 700;">${data.label}: ${data.points} pts</div>
            <div style="color: #00ff88; font-size: 0.85em;">${data.value}</div>
          </div>
        `).join('')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9em; margin-top: 10px;">
        ${Object.entries(score2.breakdown).map(([key, data]) => `
          <div style="background: rgba(255, 215, 9, 0.1); padding: 8px; border-radius: 4px;">
            <div style="color: #ffd709; font-weight: 700;">${data.label}: ${data.points} pts</div>
            <div style="color: #00ff88; font-size: 0.85em;">${data.value}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  let analysis = `<div class="comparative-analysis" style="color: #00ff88; line-height: 1.8; text-align: left;">
    ${scoreBreakdown}
    <div style="color: #ffff00; font-weight: 700; font-size: 1.05em; margin-bottom: 18px;">Analyse Comparative des Dynamiques Éditoriales</div>

    <div style="margin-bottom: 18px;">
      Sur la période observée, <span style="color: #ff00ff; font-weight: 700;">${highVolumePod.name}</span> s'inscrit dans une logique de présence continue, avec une moyenne de <strong>${highVolumePod.freq} épisodes</strong> publiés par jour, contre <strong>${lowVolumePod.freq} épisodes</strong> pour <span style="color: #ffd709; font-weight: 700;">${lowVolumePod.name}</span>. Cet écart ne traduit pas seulement une différence de volume, mais deux approches distinctes : là où <span style="color: #ff00ff; font-weight: 700;">${highVolumePod.name}</span> cherche à occuper l'espace de manière régulière, <span style="color: #ffd709; font-weight: 700;">${lowVolumePod.name}</span> opte pour une prise de parole ${isLowVolumeDeep ? 'plus sélective et approfondie' : 'plus ciblée'}.
    </div>

    <div style="margin-bottom: 18px;">
      Cette différence est directement compensée par le format des contenus. <span style="color: #ff00ff; font-weight: 700;">${longFormatPod}</span> propose des épisodes sensiblement plus longs, avec une durée moyenne de <strong>${Math.max(avgDur1_7d, avgDur2_7d)} minutes</strong>, contre <strong>${Math.min(avgDur1_7d, avgDur2_7d)} minutes</strong> pour <span style="color: #ffd709; font-weight: 700;">${shortFormatPod}</span>. On n'est donc pas sur une moindre production, mais sur une densité éditoriale ${isLowVolumeDeep ? 'plus forte par épisode, qui privilégie l\'approfondissement plutôt que la répétition' : 'différenciée selon les stratégies'}.
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">Sur les 7 derniers jours, cette opposition se confirme dans le rythme de diffusion.</div>
    <div style="margin-bottom: 18px;">
      <span style="color: #ff00ff; font-weight: 700;">${highVolumePod.name}</span> ${isHighVolumeIntensive ? 'maintient une cadence élevée et homogène, assurant une forte visibilité dans les flux' : 'conserve un rythme stable et structuré'}. À l'inverse, <span style="color: #ffd709; font-weight: 700;">${lowVolumePod.name}</span> ${isLowVolumeDeep ? 'conserve un rythme plus espacé, mais qui reste cohérent avec la longueur de ses formats et son positionnement plus éditorialisé' : 'propose une cadence mesurée'}. ${isBalancedEcosystem ? 'En volume d\'écoute potentiel, l\'écart entre les deux tend ainsi à se réduire.' : 'Les deux approches créent des expériences d\'écoute distinctes.'}
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px;">Lecture globale :</div>
    <div style="margin-bottom: 18px;">
      On observe moins une opposition qu'un équilibre entre deux stratégies complémentaires :<br>
      <br>
      • <span style="color: #ff00ff; font-weight: 700;">${highVolumePod.name}</span> maximise la fréquence pour capter l'attention de manière répétée<br>
      • <span style="color: #ffd709; font-weight: 700;">${lowVolumePod.name}</span> mise sur la profondeur pour installer une écoute plus engagée
    </div>

    <div style="color: #ffaa00; font-weight: 700; margin-bottom: 10px; border-top: 1px solid #00ffff; padding-top: 12px;">En synthèse :</div>
    <div style="margin-left: 16px;">
      <div style="color: #ff00ff; font-weight: 700; margin-bottom: 8px;">${highVolumePod.name}</div>
      <div style="color: #00ff88; font-size: 0.95em; margin-bottom: 12px;">intensité, régularité, présence forte dans les flux</div>

      <div style="color: #ffd709; font-weight: 700; margin-bottom: 8px;">${lowVolumePod.name}</div>
      <div style="color: #00ff88; font-size: 0.95em;">sélectivité, formats ${isLowVolumeDeep ? 'longs' : 'structurés'}, valeur éditoriale renforcée</div>
    </div>
  </div>`;

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

// Check if both URLs are filled and show message
function checkUrlsReady() {
  const url1 = document.getElementById('rss-1').value.trim();
  const url2 = document.getElementById('rss-2').value.trim();
  const msg = document.getElementById('urls-ready-msg');

  if (url1 && url2) {
    msg.style.display = 'block';
  } else {
    msg.style.display = 'none';
  }
}

// Add event listeners to RSS inputs
document.addEventListener('DOMContentLoaded', function() {
  const rss1 = document.getElementById('rss-1');
  const rss2 = document.getElementById('rss-2');

  if (rss1) rss1.addEventListener('input', checkUrlsReady);
  if (rss2) rss2.addEventListener('input', checkUrlsReady);
});

// Generate Intelligent Recommendations
function generateRecommendations() {
  if (!podcasts[1] || !podcasts[2]) return '';

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

  const freq1 = (eps1_7d.length / 7);
  const freq2 = (eps2_7d.length / 7);
  const avgDur1 = eps1_7d.length > 0 ? Math.round(eps1_7d.reduce((s, e) => s + e.duration, 0) / eps1_7d.length / 60) : 0;
  const avgDur2 = eps2_7d.length > 0 ? Math.round(eps2_7d.reduce((s, e) => s + e.duration, 0) / eps2_7d.length / 60) : 0;

  const recommendations = [];

  // Recommendation 1: Frequency optimization
  if (freq1 > 3.5) {
    recommendations.push({
      podcast: podcasts[1].title,
      issue: `Fréquence très élevée (${freq1.toFixed(1)} eps/jour)`,
      action: `Réduire à 3 eps/jour (- ${Math.round((freq1 - 3) * 10) / 10} eps) pour améliorer qualité perçue`,
      impact: '↑ 20-30% engagement estimé'
    });
  } else if (freq1 < 1) {
    recommendations.push({
      podcast: podcasts[1].title,
      issue: `Fréquence basse (${freq1.toFixed(1)} eps/jour)`,
      action: `Augmenter à 1.5 eps/jour pour plus de visibilité`,
      impact: '↑ 40% audience potentielle'
    });
  }

  if (freq2 > 3.5) {
    recommendations.push({
      podcast: podcasts[2].title,
      issue: `Fréquence très élevée (${freq2.toFixed(1)} eps/jour)`,
      action: `Réduire à 3 eps/jour (- ${Math.round((freq2 - 3) * 10) / 10} eps) pour améliorer qualité perçue`,
      impact: '↑ 20-30% engagement estimé'
    });
  } else if (freq2 < 1) {
    recommendations.push({
      podcast: podcasts[2].title,
      issue: `Fréquence basse (${freq2.toFixed(1)} eps/jour)`,
      action: `Augmenter à 1.5 eps/jour pour plus de visibilité`,
      impact: '↑ 40% audience potentielle'
    });
  }

  // Recommendation 2: Duration optimization
  if (avgDur1 < 10) {
    recommendations.push({
      podcast: podcasts[1].title,
      issue: `Format très court (${avgDur1}min)`,
      action: `Viser 15-20min pour plus de substance et rétention`,
      impact: '↑ Durée d\'écoute totale +35%'
    });
  } else if (avgDur1 > 45) {
    recommendations.push({
      podcast: podcasts[1].title,
      issue: `Format très long (${avgDur1}min)`,
      action: `Explorer formats 25-35min pour meilleur accès`,
      impact: '↑ 25% complétude d\'écoute'
    });
  }

  if (avgDur2 < 10) {
    recommendations.push({
      podcast: podcasts[2].title,
      issue: `Format très court (${avgDur2}min)`,
      action: `Viser 15-20min pour plus de substance et rétention`,
      impact: '↑ Durée d\'écoute totale +35%'
    });
  } else if (avgDur2 > 45) {
    recommendations.push({
      podcast: podcasts[2].title,
      issue: `Format très long (${avgDur2}min)`,
      action: `Explorer formats 25-35min pour meilleur accès`,
      impact: '↑ 25% complétude d\'écoute'
    });
  }

  // Recommendation 3: Balance optimization
  const freqDiff = Math.abs(freq1 - freq2);
  if (freqDiff > 2) {
    const higherFreq = freq1 > freq2 ? podcasts[1].title : podcasts[2].title;
    const lowerFreq = freq1 < freq2 ? podcasts[1].title : podcasts[2].title;
    recommendations.push({
      podcast: 'STRATÉGIE GLOBALE',
      issue: `Déséquilibre fréquence (${freqDiff.toFixed(1)} eps/jour d'écart)`,
      action: `Aligner ${higherFreq} et ${lowerFreq} vers 2.5 eps/jour moyen`,
      impact: '→ Écosystème plus cohérent et prévisible'
    });
  }

  // Recommendation 4: Listening time balance
  const totalDur1 = eps1_7d.reduce((s, e) => s + e.duration, 0) / 3600;
  const totalDur2 = eps2_7d.reduce((s, e) => s + e.duration, 0) / 3600;
  const durDiff = Math.abs(totalDur1 - totalDur2);

  if (durDiff > 5) {
    recommendations.push({
      podcast: 'AUDIENCE POTENTIELLE',
      issue: `Durée d'écoute cumulée déséquilibrée (${durDiff.toFixed(1)}h d'écart)`,
      action: `Rééquilibrer pour ~${((totalDur1 + totalDur2) / 14).toFixed(1)}h par podcast/semaine`,
      impact: '→ Audience équivalente, stratégies complémentaires'
    });
  }

  return recommendations;
}

// Export Analysis to Image
function exportAnalysisImage() {
  const analysisSection = document.getElementById('analysis-summary-section');
  const analysisText = document.getElementById('analysis-text');

  if (!analysisText || !podcasts[1] || !podcasts[2]) {
    alert('⚠️ Charge d\'abord les podcasts et génère l\'analyse!');
    return;
  }

  // Create export container
  const exportDiv = document.createElement('div');
  exportDiv.style.position = 'fixed';
  exportDiv.style.top = '-9999px';
  exportDiv.style.left = '-9999px';
  exportDiv.style.background = '#0a0e27';
  exportDiv.style.padding = '40px';
  exportDiv.style.width = '1200px';
  exportDiv.style.color = '#00ff88';
  exportDiv.style.fontFamily = 'Orbitron, sans-serif';
  exportDiv.style.border = '3px solid #ff00ff';
  exportDiv.style.borderRadius = '8px';
  exportDiv.style.boxShadow = '0 0 40px #ff00ff';

  const timestamp = new Date().toLocaleDateString('fr-FR');
  exportDiv.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="font-size: 28px; font-weight: 900; color: #ffff00; text-shadow: 0 0 10px #ffff00; margin-bottom: 10px;">🎯 PODCAST FIGHTER II TURBO</div>
      <div style="font-size: 16px; color: #00ffff; text-shadow: 0 0 8px #00ffff;">Analyse Comparative - ${timestamp}</div>
      <div style="font-size: 14px; color: #ff00ff; margin-top: 8px;">${podcasts[1].title} ⚡ ${podcasts[2].title}</div>
    </div>
    <div style="border-top: 2px solid #00ffff; padding-top: 20px;">
      ${analysisText.innerHTML}
    </div>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ff00ff; text-align: center; font-size: 12px; color: #00aa88;">
      Generated with Podcast Fighter II Turbo
    </div>
  `;

  document.body.appendChild(exportDiv);

  // Use html2canvas if available, otherwise use simpler method
  if (typeof html2canvas !== 'undefined') {
    html2canvas(exportDiv, { backgroundColor: '#0a0e27' }).then(canvas => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `podcast-analysis-${timestamp.replace(/\//g, '-')}.png`;
      link.click();
      document.body.removeChild(exportDiv);
    });
  } else {
    // Fallback: copy to clipboard
    alert('💾 Analyse copiée! Tu peux la capturer avec ton outil d\'screenshot préféré.');
    document.body.removeChild(exportDiv);
  }
}

// Share Analysis (generates shareable link/data)
function shareAnalysis() {
  if (!podcasts[1] || !podcasts[2]) {
    alert('⚠️ Charge d\'abord les podcasts!');
    return;
  }

  // Create shareable data
  const shareData = {
    pod1: podcasts[1].title,
    pod2: podcasts[2].title,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };

  const shareText = `Analyse comparative: ${podcasts[1].title} vs ${podcasts[2].title}\n${window.location.href}`;

  // Try native share API
  if (navigator.share) {
    navigator.share({
      title: 'Podcast Fighter II - Analyse Comparative',
      text: shareText
    });
  } else {
    // Fallback: copy link to clipboard
    const text = `Analyse: ${podcasts[1].title} vs ${podcasts[2].title}\n${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Lien copié dans le presse-papiers!');
    });
  }
}

// Show Recommendations Modal
function showRecommendations() {
  const recommendations = generateRecommendations();

  if (recommendations.length === 0) {
    alert('✅ Aucune recommandation - vos stratégies sont optimales!');
    return;
  }

  const modal = document.getElementById('recommendationsModal');
  const content = document.getElementById('recommendations-content');

  let html = '';
  recommendations.forEach((rec, idx) => {
    html += `
      <div style="background: rgba(0, 150, 100, 0.2); border: 2px solid #00dd77; border-radius: 4px; padding: 20px;">
        <div style="color: #ffff00; font-weight: 700; margin-bottom: 10px; font-size: 1.1em;">
          ${idx + 1}. ${rec.podcast}
        </div>
        <div style="color: #ff8800; margin-bottom: 10px; font-weight: 600;">
          ⚠️ PROBLÈME: ${rec.issue}
        </div>
        <div style="color: #00ff88; margin-bottom: 12px; font-size: 0.95em;">
          ➜ ACTION: ${rec.action}
        </div>
        <div style="color: #ffff00; font-weight: 700; padding-top: 12px; border-top: 1px solid #00dd77;">
          📈 IMPACT: ${rec.impact}
        </div>
      </div>
    `;
  });

  content.innerHTML = html;
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'flex-start';
}

// Close Recommendations Modal
function closeRecommendations() {
  const modal = document.getElementById('recommendationsModal');
  modal.style.display = 'none';
}

// FIGHT SOUND EFFECTS - Street Fighter II Style! 🎮
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSoundEffect(type = 'hit') {
  try {
    const now = audioContext.currentTime;

    if (type === 'hit') {
      // Punch/Kick sound - deep bass impact
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.1);

      // Add higher frequency for "punch" texture
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.frequency.setValueAtTime(300, now);
      osc2.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0, now + 0.08);

      osc2.start(now);
      osc2.stop(now + 0.08);
    }

    if (type === 'explosion') {
      // Explosion sound - random noise burst
      const bufferSize = audioContext.sampleRate * 0.5;
      const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const source = audioContext.createBufferSource();
      source.buffer = noiseBuffer;

      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 0.5);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0, now + 0.5);

      source.start(now);
      source.stop(now + 0.5);

      // Add bass rumble
      const bass = audioContext.createOscillator();
      const bassGain = audioContext.createGain();
      bass.connect(bassGain);
      bassGain.connect(audioContext.destination);

      bass.frequency.setValueAtTime(80, now);
      bass.frequency.exponentialRampToValueAtTime(20, now + 0.4);
      bassGain.gain.setValueAtTime(0.3, now);
      bassGain.gain.exponentialRampToValueAtTime(0, now + 0.4);

      bass.start(now);
      bass.stop(now + 0.4);
    }

    if (type === 'victory') {
      // Victory fanfare - ascending tones
      const notes = [262, 330, 392, 523]; // C, E, G, C (major chord)
      notes.forEach((freq, idx) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        const startTime = now + (idx * 0.15);
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0, startTime + 0.3);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    }

    if (type === 'round') {
      // Round start sound - dramatic cymbal crash simulation
      const bufferSize = audioContext.sampleRate * 0.3;
      const crashBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = crashBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
      }

      const source = audioContext.createBufferSource();
      source.buffer = crashBuffer;

      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5000, now);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0, now + 0.3);

      source.start(now);
      source.stop(now + 0.3);
    }

    if (type === 'tick') {
      // Quick tick sound for animations
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    console.log('Sound effect skipped:', e.message);
  }
}

// SELECT YOUR PLAYER - Street Fighter II Style Character Select
function getLastUniquePodcasts() {
  const battles = getBattleHistory();
  console.log('Battles found:', battles.length, battles);

  const podcastMap = new Map();

  // Iterate through battles to get most recent unique podcasts
  for (let i = 0; i < battles.length; i++) {
    const battle = battles[i];

    // Add podcast 1 if not already present
    if (battle.url1 && battle.title1 && !podcastMap.has(battle.url1)) {
      console.log('Adding podcast 1:', battle.title1);
      podcastMap.set(battle.url1, {
        title: battle.title1,
        image: battle.image1 || '',
        url: battle.url1
      });
    }

    // Add podcast 2 if not already present
    if (battle.url2 && battle.title2 && !podcastMap.has(battle.url2)) {
      console.log('Adding podcast 2:', battle.title2);
      podcastMap.set(battle.url2, {
        title: battle.title2,
        image: battle.image2 || '',
        url: battle.url2
      });
    }

    // Stop when we have 8 (for SF2 style 4x2 grid)
    if (podcastMap.size >= 8) break;
  }

  // Return as array
  const result = Array.from(podcastMap.values());
  console.log('Unique podcasts:', result.length, result);
  return result.slice(0, 8);
}

// Handle podcast selection (click on thumbnail)
function selectPodcast(url, title) {
  // Make sure inputs exist
  const rss1 = document.getElementById('rss-1');
  const rss2 = document.getElementById('rss-2');

  if (!rss1 || !rss2) return;

  // Decode URL if it's HTML encoded
  const decodedUrl = decodeURIComponent(url);

  // If PODCAST 1 is empty, fill it
  if (!rss1.value.trim()) {
    rss1.value = decodedUrl;
    rss1.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Otherwise fill PODCAST 2
  else if (!rss2.value.trim()) {
    rss2.value = decodedUrl;
    rss2.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // If both filled, ask which one to replace or replace first one
  else {
    if (confirm(`Remplacer ${rss1.value.substring(0, 30)}... par ce podcast ?`)) {
      rss1.value = decodedUrl;
    } else {
      rss2.value = decodedUrl;
    }
    rss1.dispatchEvent(new Event('input', { bubbles: true }));
    rss2.dispatchEvent(new Event('input', { bubbles: true }));
  }

  checkUrlsReady();
}

// Render player thumbnails - Street Fighter II style
function renderPlayerThumbnails() {
  const container = document.getElementById('playerThumbnails');
  const section = document.getElementById('selectPlayerSection');

  console.log('Rendering thumbnails...', container, section);

  if (!container || !section) {
    console.log('Container or section not found!');
    return;
  }

  const podcasts = getLastUniquePodcasts();
  console.log('Got podcasts:', podcasts);

  if (podcasts.length === 0) {
    console.log('No podcasts, hiding section');
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  console.log('Showing section with', podcasts.length, 'podcasts');

  // Generate 8 slots, fill with podcasts or empty slots
  let html = '';
  for (let i = 0; i < 8; i++) {
    if (i < podcasts.length) {
      const pod = podcasts[i];
      const safeUrl = (pod.url || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeTitle = (pod.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const imageUrl = pod.image || '';

      console.log(`Slot ${i}: ${pod.title} - Image: ${imageUrl ? 'yes' : 'no'}`);

      // Build image tag with proper escaping
      const imgTag = imageUrl ? `<img src="${imageUrl}" alt="${safeTitle}" style="width: 100%; height: 100%; object-fit: cover;">` : '';
      const fallbackIcon = !imageUrl ? '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; background: #1a1a1a;">📻</div>' : '';

      html += `
        <div class="player-thumbnail" onclick="selectPodcast('${safeUrl}', '${safeTitle}')">
          ${imgTag}
          ${fallbackIcon}
          <div class="player-thumbnail-name">${safeTitle.substring(0, 20)}</div>
        </div>
      `;
    } else {
      // Empty slot
      html += `
        <div class="player-thumbnail" style="opacity: 0.3; cursor: default; pointer-events: none;">
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; background: #1a1a1a;">?</div>
        </div>
      `;
    }
  }

  container.innerHTML = html;
  console.log('Thumbnails rendered');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  const rss1 = document.getElementById('rss-1');
  const rss2 = document.getElementById('rss-2');

  if (rss1) rss1.addEventListener('input', checkUrlsReady);
  if (rss2) rss2.addEventListener('input', checkUrlsReady);

  // Load clean mode preference from localStorage
  if (localStorage.getItem('cleanMode') === 'true') {
    toggleCleanMode();
  }

  // Render player thumbnails
  renderPlayerThumbnails();

  // Re-render thumbnails after each battle
  const originalStartFight = window.startFight;
  window.startFight = function() {
    setTimeout(() => {
      renderPlayerThumbnails();
    }, 6000); // After fight completes
    return originalStartFight.apply(this, arguments);
  };
});
