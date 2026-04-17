# PixelChess

**Player vs Player chess wagering on Base Mainnet.**

Challenge a real opponent to a pixel chess match, stake ETH, and win 1.9× automatically via smart contract. No sign-up. No middleman. No trust required.

🌐 **[pixelchess.xyz](https://pixelchess.xyz)**

---

## Overview

PixelChess is a fully on-chain PvP chess game built on the Base network. Two players stake equal amounts of ETH into a smart contract, play chess peer-to-peer via WebRTC, and the winner receives 1.9× their wager automatically. Everything is settled on-chain — no server holds funds, no admin can interfere.

- **No house bankroll** — only player funds are at stake
- **No sign-up** — just connect a MetaMask wallet
- **No custody** — funds are locked in the contract until the game ends
- **Peer-to-peer gameplay** — moves are synced directly between players via PeerJS WebRTC
- **Fully on-chain settlement** — payouts happen automatically on Base

---

## How It Works

1. **Connect Wallet** — Connect MetaMask on Base network
2. **Select Wager** — Choose from 0.005, 0.01, 0.025, or 0.05 ETH
3. **Find Match** — Auto-matchmaking pairs you with a waiting opponent, or lists your game in the lobby
4. **Play Chess** — Moves sync peer-to-peer in real time via WebRTC
5. **Settlement** — Loser calls `submitLoss()` on the contract; winner receives 1.9× their wager instantly

### Wager & Payouts

| Wager | Win Amount | House Fee |
|-------|-----------|-----------|
| 0.005 ETH | 0.0095 ETH | 5% |
| 0.01 ETH | 0.019 ETH | 5% |
| 0.025 ETH | 0.0475 ETH | 5% |
| 0.05 ETH | 0.095 ETH | 5% |

---

## Smart Contract

- **Network:** Base Mainnet (Chain ID: 8453)
- **Contract:** [`0xCa16bb6c3cedA37C2f99eAfD661066621330E8d1`](https://basescan.org/address/0xCa16bb6c3cedA37C2f99eAfD661066621330E8d1#code)
- **Verified:** Source code verified on Basescan

### Contract Functions

| Function | Description |
|----------|-------------|
| `createGame()` | Creates a new game, locks wager in contract |
| `joinGame(gameId)` | Joins an existing game, matches the wager |
| `submitLoss(gameId)` | Loser calls this to trigger payout to winner |
| `refundTimeout(gameId)` | Refunds wager if no opponent joins within 30 minutes |
| `getGame(gameId)` | Returns game state (players, wager, status) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity, Hardhat |
| Blockchain | Base Mainnet (EVM) |
| Frontend | Vanilla HTML/CSS/JS |
| Wallet | ethers.js v5.7 |
| P2P Moves | PeerJS (WebRTC) |
| Deployment | Vercel |
| Chess Logic | chess.js |

---

## Project Structure

```
pixelchess/
├── contracts/
│   └── ChessWager.sol        # Smart contract
├── scripts/
│   └── deploy.js             # Hardhat deployment script
├── frontend/
│   ├── index.html            # Main app
│   ├── favicon.svg
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── config.js         # Chain + contract config
│       ├── web3.js           # ethers.js integration
│       ├── app.js            # App controller + matchmaking
│       ├── chess-board.js    # Board rendering
│       └── chess-engine.js   # Chess logic helpers
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## Local Development

### Prerequisites

- Node.js v18+
- MetaMask browser extension
- Base Mainnet ETH

### Setup

```bash
git clone https://github.com/playpixelchess11/pixelchess.git
cd pixelchess
npm install
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```
PRIVATE_KEY=your_wallet_private_key
BASESCAN_API_KEY=your_basescan_api_key
BASE_RPC_URL=https://mainnet.base.org
```

### Deploy Contract

```bash
npx hardhat run scripts/deploy.js --network base
```

### Run Frontend

Open `frontend/index.html` in a browser, or serve it locally:

```bash
npx serve frontend
```

---

## Security

- Private keys are never stored in this repository — loaded from `.env` only
- Smart contract is verified and publicly readable on Basescan
- No admin keys or upgrade mechanisms in the contract
- Player funds can only move to: winner address, or refunded to creator after timeout

---

## Links

- **App:** [pixelchess.xyz](https://pixelchess.xyz)
- **Contract:** [Basescan](https://basescan.org/address/0xCa16bb6c3cedA37C2f99eAfD661066621330E8d1#code)
- **Docs:** [GitBook](https://playpixelchess.gitbook.io/playpixelchess-docs/)
- **Twitter:** [@playpixelchess](https://twitter.com/playpixelchess)

---

## License

MIT
