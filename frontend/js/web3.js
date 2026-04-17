// ─── WEB3 INTEGRATION — ethers.js v5 ────────────────────────────────────────

const Web3Manager = (() => {
  const CONTRACT_ABI = [
    "function createGame() external payable returns (bytes32)",
    "function joinGame(bytes32 gameId) external payable",
    "function submitLoss(bytes32 gameId) external",
    "function refundTimeout(bytes32 gameId) external",
    "function getGame(bytes32 gameId) view returns (address, address, uint256, bool, bool, uint256, uint256)",
    "event GameCreated(bytes32 indexed gameId, address indexed white, uint256 wager)",
    "event GameJoined(bytes32 indexed gameId, address indexed black)",
    "event GameEnded(bytes32 indexed gameId, address indexed winner, uint256 payout)",
    "event GameRefunded(bytes32 indexed gameId, uint256 amount)",
  ];

  let provider = null;
  let signer   = null;
  let contract = null;
  let account  = null;

  // ── Connect Wallet ──────────────────────────────────────────────────────────
  async function connectWallet() {
    if (!window.ethereum) throw new Error("NO_WALLET");
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (network.chainId !== CONFIG.CHAIN_ID) await switchToBase();
    signer  = provider.getSigner();
    account = await signer.getAddress();
    if (CONFIG.CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    window.ethereum.on("accountsChanged", (accounts) => {
      account = accounts[0] || null;
      window.dispatchEvent(new CustomEvent("walletChanged", { detail: { account } }));
    });
    window.ethereum.on("chainChanged", () => window.location.reload());
    return account;
  }

  async function switchToBase() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x2105",
            chainName: "Base",
            rpcUrls: [CONFIG.CHAIN_RPC],
            nativeCurrency: CONFIG.CHAIN_CURRENCY,
            blockExplorerUrls: [CONFIG.CHAIN_EXPLORER],
          }],
        });
      } else throw err;
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();
  }

  // ── Create Game ─────────────────────────────────────────────────────────────
  async function createGame(wagerEth) {
    if (!contract) throw new Error("Contract not deployed yet");
    const value = ethers.utils.parseEther(wagerEth.toString());
    const tx = await contract.createGame({ value });
    const receipt = await tx.wait();
    const iface = new ethers.utils.Interface(CONTRACT_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "GameCreated") {
          return { txHash: receipt.transactionHash, gameId: parsed.args.gameId };
        }
      } catch {}
    }
    throw new Error("GameCreated event not found in receipt");
  }

  // ── Join Game ───────────────────────────────────────────────────────────────
  async function joinGame(gameId, wagerEth) {
    if (!contract) throw new Error("Contract not deployed yet");
    const value = ethers.utils.parseEther(wagerEth.toString());
    const tx = await contract.joinGame(gameId, { value });
    const receipt = await tx.wait();
    return { txHash: receipt.transactionHash };
  }

  // ── Submit Loss ─────────────────────────────────────────────────────────────
  async function submitLoss(gameId) {
    if (!contract) throw new Error("Contract not deployed yet");
    const tx = await contract.submitLoss(gameId);
    await tx.wait();
    return true;
  }

  // ── Refund Timeout ──────────────────────────────────────────────────────────
  async function refundTimeout(gameId) {
    if (!contract) throw new Error("Contract not deployed yet");
    const tx = await contract.refundTimeout(gameId);
    await tx.wait();
    return true;
  }

  // ── Get Open Games from Events ──────────────────────────────────────────────
  async function getOpenGames() {
    if (!contract) throw new Error("Contract not deployed yet");
    // Base ~2s block time — 1000 blocks ≈ 33 min (covers JOIN_TIMEOUT)
    const LOOKBACK = 1000;
    const [createdEvents, joinedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.GameCreated(), -LOOKBACK),
      contract.queryFilter(contract.filters.GameJoined(),  -LOOKBACK),
    ]);
    const joinedIds = new Set(joinedEvents.map(e => e.args.gameId));
    const now       = Math.floor(Date.now() / 1000);
    return createdEvents
      .filter(e => !joinedIds.has(e.args.gameId))
      .map(e => ({
        gameId:  e.args.gameId,
        creator: e.args.white,
        wager:   parseFloat(ethers.utils.formatEther(e.args.wager)).toString(),
        age:     formatAge(e.blockNumber),
      }))
      .reverse(); // newest first
  }

  function formatAge(blockNumber) {
    // Rough estimate: each Base block ~2s
    // We don't have exact timestamp without an extra RPC call, so show block distance
    return 'recent';
  }

  // ── Get Game Data ───────────────────────────────────────────────────────────
  async function getGame(gameId) {
    if (!contract) throw new Error("Contract not deployed yet");
    const [white, black, wager, active, started, createdAt, startedAt] =
      await contract.getGame(gameId);
    return { white, black, wager, active, started, createdAt, startedAt };
  }

  // ── Wallet Balance ──────────────────────────────────────────────────────────
  async function getBalance() {
    if (!provider || !account) return "0";
    const bal = await provider.getBalance(account);
    return parseFloat(ethers.utils.formatEther(bal)).toFixed(4);
  }

  function shortenAddress(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  function getTxLink(hash) {
    return `${CONFIG.CHAIN_EXPLORER}/tx/${hash}`;
  }

  return {
    connectWallet,
    createGame,
    joinGame,
    submitLoss,
    refundTimeout,
    getGame,
    getOpenGames,
    getBalance,
    shortenAddress,
    getTxLink,
    getAccount:  () => account,
    isConnected: () => !!account,
  };
})();

window.Web3Manager = Web3Manager;
