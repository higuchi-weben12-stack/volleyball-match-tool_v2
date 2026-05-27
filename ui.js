let appTeams = [];
let appMatches = [];
let lastCalculatedRankings = [];

const COURT_COLORS = [
    { name: 'A', bg: '#eef1ff', border: '#4ea8de', text: '#2b2d42' },
    { name: 'B', bg: '#fff2e6', border: '#ff9f1c', text: '#2b2d42' },
    { name: 'C', bg: '#ebfbee', border: '#2ec4b6', text: '#2b2d42' },
    { name: 'D', bg: '#faeefb', border: '#b5179e', text: '#2b2d42' },
    { name: 'E', bg: '#fff0f5', border: '#ff477e', text: '#2b2d42' }, // 1面時はピンク
    { name: 'F', bg: '#ffffea', border: '#ffd166', text: '#2b2d42' }
];

const courtCountInput = document.getElementById('court-count');
const teamNameInput = document.getElementById('team-name-input');
const teamListContainer = document.getElementById('team-list-container');
const scheduleSection = document.getElementById('schedule-section');
const courtFilterSelect = document.getElementById('court-filter');
const timetableContainer = document.getElementById('timetable-container');
const rankingContainer = document.getElementById('ranking-container');

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-team-btn').addEventListener('click', handleAddTeam);
    teamNameInput.addEventListener('keypress', e => e.key === 'Enter' && handleAddTeam());
    document.getElementById('generate-schedule-btn').addEventListener('click', handleGenerateSchedule);
    courtFilterSelect.addEventListener('change', renderTimetable);
    document.getElementById('calc-ranking-btn').addEventListener('click', handleCalcRanking);

    timetableContainer.addEventListener('click', handleTimetableClicks);
    timetableContainer.addEventListener('input', handleScoreInputs);
    teamListContainer.addEventListener('change', handleTeamCourtChange);
    courtCountInput.addEventListener('change', renderTeamList);
});

function getCourtColor(courtName) {
    const courtCount = parseInt(courtCountInput.value) || 1;
    if (courtCount === 1) {
        return COURT_COLORS.find(c => c.name === 'E');
    }
    return COURT_COLORS.find(c => c.name === courtName) || COURT_COLORS[0];
}

function handleAddTeam() {
    const name = teamNameInput.value.trim();
    if (!name) return;

    const courtCount = parseInt(courtCountInput.value) || 1;
    const courtLetter = String.fromCharCode(65 + (appTeams.length % courtCount));

    appTeams.push({
        id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: name,
        court: courtCount === 1 ? 'A' : courtLetter
    });
    teamNameInput.value = '';
    renderTeamList();
}

function handleTeamCourtChange(e) {
    if (e.target.classList.contains('team-court-select')) {
        const teamId = e.target.getAttribute('data-team-id');
        const team = appTeams.find(t => t.id === teamId);
        if (team) {
            team.court = e.target.value;
            renderTeamList();
        }
    }
}

function renderTeamList() {
    const courtCount = parseInt(courtCountInput.value) || 1;

    teamListContainer.innerHTML = appTeams.map((team) => {
        const color = getCourtColor(team.court);

        const optionsHtml = Array.from({ length: courtCount }, (_, i) => {
            const letter = String.fromCharCode(65 + i);
            const selected = team.court === letter ? 'selected' : '';
            return `<option value="${letter}" ${selected}>${letter}コート</option>`;
        }).join('');

        return `
            <div class="team-item" style="background-color: ${color.bg}; border-color: ${color.border}">
                <div class="team-item-header">
                    <span class="team-item-name" style="color: ${color.text}">${team.name}</span>
                    <button type="button" class="delete-team-btn" onclick="appTeams=appTeams.filter(t=>t.id!='${team.id}'); renderTeamList();">×</button>
                </div>
                <div class="team-item-body" style="margin-top: 8px; ${courtCount === 1 ? 'display:none;' : ''}">
                    <select class="team-court-select" data-team-id="${team.id}" style="padding:4px 8px; border-radius:4px; border:1px solid ${color.border}; font-family:inherit;">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
        `;
    }).join('');
}

function handleGenerateSchedule() {
    if (appTeams.length < 2) return alert('2チーム以上登録してください！');
    const courtCount = parseInt(courtCountInput.value) || 1;

    if (courtCount === 1) {
        appTeams.forEach(t => t.court = 'A');
    }

    appMatches = generateLeagueSchedule(appTeams, courtCount);

    courtFilterSelect.innerHTML = '<option value="all">すべて表示</option>' +
        Array.from({ length: courtCount }, (_, i) => `<option value="${String.fromCharCode(65 + i)}">${String.fromCharCode(65 + i)}コート</option>`).join('');

    if (courtCount === 1) {
        courtFilterSelect.parentElement.style.display = 'none';
    } else {
        courtFilterSelect.parentElement.style.display = 'flex';
    }

    scheduleSection.classList.remove('hidden');
    document.getElementById('ranking-action-area').classList.remove('hidden');
    renderTimetable();
    rankingContainer.innerHTML = '';
    scheduleSection.scrollIntoView({ behavior: 'smooth' });
}

function renderTimetable() {
    const courtCount = parseInt(courtCountInput.value) || 1;
    const openedAreas = Array.from(document.querySelectorAll('.score-input-area:not(.hidden)')).map(el => el.id);

    timetableContainer.innerHTML = '';
    const filter = courtFilterSelect.value;

    const rounds = {};
    appMatches.forEach(m => {
        if (filter === 'all' || m.court === filter) {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        }
    });

    Object.keys(rounds).forEach(r => {
        const matches = rounds[r];
        const gridClass = courtCount >= 3 ? 'court-grid triple-court' : 'court-grid';
        const isFinal = matches.some(m => m.isFinalStage);

        const html = `
            <div class="match-round-block">
                <div class="round-title">${isFinal ? `🔥 順位決定戦` : `第 ${r} 試合`}</div>
                <div class="${gridClass}">
                    ${matches.map(m => {
            const color = getCourtColor(m.court);
            const crownA = m.isFinished && m.winnerId === m.teamA.id ? 'has-crown' : '';
            const crownB = m.isFinished && m.winnerId === m.teamB.id ? 'has-crown' : '';

            const areaId = `score-area-${m.id}`;
            const isHidden = openedAreas.includes(areaId) ? '' : 'hidden';
            const toggleText = openedAreas.includes(areaId) ? '▲ 入力欄を閉じる' : '▼ 得点入力';
            const badgeHtml = courtCount === 1 ? '' : `<div class="court-badge" style="background-color:${color.border}">${m.isFinalStage ? m.stageName : m.court + 'コート'}</div>`;

            return `
                            <div class="match-card" style="border-color: ${color.border}">
                                ${badgeHtml}
                                <div class="match-content">
                                    <div class="vs-row">
                                        <div class="team-name-wrapper team-A-wrap ${crownA}">
                                            <span class="crown-icon">👑</span><span class="team-name-display">${m.teamA.name}</span>
                                        </div>
                                        <span class="vs-text">vs</span>
                                        <div class="team-name-wrapper team-B-wrap ${crownB}">
                                            <span class="crown-icon">👑</span><span class="team-name-display">${m.teamB.name}</span>
                                        </div>
                                    </div>
                                    <div class="referee-text">${m.referee ? `（審判：${m.referee.name}）` : '（審判：なし）'}</div>
                                    <button class="score-toggle-btn" data-toggle-id="${m.id}">${toggleText}</button>
                                    <div class="score-input-area ${isHidden}" id="${areaId}">
                                        <div class="sets-list-container">
                                            ${m.sets.map((s, idx) => {
                let actionBtn = '';
                if (idx === 1 && m.sets.length < 3) {
                    actionBtn = `<button type="button" class="add-set-btn-round" data-add-set="${m.id}">＋</button>`;
                } else if (idx === 2) {
                    actionBtn = `<button type="button" class="add-set-btn-round" data-remove-set="${m.id}" style="background-color:var(--main-pink);">ー</button>`;
                }

                return `
                                                    <div class="set-row" style="position:relative;">
                                                        <span class="set-label">第${idx + 1}セット</span>
                                                        <div class="score-input-wrapper">
                                                            <input type="number" class="score-input" min="0" max="99" data-match-id="${m.id}" data-set-idx="${idx}" data-team="A" value="${s.scoreA}">
                                                            <span>-</span>
                                                            <input type="number" class="score-input" min="0" max="99" data-match-id="${m.id}" data-set-idx="${idx}" data-team="B" value="${s.scoreB}">
                                                        </div>
                                                        ${actionBtn}
                                                    </div>
                                                `;
            }).join('')}
                                        </div>
                                        <div class="set-count-summary">${m.setCountA} - ${m.setCountB}</div>
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
        timetableContainer.insertAdjacentHTML('beforeend', html);
    });
}

function handleTimetableClicks(e) {
    const toggleId = e.target.getAttribute('data-toggle-id');
    const addSetId = e.target.getAttribute('data-add-set');
    const removeSetId = e.target.getAttribute('data-remove-set');

    if (toggleId) {
        const area = document.getElementById(`score-area-${toggleId}`);
        area.classList.toggle('hidden');
        e.target.textContent = area.classList.contains('hidden') ? '▼ 得点入力' : '▲ 入力欄を閉じる';
    }

    if (addSetId) {
        const match = appMatches.find(m => m.id === addSetId);
        if (match && match.sets.length < 3) {
            match.sets.push({ scoreA: 0, scoreB: 0 });
            renderTimetable();
        }
    }

    if (removeSetId) {
        const match = appMatches.find(m => m.id === removeSetId);
        if (match && match.sets.length === 3) {
            match.sets.pop();
            updateMatchStatus(match);
            renderTimetable();
            if (appMatches.some(m => m.isFinalStage)) {
                // スコア調整時：リアルタイム反映はするが自動スクロールはさせない（isAutoScroll = false）
                renderRankings(lastCalculatedRankings, false);
            }
        }
    }
}

function handleScoreInputs(e) {
    if (!e.target.classList.contains('score-input')) return;

    const matchId = e.target.getAttribute('data-match-id');
    const idx = parseInt(e.target.getAttribute('data-set-idx'));
    const team = e.target.getAttribute('data-team');

    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 99) val = 99;
    e.target.value = val;

    const match = appMatches.find(m => m.id === matchId);
    if (!match) return;

    if (team === 'A') match.sets[idx].scoreA = val;
    if (team === 'B') match.sets[idx].scoreB = val;

    updateMatchStatus(match);

    const card = e.target.closest('.match-card');
    card.querySelector('.set-count-summary').textContent = `${match.setCountA} - ${match.setCountB}`;
    card.querySelector('.team-A-wrap').classList.toggle('has-crown', match.isFinished && match.winnerId === match.teamA.id);
    card.querySelector('.team-B-wrap').classList.toggle('has-crown', match.isFinished && match.winnerId === match.teamB.id);

    if (appMatches.some(m => m.isFinalStage)) {
        // 決定戦スコア入力時：リアルタイム反映はするが、スクロールはさせない（isAutoScroll = false）
        renderRankings(lastCalculatedRankings, false);
    }
}

function handleCalcRanking() {
    const ruleSelect = document.getElementById('ranking-rule');
    const rule = ruleSelect ? ruleSelect.value : 'set-count';
    lastCalculatedRankings = calculateRankings(appTeams, appMatches, rule);
    // ボタン押下時はしっかり結果を見せるためにスクロールを有効にする（isAutoScroll = true）
    renderRankings(lastCalculatedRankings, true);
}

// 引数に isAutoScroll を追加（デフォルトは true）
function renderRankings(courtRankings, isAutoScroll = true) {
    const courtCount = parseInt(courtCountInput.value) || 1;

    // 1. 各コートの順位表を出力（CSSクラス化）
    let html = courtRankings.map(cr => `
        <h3 class="ranking-court-title">🏆 ${courtCount === 1 ? '順位表' : cr.court + 'コート 順位表'}</h3>
        <table class="ranking-table">
            <thead>
                <tr>
                    <th style="width: 10%;" class="text-center">順位</th>
                    <th class="text-left">チーム名</th>
                    <th style="width: 20%;" class="text-center">勝敗数</th>
                    <th style="width: 25%;" class="text-center">セット数 (率)</th>
                    <th style="width: 20%;" class="text-center">総得失点差</th>
                </tr>
            </thead>
            <tbody>
                ${cr.rankings.map((s, i) => `
                    <tr>
                        <td class="text-center">${i + 1}</td>
                        <td class="text-left"><strong>${s.teamName}</strong></td>
                        <td class="text-center">${s.matchWins}勝 / ${s.matchLosses}敗</td>
                        <td class="text-center">${s.setWins} - ${s.setLosses} (${s.setRatio.toFixed(2)})</td>
                        <td class="text-center">${s.pointDiff > 0 ? '+' : ''}${s.pointDiff}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `).join('');

    rankingContainer.innerHTML = html;

    // 2. 最終結果トーナメントの計算とテーブル表示
    const finalMatches = appMatches.filter(m => m.isFinalStage);
    if (finalMatches.length > 0) {
        const finalMatch = finalMatches.find(m => m.stageName.includes('決勝戦'));
        const thirdMatch = finalMatches.find(m => m.stageName.includes('3位決定戦'));

        const tournamentRows = [];

        // 決勝戦のデータ処理
        if (finalMatch) {
            if (finalMatch.isFinished) {
                const isWinnerA = finalMatch.winnerId === finalMatch.teamA.id;
                tournamentRows.push({ rank: '🏆 優勝', teamName: isWinnerA ? finalMatch.teamA.name : finalMatch.teamB.name });
                tournamentRows.push({ rank: '🥈 準優勝', teamName: isWinnerA ? finalMatch.teamB.name : finalMatch.teamA.name });
            } else {
                tournamentRows.push({ rank: '🏆 優勝', teamName: `⏳ ${finalMatch.teamA.name} または ${finalMatch.teamB.name}` });
                tournamentRows.push({ rank: '🥈 準優勝', teamName: `⏳ ${finalMatch.teamA.name} または ${finalMatch.teamB.name}` });
            }
        }

        // 3位決定戦のデータ処理
        let hasThirdPlaceScores = false;
        if (thirdMatch) {
            hasThirdPlaceScores = thirdMatch.sets.some(s => parseInt(s.scoreA) > 0 || parseInt(s.scoreB) > 0);
        }

        // 3位決定戦に点数が入っている場合のみ、3位と4位を表示対象にする
        if (thirdMatch && hasThirdPlaceScores) {
            if (thirdMatch.isFinished) {
                const isWinnerA = thirdMatch.winnerId === thirdMatch.teamA.id;
                tournamentRows.push({ rank: '🥉 3位', teamName: isWinnerA ? thirdMatch.teamA.name : thirdMatch.teamB.name });
                tournamentRows.push({ rank: '🏅 4位', teamName: isWinnerA ? thirdMatch.teamB.name : thirdMatch.teamA.name });
            } else {
                tournamentRows.push({ rank: '🥉 3位', teamName: `⏳ ${thirdMatch.teamA.name} または ${thirdMatch.teamB.name}` });
                tournamentRows.push({ rank: '🏅 4位', teamName: `⏳ ${thirdMatch.teamA.name} または ${thirdMatch.teamB.name}` });
            }
        }

        // 最終結果テーブルHTMLを生成（CSSクラス化）
        let finalsHtml = `
            <h3 class="final-result-title">🎉 最終結果</h3>
            <table class="ranking-table final-table">
                <thead>
                    <tr>
                        <th class="text-center">最終順位</th>
                        <th class="text-left">チーム名</th>
                    </tr>
                </thead>
                <tbody>
                    ${tournamentRows.map(row => `
                        <tr>
                            <td class="text-center rank-badge-cell">${row.rank}</td>
                            <td class="text-left final-team-cell"><strong>${row.teamName}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        rankingContainer.insertAdjacentHTML('beforeend', finalsHtml);
    }

    // 決定戦追加ボタンの表示（CSSクラス化）
    if (courtCount === 2 && courtRankings.length >= 2 && finalMatches.length === 0) {
        const btnHtml = `
            <div class="action-btn-wrapper">
                <button id="add-finals-btn" class="btn btn-primary" style="background-color: var(--main-pink); box-shadow: 0 4px 12px rgba(255, 71, 126, 0.4);">
                    🔥 各コート上位チームによる決定戦を追加する
                </button>
            </div>`;
        rankingContainer.insertAdjacentHTML('beforeend', btnHtml);
        document.getElementById('add-finals-btn').addEventListener('click', () => {
            const maxRound = appMatches.reduce((max, m) => m.round > max ? m.round : max, 0);
            const nextRound = maxRound + 1;
            const finals = generateFinalMatches(lastCalculatedRankings, nextRound);
            if (finals.length > 0) {
                appMatches = [...appMatches, ...finals];
                renderTimetable();
                renderRankings(lastCalculatedRankings, true);
                alert('決勝戦と3位決定戦をスケジュールの一番下に追加しました！');
            }
        });
    }

    // スクロール指定が有効（true）な場合のみ画面移動を実行
    if (isAutoScroll) {
        rankingContainer.scrollIntoView({ behavior: 'smooth' });
    }
}