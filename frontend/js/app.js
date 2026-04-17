// ─── MAIN APP CONTROLLER — PvP Matchmaking Edition ───────────────────────────

const App = (() => {
  let game          = null;
  let playerColor   = 'w';
  let selectedWager = CONFIG.DEFAULT_WAGER;
  let gameActive    = false;
  let moveHistory   = [];
  let currentGameId = null;
  let peer          = null;
  let conn          = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    setupEventListeners();
    updateUI();

    const params = new URLSearchParams(window.location.search);
    const inviteGameId = params.get('game');
    if (inviteGameId) {
      window._pendingInviteGameId = inviteGameId;
      showScreen('landing');
      showToast('🎮 Invite link detected — connect wallet to join!');
    } else {
      showScreen('landing');
    }
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    document.querySelectorAll('.gnav-btn[data-nav]').forEach(b =>
      b.classList.toggle('active', b.dataset.nav === name)
    );
    if (name === 'leaderboard') loadLeaderboard();
  }

  function switchLobbyTab(tab) {
    document.querySelectorAll('.lobby-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    document.getElementById('tab-findmatch').style.display = tab === 'findmatch' ? '' : 'none';
    document.getElementById('tab-browse').style.display    = tab === 'browse'    ? '' : 'none';
    document.getElementById('tab-history').style.display   = tab === 'history'   ? '' : 'none';
    if (tab === 'browse') loadOpenGames();
    if (tab === 'history') loadMatchHistory();
  }

  function setFmState(state) {
    ['fm-idle','fm-searching','fm-waiting'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const target = document.getElementById('fm-' + state);
    if (target) target.style.display = '';
  }

  // ── Event Listeners ───────────────────────────────────────────────────────
  function setupEventListeners() {
    document.getElementById('btn-connect-nav')?.addEventListener('click', handleConnect);
    document.getElementById('btn-connect-hero')?.addEventListener('click', handleConnect);

    document.getElementById('gnav-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen('landing');
    });

    document.querySelectorAll('.gnav-btn[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'lobby' && !Web3Manager.isConnected()) {
          document.getElementById('btn-connect-nav')?.click();
        } else {
          showScreen(target);
        }
      });
    });

    document.getElementById('btn-refresh-lb')?.addEventListener('click', loadLeaderboard);

    document.querySelectorAll('.wager-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wager-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedWager = parseFloat(btn.dataset.wager);
        updateWagerDisplay();
      });
    });

    document.querySelectorAll('.lobby-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchLobbyTab(btn.dataset.tab));
    });

    document.getElementById('btn-find-match')?.addEventListener('click', handleFindMatch);
    document.getElementById('btn-refresh-games')?.addEventListener('click', loadOpenGames);
    document.getElementById('btn-refresh-history')?.addEventListener('click', loadMatchHistory);
    document.getElementById('btn-resign')?.addEventListener('click', handleResign);
    document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
      const input = document.getElementById('waiting-invite-link');
      if (input?.value) {
        navigator.clipboard.writeText(input.value).then(() => showToast('✅ Link copied!'));
      }
    });
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      document.getElementById('modal-gameover')?.classList.remove('active');
      cleanupPeer();
      currentGameId = null;
      setFmState('idle');
      showScreen('lobby');
    });

    window.addEventListener('walletChanged', e => {
      if (!e.detail.account) updateWalletUI(null);
    });
  }

  // ── Connect Wallet ─────────────────────────────────────────────────────────
  async function handleConnect(e) {
    const btn = e?.currentTarget;
    const origText = btn?.textContent;
    if (btn) { btn.textContent = 'CONNECTING...'; btn.disabled = true; }
    try {
      const account = await Web3Manager.connectWallet();
      updateWalletUI(account);
      const bal = await Web3Manager.getBalance();
      document.querySelectorAll('.balance-chip').forEach(el => el.textContent = bal + ' ETH');
      const gnavBal = document.querySelector('.gnav-balance');
      if (gnavBal) { gnavBal.textContent = bal + ' ETH'; gnavBal.style.display = ''; }

      if (window._pendingInviteGameId) {
        const inviteId = window._pendingInviteGameId;
        window._pendingInviteGameId = null;
        showScreen('lobby');
        switchLobbyTab('browse');
        showToast('⚡ Joining game from invite...');
        const gameInfo = await Web3Manager.getGame(inviteId);
        const wagerEth = parseFloat(ethers.utils.formatEther(gameInfo.wager));
        await handleJoinFromLobby(inviteId, wagerEth);
      } else {
        showScreen('lobby');
        switchLobbyTab('findmatch');
      }
    } catch (err) {
      if (err.message === 'NO_WALLET') showToast('❌ No wallet! Install MetaMask.');
      else showToast('❌ ' + (err.message || 'Connection failed'));
    } finally {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
  }

  function updateWalletUI(account) {
    const short = Web3Manager.shortenAddress(account);
    document.querySelectorAll('.wallet-address').forEach(el =>
      el.textContent = short || 'NOT CONNECTED'
    );
    document.querySelectorAll('.wallet-status').forEach(el =>
      el.classList.toggle('connected', !!account)
    );
    const connectBtn = document.getElementById('btn-connect-nav');
    const gnavWallet = document.querySelector('.gnav-wallet');
    const gnavBal    = document.querySelector('.gnav-balance');
    if (account) {
      if (connectBtn) connectBtn.style.display = 'none';
      if (gnavWallet) gnavWallet.style.display = '';
      if (gnavBal)    gnavBal.style.display = '';
    } else {
      if (connectBtn) connectBtn.style.display = '';
      if (gnavWallet) gnavWallet.style.display = 'none';
      if (gnavBal)    gnavBal.style.display = 'none';
    }
  }

  // ── Find Match (auto-matchmaking) ──────────────────────────────────────────
  async function handleFindMatch() {
    if (!Web3Manager.isConnected()) { showToast('❌ Connect wallet first!'); return; }
    if (CONFIG.CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      showToast('❌ Contract not deployed yet.'); return;
    }

    const btn = document.getElementById('btn-find-match');
    if (btn) { btn.textContent = 'SEARCHING...'; btn.disabled = true; }
    setFmState('searching');

    const wagerLabel = document.getElementById('fm-wager-label');
    if (wagerLabel) wagerLabel.textContent = selectedWager;

    try {
      // Check if there's an open game with matching wager
      const openGames  = await Web3Manager.getOpenGames();
      const myAccount  = Web3Manager.getAccount().toLowerCase();
      const match      = openGames.find(g =>
        parseFloat(g.wager) === selectedWager &&
        g.creator.toLowerCase() !== myAccount
      );

      if (match) {
        // Auto-join the matching game
        showToast('⚡ Match found! Joining...');
        await Web3Manager.joinGame(match.gameId, match.wager);
        currentGameId = match.gameId;
        playerColor   = 'b';
        setupJoinerPeer(match.gameId);
      } else {
        // No match — create a new game and wait in lobby
        const { gameId } = await Web3Manager.createGame(selectedWager);
        currentGameId = gameId;
        playerColor   = 'w';

        const lockedEl = document.getElementById('fm-locked-wager');
        if (lockedEl) lockedEl.textContent = selectedWager + ' ETH';

        const inviteInput = document.getElementById('waiting-invite-link');
        if (inviteInput) {
          inviteInput.value = window.location.origin + window.location.pathname + '?game=' + gameId;
        }
        const wagerEl = document.getElementById('waiting-wager');
        if (wagerEl) wagerEl.textContent = selectedWager + ' ETH';

        setFmState('waiting');
        showScreen('waiting');
        showToast('✅ Listed in lobby! Waiting for opponent...');
        setupCreatorPeer(gameId);
      }
    } catch (err) {
      setFmState('idle');
      showToast('❌ ' + (err.reason || err.message || 'Failed'));
    } finally {
      if (btn) { btn.textContent = '⚡ FIND MATCH'; btn.disabled = false; }
    }
  }

  // ── Load Open Games (Browse Lobby) ─────────────────────────────────────────
  async function loadOpenGames() {
    const listEl = document.getElementById('open-games-list');
    if (!listEl) return;

    if (!Web3Manager.isConnected()) {
      listEl.innerHTML = '<div class="games-empty">Connect your wallet to see open games.</div>';
      return;
    }
    if (CONFIG.CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      listEl.innerHTML = '<div class="games-empty">Contract not deployed yet.</div>';
      return;
    }

    listEl.innerHTML = '<div class="games-loading">Loading games...</div>';

    try {
      const games    = await Web3Manager.getOpenGames();
      const myAddr   = Web3Manager.getAccount().toLowerCase();
      const filtered = games.filter(g => g.creator.toLowerCase() !== myAddr);

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="games-empty">No open games right now.<br/>Be the first — click Find Match!</div>';
        return;
      }

      listEl.innerHTML = '';
      filtered.forEach(g => {
        const card = document.createElement('div');
        card.className = 'game-card';
        const potentialWin = (parseFloat(g.wager) * 1.9).toFixed(4);
        card.innerHTML = `
          <div class="gc-player">
            <span class="gc-icon">♔</span>
            <span class="gc-addr">${Web3Manager.shortenAddress(g.creator)}</span>
          </div>
          <div class="gc-wager">
            <span class="gc-eth">${g.wager} ETH</span>
            <span class="gc-win">WIN ${potentialWin} ETH</span>
          </div>
          <div class="gc-time">${g.age}</div>
          <button class="btn btn-gold gc-join-btn" data-gameid="${g.gameId}" data-wager="${g.wager}">▶ JOIN</button>
        `;
        card.querySelector('.gc-join-btn').addEventListener('click', () =>
          handleJoinFromLobby(g.gameId, parseFloat(g.wager))
        );
        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = '<div class="games-empty">Error loading games: ' + (err.message || '') + '</div>';
    }
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  async function loadLeaderboard() {
    const listEl = document.getElementById('lb-list');
    if (!listEl) return;

    if (!Web3Manager.isConnected()) {
      listEl.innerHTML = '<div class="games-empty">Connect wallet to load leaderboard.</div>';
      return;
    }
    if (CONFIG.CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      listEl.innerHTML = '<div class="games-empty">Contract not deployed yet.</div>';
      return;
    }

    listEl.innerHTML = '<div class="games-loading">Loading leaderboard...</div>';

    try {
      const entries = await Web3Manager.getLeaderboard();

      if (entries.length === 0) {
        listEl.innerHTML = '<div class="games-empty">No completed games yet. Be the first!</div>';
        return;
      }

      const myAddr = Web3Manager.getAccount().toLowerCase();
      listEl.innerHTML = '';

      entries.forEach((e, i) => {
        const isMe = e.address.toLowerCase() === myAddr;
        const medals = ['🥇','🥈','🥉'];
        const rank = medals[i] || `#${i + 1}`;
        const row = document.createElement('div');
        row.className = 'lb-row' + (isMe ? ' lb-row-me' : '');
        row.innerHTML = `
          <span class="lb-rank">${rank}</span>
          <span class="lb-addr">${Web3Manager.shortenAddress(e.address)}${isMe ? ' <span class="history-you-badge">YOU</span>' : ''}</span>
          <span class="lb-wins">${e.wins} WIN${e.wins !== 1 ? 'S' : ''}</span>
          <span class="lb-eth">+${e.totalEth} ETH</span>
        `;
        listEl.appendChild(row);
      });
    } catch (err) {
      listEl.innerHTML = '<div class="games-empty">Error: ' + (err.message || '') + '</div>';
    }
  }

  // ── Match History ──────────────────────────────────────────────────────────
  async function loadMatchHistory() {
    const listEl = document.getElementById('match-history-list');
    if (!listEl) return;

    if (!Web3Manager.isConnected()) {
      listEl.innerHTML = '<div class="games-empty">Connect your wallet to see match history.</div>';
      return;
    }
    if (CONFIG.CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      listEl.innerHTML = '<div class="games-empty">Contract not deployed yet.</div>';
      return;
    }

    listEl.innerHTML = '<div class="games-loading">Loading history...</div>';

    try {
      const matches = await Web3Manager.getMatchHistory();

      if (matches.length === 0) {
        listEl.innerHTML = '<div class="games-empty">No completed games yet.</div>';
        return;
      }

      listEl.innerHTML = '';
      matches.forEach((m, i) => {
        const card = document.createElement('div');
        card.className = 'game-card history-card';
        const isMe = m.winner.toLowerCase() === Web3Manager.getAccount().toLowerCase();
        card.innerHTML = `
          <div class="gc-player">
            <span class="gc-icon">${isMe ? '🏆' : '♟'}</span>
            <span class="gc-addr history-winner">${Web3Manager.shortenAddress(m.winner)}</span>
            ${isMe ? '<span class="history-you-badge">YOU</span>' : ''}
          </div>
          <div class="gc-wager">
            <span class="gc-eth">+${m.payout} ETH</span>
            <span class="gc-win history-wager-lbl">WAGER ${m.wager} ETH</span>
          </div>
          <a href="${Web3Manager.getTxLink(m.txHash)}" target="_blank" class="btn btn-ghost history-tx-btn">TX ↗</a>
        `;
        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = '<div class="games-empty">Error loading history: ' + (err.message || '') + '</div>';
    }
  }

  // ── Join from Browse Lobby ──────────────────────────────────────────────────
  async function handleJoinFromLobby(gameId, wagerEth) {
    if (!Web3Manager.isConnected()) { showToast('❌ Connect wallet first!'); return; }
    const btn = document.querySelector(`[data-gameid="${gameId}"]`);
    if (btn) { btn.textContent = 'JOINING...'; btn.disabled = true; }
    try {
      await Web3Manager.joinGame(gameId, wagerEth);
      currentGameId = gameId;
      playerColor   = 'b';
      selectedWager = wagerEth;
      showToast('✅ Joined! Connecting to opponent...');
      setupJoinerPeer(gameId);
    } catch (err) {
      showToast('❌ ' + (err.reason || err.message || 'Join failed'));
      if (btn) { btn.textContent = '▶ JOIN'; btn.disabled = false; }
    }
  }

  // ── PeerJS ─────────────────────────────────────────────────────────────────
  function getPeerId(gameId) {
    return 'pc' + gameId.slice(2, 18);
  }

  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ]
    }
  };

  function setupCreatorPeer(gameId) {
    const peerId = getPeerId(gameId);
    peer = new Peer(peerId, PEER_CONFIG);
    peer.on('open', () => {});
    peer.on('connection', connection => {
      conn = connection;
      conn.on('open', () => {
        conn.send({ type: 'start', color: 'b', wager: selectedWager });
        startGame();
      });
      conn.on('data', handlePeerData);
      conn.on('close', () => { if (gameActive) showToast('⚠️ Opponent disconnected'); });
    });
    peer.on('error', err => {
      showToast('❌ P2P error: ' + err.type);
      if (err.type === 'unavailable-id') {
        setTimeout(() => setupCreatorPeer(gameId), 2000);
      }
    });
  }

  function setupJoinerPeer(gameId) {
    const peerId = getPeerId(gameId);
    peer = new Peer(undefined, PEER_CONFIG);
    peer.on('open', () => {
      conn = peer.connect(peerId, { reliable: true });
      conn.on('open', () => showToast('✅ Connected! Game starting...'));
      conn.on('data', handlePeerData);
      conn.on('close', () => { if (gameActive) showToast('⚠️ Opponent disconnected'); });
      conn.on('error', () => showToast('❌ Connection error. Try rejoining.'));
    });
    peer.on('error', err => {
      showToast('❌ P2P error: ' + err.type);
      if (err.type === 'peer-unavailable') {
        showToast('⏳ Waiting for opponent to connect...');
        setTimeout(() => setupJoinerPeer(gameId), 3000);
      }
    });
  }

  function handlePeerData(data) {
    if (data.type === 'start') {
      playerColor   = data.color;
      selectedWager = data.wager;
      startGame();
    } else if (data.type === 'move') {
      applyOpponentMove(data.move);
    } else if (data.type === 'resign') {
      handleOpponentResign();
    }
  }

  function cleanupPeer() {
    if (conn) { try { conn.close(); } catch {} conn = null; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
  }

  // ── Game ────────────────────────────────────────────────────────────────────
  function startGame() {
    game        = new Chess();
    moveHistory = [];
    gameActive  = true;
    const gwEl  = document.getElementById('game-wager');
    if (gwEl) gwEl.textContent = selectedWager + ' ETH';
    const winEl = document.getElementById('game-win-amount');
    if (winEl) winEl.textContent = (selectedWager * 1.9).toFixed(4) + ' ETH';
    showScreen('game');
    Web3Manager.getBalance().then(bal => {
      const el = document.getElementById('game-balance');
      if (el) el.textContent = bal;
    });
    ChessBoard.init(game, playerColor, handlePlayerMove);
    updateMoveHistory();
    updateGameStatus();
  }

  function handlePlayerMove(move) {
    if (!gameActive) return;
    moveHistory.push(move);
    updateMoveHistory();
    playMoveSound(move);
    if (conn && conn.open) {
      conn.send({ type: 'move', move: { from: move.from, to: move.to, promotion: move.promotion } });
    }
    if (game.isGameOver()) { handleGameOver(); return; }
    updateGameStatus();
  }

  function applyOpponentMove(moveData) {
    if (!gameActive) return;
    const result = game.move(moveData);
    if (result) {
      ChessBoard.setLastMove(result.from, result.to);
      ChessBoard.render();
      moveHistory.push(result);
      updateMoveHistory();
      playMoveSound(result);
      updateGameStatus();
      if (game.isGameOver()) handleGameOver();
    }
  }

  async function handleGameOver() {
    gameActive = false;
    let isWin, title, subtitle;
    if (game.isCheckmate()) {
      isWin    = game.turn() !== playerColor;
      title    = isWin ? 'CHECKMATE! YOU WIN!' : 'CHECKMATE! YOU LOSE!';
      subtitle = isWin
        ? `Opponent submits loss. You earn ${(selectedWager * 1.9).toFixed(4)} ETH.`
        : 'Submitting loss on-chain...';
    } else {
      isWin    = false;
      title    = game.isStalemate() ? 'STALEMATE!' : 'DRAW!';
      subtitle = 'Both can refund after 2 hrs via timeout.';
    }
    showGameOverModal(title, subtitle, isWin);
    if (currentGameId && !isWin && game.isCheckmate()) {
      try {
        await Web3Manager.submitLoss(currentGameId);
        showToast('📤 Loss submitted — opponent receives payout');
        document.getElementById('gameover-subtitle').textContent =
          `Lost ${selectedWager} ETH. Opponent paid out.`;
      } catch (err) {
        showToast('❌ Chain error: ' + (err.reason || err.message));
      }
    }
  }

  function handleOpponentResign() {
    gameActive = false;
    showGameOverModal(
      'OPPONENT RESIGNED!',
      `They will submit loss on-chain. You earn ${(selectedWager * 1.9).toFixed(4)} ETH.`,
      true
    );
  }

  async function handleResign() {
    if (!gameActive) return;
    if (!confirm('Resign? You will lose your wager.')) return;
    gameActive = false;
    if (conn && conn.open) conn.send({ type: 'resign' });
    showGameOverModal('YOU RESIGNED', 'Submitting loss on-chain...', false);
    if (currentGameId) {
      try {
        await Web3Manager.submitLoss(currentGameId);
        showToast('📤 Loss submitted');
        document.getElementById('gameover-subtitle').textContent = `Lost ${selectedWager} ETH.`;
      } catch (err) {
        showToast('❌ Chain error: ' + (err.reason || err.message));
      }
    }
  }

  // ── UI Helpers ─────────────────────────────────────────────────────────────
  function updateMoveHistory() {
    const el = document.getElementById('move-history');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
      const num   = Math.floor(i / 2) + 1;
      const white = moveHistory[i]?.san || '';
      const black = moveHistory[i + 1]?.san || '';
      const row   = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = `<span class="move-num">${num}.</span><span class="move-w">${white}</span><span class="move-b">${black}</span>`;
      el.appendChild(row);
    }
    el.scrollTop = el.scrollHeight;
  }

  function updateGameStatus() {
    const el = document.getElementById('game-status');
    if (!el) return;
    if (game.isCheckmate()) {
      el.textContent = 'CHECKMATE!'; el.className = 'status-text status-check';
    } else if (game.inCheck()) {
      el.textContent = 'CHECK!'; el.className = 'status-text status-check';
    } else if (game.isStalemate()) {
      el.textContent = 'STALEMATE'; el.className = 'status-text';
    } else {
      const myTurn   = game.turn() === playerColor;
      el.textContent = myTurn ? 'YOUR TURN' : "OPPONENT'S TURN";
      el.className   = 'status-text ' + (myTurn ? 'status-player' : 'status-opponent');
    }
  }

  function updateWagerDisplay() {
    document.querySelectorAll('.selected-wager-display').forEach(el =>
      el.textContent = selectedWager + ' ETH'
    );
    document.querySelectorAll('.potential-win-display').forEach(el =>
      el.textContent = (selectedWager * 1.9).toFixed(4) + ' ETH'
    );
  }

  function updateUI() {
    updateWagerDisplay();
    document.querySelector(`[data-wager="${CONFIG.DEFAULT_WAGER}"]`)?.classList.add('active');
  }

  function showGameOverModal(title, subtitle, isWin) {
    const modal = document.getElementById('modal-gameover');
    if (!modal) return;
    document.getElementById('gameover-title').textContent    = title;
    document.getElementById('gameover-subtitle').textContent = subtitle;
    document.getElementById('gameover-icon').textContent     = isWin ? '🏆' : '💀';
    modal.className = 'modal active ' + (isWin ? 'modal-win' : 'modal-lose');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className   = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
  }

  function playMoveSound(move) {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = move.captured ? 440 : 220;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  return { init, showScreen };
})();

window.showScreen = (name) => App.showScreen(name);
document.addEventListener('DOMContentLoaded', App.init);
