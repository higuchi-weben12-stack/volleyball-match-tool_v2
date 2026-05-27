// ==========================================================================
// 1. 総当たり戦スケジュール生成（1コート1ラウンド1試合厳守版）
// ==========================================================================
function generateLeagueSchedule(teams, courtCount) {
    const courts = [];
    for (let i = 0; i < courtCount; i++) {
        courts.push(String.fromCharCode(65 + i)); // ['A', 'B'...]
    }

    const localTeams = teams.map(t => ({ ...t }));

    // 各コートごとにチームをグループ分け
    const teamsByCourt = {};
    courts.forEach(c => teamsByCourt[c] = []);
    localTeams.forEach(team => {
        if (teamsByCourt[team.court]) {
            teamsByCourt[team.court].push(team);
        }
    });

    // 各コートごとに、純粋な総当たり（ラウンドロビン）の全試合リストを個別に作成
    const courtMatchPools = {};

    courts.forEach(court => {
        courtMatchPools[court] = [];
        const courtTeams = [...teamsByCourt[court]];
        if (courtTeams.length < 2) return;

        const isOdd = courtTeams.length % 2 !== 0;
        if (isOdd) {
            courtTeams.push({ id: `bye-${court}`, name: 'お休み', court: court, isBye: true });
        }

        const numTeams = courtTeams.length;
        const totalRounds = numTeams - 1;
        const tempTeams = [...courtTeams];

        for (let r = 0; r < totalRounds; r++) {
            for (let i = 0; i < numTeams / 2; i++) {
                const home = tempTeams[i];
                const away = tempTeams[numTeams - 1 - i];

                if (!home.isBye && !away.isBye) {
                    courtMatchPools[court].push({ court, teamA: home, teamB: away });
                }
            }
            tempTeams.splice(1, 0, tempTeams.pop());
        }
    });

    // チームごとの対戦・審判の履歴履歴
    const teamHistory = {};
    teams.forEach(t => {
        teamHistory[t.id] = { lastMatchRound: -10, lastRefereeRound: -10, refereeCount: 0 };
    });

    const finalMatches = [];
    let currentRound = 1;

    while (true) {
        let anyMatchAdded = false;
        const roundMatches = [];

        for (const court of courts) {
            const pool = courtMatchPools[court];
            if (!pool || pool.length === 0) continue;

            let bestMatchIndex = -1;
            let bestScore = -Infinity;

            for (let i = 0; i < pool.length; i++) {
                const match = pool[i];
                const histA = teamHistory[match.teamA.id];
                const histB = teamHistory[match.teamB.id];

                const intervalA = currentRound - histA.lastMatchRound;
                const intervalB = currentRound - histB.lastMatchRound;

                let score = 0;
                if (intervalA === 1) score -= 100; // 連戦は極力避ける
                if (intervalB === 1) score -= 100;
                if (intervalA === 2) score += 10;
                if (intervalB === 2) score += 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatchIndex = i;
                }
            }

            if (bestMatchIndex !== -1) {
                const selectedMatch = pool[bestMatchIndex];

                roundMatches.push({
                    id: `match-${currentRound}-${court}-${Math.random().toString(36).substr(2, 5)}`,
                    court: court,
                    round: currentRound,
                    teamA: selectedMatch.teamA,
                    teamB: selectedMatch.teamB,
                    sets: [{ scoreA: 0, scoreB: 0 }, { scoreA: 0, scoreB: 0 }],
                    setCountA: 0,
                    setCountB: 0,
                    isFinished: false,
                    winnerId: null,
                    referee: null
                });

                pool.splice(bestMatchIndex, 1);
                anyMatchAdded = true;
            }
        }

        if (!anyMatchAdded) break;

        // 審判の割り当て（平準化）
        roundMatches.forEach(match => {
            const sameCourtTeams = teams.filter(t => t.court === match.court);
            const candidates = sameCourtTeams.filter(t =>
                !roundMatches.some(rm => rm.teamA.id === t.id || rm.teamB.id === t.id)
            );

            const allCandidates = candidates.length > 0 ? candidates : teams.filter(t =>
                !roundMatches.some(rm => rm.teamA.id === t.id || rm.teamB.id === t.id)
            );

            if (allCandidates.length > 0) {
                let bestReferee = null;
                let minRefScore = Infinity;

                allCandidates.forEach(ref => {
                    const rHist = teamHistory[ref.id];
                    let refScore = rHist.refereeCount * 25;
                    if (currentRound - rHist.lastRefereeRound === 1) refScore += 15;
                    if (currentRound - rHist.lastMatchRound === 1) refScore += 5;

                    if (refScore < minRefScore) {
                        minRefScore = refScore;
                        bestReferee = ref;
                    }
                });

                if (bestReferee) {
                    match.referee = bestReferee;
                    teamHistory[bestReferee.id].lastRefereeRound = currentRound;
                    teamHistory[bestReferee.id].refereeCount++;
                }
            }

            teamHistory[match.teamA.id].lastMatchRound = currentRound;
            teamHistory[match.teamB.id].lastMatchRound = currentRound;
        });

        roundMatches.forEach(rm => finalMatches.push(rm));
        currentRound++;
    }

    return finalMatches.sort((a, b) => a.round - b.round || a.court.localeCompare(b.court));
}

// ==========================================================================
// 2. 順位決定戦（決勝・3位決定戦）生成 【コート別・試合なしチーム割り当て版】
// ==========================================================================
function generateFinalMatches(courtRankings, nextRoundNumber) {
    const topA = courtRankings.find(c => c.court === 'A')?.rankings[0];
    const topB = courtRankings.find(c => c.court === 'B')?.rankings[0];
    const secondA = courtRankings.find(c => c.court === 'A')?.rankings[1];
    const secondB = courtRankings.find(c => c.court === 'B')?.rankings[1];

    if (!topA || !topB) return [];

    // 1. 決勝戦・3位決定戦それぞれの対戦チームID
    const finalTeamIds = [topA.teamId, topB.teamId];
    const thirdTeamIds = (secondA && secondB) ? [secondA.teamId, secondB.teamId] : [];

    // 2. コート別の全所属チームリストを生成
    const teamsInCourtA = [];
    const teamsInCourtB = [];
    courtRankings.forEach(cr => {
        cr.rankings.forEach(r => {
            const teamObj = { id: r.teamId, name: r.teamName, court: cr.court };
            if (cr.court === 'A') teamsInCourtA.push(teamObj);
            if (cr.court === 'B') teamsInCourtB.push(teamObj);
        });
    });

    // 全体の出場チームID
    const allPlayingTeamIds = [...finalTeamIds, ...thirdTeamIds];

    // 3. 【決勝戦（Aコート）の審判選定】
    // 予選が「Aコート」で、かつ決勝・3位決定戦のどちらにも出場していない完全空きチーム
    const idleCourtATeams = teamsInCourtA.filter(t => !allPlayingTeamIds.includes(t.id));
    let finalReferee = null;

    if (idleCourtATeams.length > 0) {
        finalReferee = idleCourtATeams[0]; // Aコートの空きチームを割り当て
    } else {
        // Aコートに空きがない場合のフォールバック（全体で試合のないチーム、もしいなければ3位決定戦のチーム）
        const totalIdle = [...teamsInCourtA, ...teamsInCourtB].filter(t => !allPlayingTeamIds.includes(t.id));
        if (totalIdle.length > 0) {
            finalReferee = totalIdle[0];
        } else if (thirdTeamIds.length > 0) {
            finalReferee = teamsInCourtA.find(t => t.id === thirdTeamIds[0]) || teamsInCourtB.find(t => t.id === thirdTeamIds[0]);
        }
    }

    // 4. 【3位決定戦（Bコート）の審判選定】
    // 予選が「Bコート」で、かつ決勝・3位決定戦のどちらにも出場していない完全空きチーム
    const idleCourtBTeams = teamsInCourtB.filter(t => !allPlayingTeamIds.includes(t.id));
    let thirdReferee = null;

    if (idleCourtBTeams.length > 0) {
        thirdReferee = idleCourtBTeams[0]; // Bコートの空きチームを割り当て
    } else {
        // Bコートに空きがない場合のフォールバック（全体で試合のない別のチーム、もしいなければ決勝戦のチーム）
        const totalIdle = [...teamsInCourtA, ...teamsInCourtB].filter(t => !allPlayingTeamIds.includes(t.id) && t.id !== finalReferee?.id);
        if (totalIdle.length > 0) {
            thirdReferee = totalIdle[0];
        } else if (finalTeamIds.length > 0) {
            thirdReferee = teamsInCourtB.find(t => t.id === finalTeamIds[0]) || teamsInCourtA.find(t => t.id === finalTeamIds[0]);
        }
    }

    // 決勝戦（Aコート）
    const finals = [{
        id: `match-final-1-${Date.now()}`,
        court: 'A',
        round: nextRoundNumber,
        isFinalStage: true,
        stageName: '🏆 決勝戦',
        teamA: { id: topA.teamId, name: topA.teamName },
        teamB: { id: topB.teamId, name: topB.teamName },
        sets: [{ scoreA: 0, scoreB: 0 }, { scoreA: 0, scoreB: 0 }],
        setCountA: 0, setCountB: 0, isFinished: false, winnerId: null,
        referee: finalReferee
    }];

    // 3位決定戦（Bコート）
    if (secondA && secondB) {
        finals.push({
            id: `match-final-2-${Date.now()}`,
            court: 'B',
            round: nextRoundNumber,
            isFinalStage: true,
            stageName: '🥉 3位決定戦',
            teamA: { id: secondA.teamId, name: secondA.teamName },
            teamB: { id: secondB.teamId, name: secondB.teamName },
            sets: [{ scoreA: 0, scoreB: 0 }, { scoreA: 0, scoreB: 0 }],
            setCountA: 0, setCountB: 0, isFinished: false, winnerId: null,
            referee: thirdReferee
        });
    }
    return finals;
}

// ==========================================================================
// 3. スコア入力時のリアルタイム勝敗判定ロジック
// ==========================================================================
function updateMatchStatus(match) {
    let winsA = 0, winsB = 0;

    match.sets.forEach(set => {
        const sA = parseInt(set.scoreA) || 0;
        const sB = parseInt(set.scoreB) || 0;
        if (sA === 0 && sB === 0) return;
        if (sA > sB) winsA++;
        if (sB > sA) winsB++;
    });

    match.setCountA = winsA;
    match.setCountB = winsB;
    match.isFinished = (winsA >= 2 || winsB >= 2);
    match.winnerId = match.isFinished ? (winsA > winsB ? match.teamA.id : match.teamB.id) : null;
}

// ==========================================================================
// 4. 順位表（ランキング）計算ロジック
// ==========================================================================
function calculateRankings(teams, matches, rule) {
    const stats = {};
    teams.forEach(t => {
        stats[t.id] = { teamId: t.id, teamName: t.name, court: t.court || 'A', matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0, totalPointsScored: 0, totalPointsConceded: 0, pointDiff: 0, setRatio: 0 };
    });

    matches.filter(m => !m.isFinalStage).forEach(m => {
        const sA = stats[m.teamA.id], sB = stats[m.teamB.id];
        if (!sA || !sB) return;

        m.sets.forEach(set => {
            const pA = parseInt(set.scoreA) || 0, pB = parseInt(set.scoreB) || 0;
            sA.totalPointsScored += pA; sA.totalPointsConceded += pB;
            sB.totalPointsScored += pB; sB.totalPointsConceded += pA;
        });

        sA.setWins += m.setCountA; sA.setLosses += m.setCountB;
        sB.setWins += m.setCountB; sB.setLosses += m.setCountA;

        if (m.setCountA > m.setCountB) { sA.matchWins++; sB.matchLosses++; }
        else if (m.setCountB > m.setCountA) { sB.matchWins++; sA.matchLosses++; }
    });

    const groups = {};
    Object.values(stats).forEach(s => {
        s.pointDiff = s.totalPointsScored - s.totalPointsConceded;
        s.setRatio = (s.setWins + s.setLosses) > 0 ? s.setWins / (s.setWins + s.setLosses) : 0;
        if (!groups[s.court]) groups[s.court] = [];
        groups[s.court].push(s);
    });

    return Object.keys(groups).map(court => {
        groups[court].sort((a, b) => {
            if (a.matchWins !== b.matchWins) return b.matchWins - a.matchWins;
            if (rule === 'set-count') return (b.setRatio - a.setRatio) || (b.pointDiff - a.pointDiff);
            return (b.pointDiff - a.pointDiff) || (b.setRatio - a.setRatio);
        });
        return { court, rankings: groups[court] };
    }).sort((a, b) => a.court.localeCompare(b.court));
}