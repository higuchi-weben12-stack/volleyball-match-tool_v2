// storage.js

window.addEventListener('DOMContentLoaded', () => {
    // 既存の基本設定セクションを取得
    const setupSection = document.querySelector('.setup-section');
    if (!setupSection) return;

    // --- 大会データ操作エリア（保存・読込・削除）の自動追加 ---
    const storageArea = document.createElement('div');
    storageArea.className = 'form-group-row storage-management-area';
    storageArea.style.marginTop = '25px';
    storageArea.style.paddingTop = '20px';
    storageArea.style.borderTop = '2px dashed var(--light-pink)';

    storageArea.innerHTML = `
        <div class="form-group" style="width: 100%;">
            <label style="font-weight: bold; color: var(--main-pink);">💾 大会データの保存と管理</label>
            
            <div class="storage-controls-wrapper">
                <div class="storage-action-block">
                    <button id="save-data-btn" class="btn btn-primary">現在データを保存</button>
                </div>
                
                <div class="storage-divider"></div>
                
                <div class="storage-select-block">
                    <label for="saved-tournaments-select">保存済み:</label>
                    <div class="select-buttons-inline">
                        <select id="saved-tournaments-select">
                            <option value="">-- 保存データを選択 --</option>
                        </select>
                        <button id="load-data-btn" class="btn btn-secondary">読込</button>
                        <button id="delete-data-btn" class="btn btn-danger">削除</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    setupSection.appendChild(storageArea);

    // 各ボタンにイベントリスナーを設定
    document.getElementById('save-data-btn').addEventListener('click', saveTournamentData);
    document.getElementById('load-data-btn').addEventListener('click', loadTournamentData);
    document.getElementById('delete-data-btn').addEventListener('click', deleteTournamentData);

    // 起動時に、すでにブラウザに保存されている大会一覧をプルダウンに反映
    updateSavedList();
});

// ローカルストレージで使用する管理用キー名
const STORAGE_KEY = 'volleyball_tournament_manager_list';

// 保存されている全大会のデータマップを取得する関数
function getSavedDataMap() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

// プルダウン（セレクトボックス）の選択肢を最新の状態に更新する関数
function updateSavedList() {
    const select = document.getElementById('saved-tournaments-select');
    if (!select) return;

    const savedMap = getSavedDataMap();
    select.innerHTML = '<option value="">-- 保存データを選択 --</option>';

    Object.keys(savedMap).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// 【保存処理】
function saveTournamentData() {
    const nameInput = document.getElementById('tournament-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        alert('大会名を入力してください。データを識別するために名前が必要です。');
        if (nameInput) nameInput.focus();
        return;
    }

    if (appTeams.length === 0) {
        alert('保存するデータ（チーム）がありません。チームを登録してから保存してください。');
        return;
    }

    const savedMap = getSavedDataMap();

    if (savedMap[name]) {
        if (!confirm(`「${name}」は既に保存されています。上書きしますか？`)) {
            return;
        }
    }

    savedMap[name] = {
        tournamentName: name,
        teams: appTeams,
        matches: appMatches,
        courtCount: document.getElementById('court-count').value,
        savedAt: new Date().toLocaleString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMap));
    alert(`大会「${name}」のデータを保存しました！`);

    updateSavedList();
    document.getElementById('saved-tournaments-select').value = name;
}

// 【呼び出し・復元処理】
function loadTournamentData() {
    const select = document.getElementById('saved-tournaments-select');
    const selectedName = select ? select.value : '';

    if (!selectedName) {
        alert('読み込みたい大会を一覧から選択してください。');
        return;
    }

    if (!confirm(`大会「${selectedName}」のデータを読み込みますか？\n（現在の内容は上書きされます）`)) {
        return;
    }

    try {
        const savedMap = getSavedDataMap();
        const savedData = savedMap[selectedName];

        if (!savedData) {
            alert('選択されたデータが見つかりません。');
            return;
        }

        appTeams = savedData.teams || [];
        appMatches = savedData.matches || [];

        if (document.getElementById('tournament-name')) {
            document.getElementById('tournament-name').value = savedData.tournamentName || '';
        }
        if (savedData.courtCount) {
            document.getElementById('court-count').value = savedData.courtCount;
        }

        renderTeamList();

        if (appMatches.length > 0) {
            const courtCount = parseInt(savedData.courtCount) || 1;
            const courtFilterSelect = document.getElementById('court-filter');

            courtFilterSelect.innerHTML = '<option value="all">すべて表示</option>' +
                Array.from({ length: courtCount }, (_, i) => `<option value="${String.fromCharCode(65 + i)}">${String.fromCharCode(65 + i)}コート</option>`).join('');

            if (courtCount === 1) {
                courtFilterSelect.parentElement.style.display = 'none';
            } else {
                courtFilterSelect.parentElement.style.display = 'flex';
            }

            document.getElementById('schedule-section').classList.remove('hidden');
            document.getElementById('ranking-action-area').classList.remove('hidden');

            renderTimetable();

            const ruleSelect = document.getElementById('ranking-rule');
            const rule = ruleSelect ? ruleSelect.value : 'set-count';
            lastCalculatedRankings = calculateRankings(appTeams, appMatches, rule);
            renderRankings(lastCalculatedRankings, false);
        } else {
            document.getElementById('schedule-section').classList.add('hidden');
            document.getElementById('ranking-action-area').classList.add('hidden');
            document.getElementById('ranking-container').innerHTML = '';
        }

        alert(`大会「${selectedName}」のデータを復元しました！`);

    } catch (error) {
        console.error(error);
        alert('データの復元に失敗しました。');
    }
}

// 【データ削除処理】
function deleteTournamentData() {
    const select = document.getElementById('saved-tournaments-select');
    const selectedName = select ? select.value : '';

    if (!selectedName) {
        alert('削除したい大会を一覧から選択してください。');
        return;
    }

    if (!confirm(`本当に大会「${selectedName}」の保存データを削除しますか？\n（この操作は取り消せません）`)) {
        return;
    }

    const savedMap = getSavedDataMap();
    delete savedMap[selectedName];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMap));
    alert(`「${selectedName}」のデータを削除しました。`);

    updateSavedList();
}