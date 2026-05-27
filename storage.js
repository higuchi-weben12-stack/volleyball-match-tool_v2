// storage.js

window.addEventListener('DOMContentLoaded', () => {
    // 既存の基本設定セクションを取得
    const setupSection = document.querySelector('.setup-section');
    if (!setupSection) return;

    // --- 大会データ操作エリア（ブラウザ保存 ＆ ファイル入出力）の自動追加 ---
    const storageArea = document.createElement('div');
    // 💡トラブルの原因だった form-group-row クラスを外し、専用の管理クラスのみにします
    storageArea.className = 'storage-management-section';
    storageArea.style.marginTop = '25px';
    storageArea.style.paddingTop = '20px';
    storageArea.style.borderTop = '2px dashed var(--light-pink)';

    // 💡構造を上下の2階建てに整理（labelの下にcontrols-wrapperが来る構造）
    storageArea.innerHTML = `
        <label class="storage-main-title">💾 大会データの保存と管理</label>
        
        <div class="storage-controls-wrapper">
            <div class="storage-action-block">
                <button id="save-data-btn" class="btn btn-primary">現在のデータを保存</button>
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

            <div class="storage-divider"></div>

            <div class="storage-file-block">
                <button id="export-file-btn" class="btn" style="background-color: #2ec4b6; color: white;">ファイルへ書き出し</button>
                <button id="import-file-trigger" class="btn" style="background-color: #9b5de5; color: white;">ファイルから復元</button>
                <input type="file" id="import-file-input" accept=".json" style="display: none;">
            </div>
        </div>
    `;
    setupSection.appendChild(storageArea);

    // 各ボタンにイベントリスナーを設定
    document.getElementById('save-data-btn').addEventListener('click', saveTournamentData);
    document.getElementById('load-data-btn').addEventListener('click', loadTournamentData);
    document.getElementById('delete-data-btn').addEventListener('click', deleteTournamentData);

    // ファイル入出力用のイベントリスナー
    document.getElementById('export-file-btn').addEventListener('click', exportTournamentToFile);
    document.getElementById('import-file-trigger').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importTournamentFromFile);

    // 起動時にブラウザ保存の一覧をプルダウンに反映
    updateSavedList();
});

// ローカルストレージ管理用キー
const STORAGE_KEY = 'volleyball_tournament_manager_list';

function getSavedDataMap() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

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

// データから共通のパッケージを作る関数
function createTournamentPackage(name) {
    return {
        tournamentName: name,
        teams: appTeams,
        matches: appMatches,
        courtCount: document.getElementById('court-count').value,
        savedAt: new Date().toLocaleString()
    };
}

// 共通の復元処理ロジック
function restoreTournamentFromObject(savedData) {
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
}

// 【ブラウザ保存】
function saveTournamentData() {
    const nameInput = document.getElementById('tournament-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        alert('大会名を入力してください。');
        if (nameInput) nameInput.focus();
        return;
    }
    if (appTeams.length === 0) {
        alert('保存するデータ（チーム）がありません。');
        return;
    }

    const savedMap = getSavedDataMap();
    if (savedMap[name] && !confirm(`「${name}」は既に保存されています。上書きしますか？`)) return;

    savedMap[name] = createTournamentPackage(name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMap));
    alert(`大会「${name}」のデータを保存しました！`);

    updateSavedList();
    document.getElementById('saved-tournaments-select').value = name;
}

// 【ブラウザ読込】
function loadTournamentData() {
    const select = document.getElementById('saved-tournaments-select');
    const selectedName = select ? select.value : '';

    if (!selectedName) {
        alert('読み込みたい大会を選択してください。');
        return;
    }
    if (!confirm(`「${selectedName}」のデータを読み込みますか？`)) return;

    const savedMap = getSavedDataMap();
    const savedData = savedMap[selectedName];

    if (!savedData) {
        alert('データが見つかりません。');
        return;
    }

    restoreTournamentFromObject(savedData);
    alert(`「${selectedName}」のデータを復元しました！`);
}

// 【ブラウザデータ削除】
function deleteTournamentData() {
    const select = document.getElementById('saved-tournaments-select');
    const selectedName = select ? select.value : '';

    if (!selectedName) {
        alert('削除したい大会を選択してください。');
        return;
    }
    if (!confirm(`本当に「${selectedName}」のデータを削除しますか？`)) return;

    const savedMap = getSavedDataMap();
    delete savedMap[selectedName];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMap));
    alert(`「${selectedName}」のデータを削除しました。`);
    updateSavedList();
}

// 【ファイルへ書き出し処理】
function exportTournamentToFile() {
    const nameInput = document.getElementById('tournament-name');
    const name = nameInput ? nameInput.value.trim() : '大会データ';

    if (appTeams.length === 0) {
        alert('書き出すデータ（チーム）がありません。');
        return;
    }

    const dataObj = createTournamentPackage(name);
    const jsonString = JSON.stringify(dataObj, null, 2);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_データ.json`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 【ファイルからインポート処理】
function importTournamentFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const savedData = JSON.parse(event.target.result);

            if (!savedData.teams || !savedData.tournamentName) {
                throw new Error('不適切なファイル形式です。');
            }

            if (!confirm(`ファイルから大会「${savedData.tournamentName}」のデータを復元しますか？`)) {
                return;
            }

            restoreTournamentFromObject(savedData);
            alert(`ファイルから「${savedData.tournamentName}」のデータを正常に復元しました！`);

        } catch (error) {
            console.error(error);
            alert('ファイルの読み込みに失敗しました。正しい大会データJSONファイルを選択してください。');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}