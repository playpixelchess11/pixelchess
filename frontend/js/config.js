// ─── PIXELCHESS CONFIG ───────────────────────────────────────────────────────
// Update CONTRACT_ADDRESS after deployment!

const CONFIG = {
  // ── Contract ──────────────────────────────────────
  CONTRACT_ADDRESS: "0xCa16bb6c3cedA37C2f99eAfD661066621330E8d1",
  CHAIN_ID: 8453,
  CHAIN_NAME: "Base",
  CHAIN_RPC: "https://mainnet.base.org",
  CHAIN_EXPLORER: "https://basescan.org",
  CHAIN_CURRENCY: { name: "Ethereum", symbol: "ETH", decimals: 18 },

  // ── Wager Options (ETH) — min $10, max $100 ───────
  WAGER_OPTIONS: [0.005, 0.01, 0.025, 0.05],
  DEFAULT_WAGER: 0.005,

  // ── Timeouts ──────────────────────────────────────
  JOIN_TIMEOUT_MINUTES: 30,
  GAME_TIMEOUT_HOURS: 2,

  // ── Payout ────────────────────────────────────────
  HOUSE_FEE_BPS: 500,    // 5%
  WIN_MULTIPLIER: 1.9,   // 2x - 5% fee
};

window.CONFIG = CONFIG;
