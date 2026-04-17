// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChessWagerPvP — PIXELCHESS on Base Mainnet
/// @notice Player vs Player wagering. Loser calls submitLoss to pay winner.
contract ChessWagerPvP {
    address public owner;
    uint256 public constant MIN_BET = 0.005 ether;
    uint256 public constant MAX_BET = 0.05 ether;
    uint256 public houseFeeBps = 500; // 5%
    uint256 public nonce;

    uint256 public constant JOIN_TIMEOUT  = 30 minutes;
    uint256 public constant GAME_TIMEOUT  = 2 hours;

    struct Game {
        address white;
        address black;
        uint256 wager;
        bool    active;
        bool    started;
        uint256 createdAt;
        uint256 startedAt;
    }

    mapping(bytes32 => Game) private _games;

    event GameCreated(bytes32 indexed gameId, address indexed white, uint256 wager);
    event GameJoined (bytes32 indexed gameId, address indexed black);
    event GameEnded  (bytes32 indexed gameId, address indexed winner, uint256 payout);
    event GameRefunded(bytes32 indexed gameId, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() { owner = msg.sender; }

    // ─── Player Actions ────────────────────────────────────────────────────────

    /// Creator deposits wager and opens a game slot.
    function createGame() external payable returns (bytes32 gameId) {
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "Wager out of range");
        gameId = keccak256(abi.encodePacked(msg.sender, block.timestamp, nonce++));
        _games[gameId] = Game({
            white:     msg.sender,
            black:     address(0),
            wager:     msg.value,
            active:    true,
            started:   false,
            createdAt: block.timestamp,
            startedAt: 0
        });
        emit GameCreated(gameId, msg.sender, msg.value);
    }

    /// Opponent deposits matching wager to start the game.
    function joinGame(bytes32 gameId) external payable {
        Game storage g = _games[gameId];
        require(g.active && !g.started, "Game not open");
        require(g.white != msg.sender,  "Cannot join own game");
        require(msg.value == g.wager,   "Must match exact wager");
        require(block.timestamp <= g.createdAt + JOIN_TIMEOUT, "Join timeout expired");
        g.black     = msg.sender;
        g.started   = true;
        g.startedAt = block.timestamp;
        emit GameJoined(gameId, msg.sender);
    }

    /// Loser calls this — winner receives pot minus house fee.
    function submitLoss(bytes32 gameId) external {
        Game storage g = _games[gameId];
        require(g.active && g.started,  "Game not active");
        require(msg.sender == g.white || msg.sender == g.black, "Not a player");
        address winner  = msg.sender == g.white ? g.black : g.white;
        uint256 pot     = g.wager * 2;
        uint256 fee     = (pot * houseFeeBps) / 10000;
        uint256 payout  = pot - fee;
        g.active = false;
        (bool ok,) = payable(winner).call{value: payout}("");
        require(ok, "Transfer failed");
        emit GameEnded(gameId, winner, payout);
    }

    /// Refund when no one joins (after 30 min) or game stalls (after 2 hrs).
    function refundTimeout(bytes32 gameId) external {
        Game storage g = _games[gameId];
        require(g.active, "Not active");
        require(
            msg.sender == g.white || msg.sender == g.black || msg.sender == owner,
            "Not authorized"
        );
        if (!g.started) {
            require(
                block.timestamp > g.createdAt + JOIN_TIMEOUT || msg.sender == owner,
                "Join timeout not reached"
            );
            uint256 amount = g.wager;
            g.active = false;
            (bool ok,) = payable(g.white).call{value: amount}("");
            require(ok, "Refund failed");
            emit GameRefunded(gameId, amount);
        } else {
            require(
                block.timestamp > g.startedAt + GAME_TIMEOUT || msg.sender == owner,
                "Game timeout not reached"
            );
            uint256 w     = g.wager;
            address white = g.white;
            address black = g.black;
            g.active = false;
            (bool ok1,) = payable(white).call{value: w}("");
            (bool ok2,) = payable(black).call{value: w}("");
            require(ok1 && ok2, "Refund failed");
            emit GameRefunded(gameId, w * 2);
        }
    }

    // ─── View ──────────────────────────────────────────────────────────────────

    function getGame(bytes32 gameId) external view returns (
        address white, address black, uint256 wager,
        bool active, bool started, uint256 createdAt, uint256 startedAt
    ) {
        Game storage g = _games[gameId];
        return (g.white, g.black, g.wager, g.active, g.started, g.createdAt, g.startedAt);
    }

    // ─── Owner ─────────────────────────────────────────────────────────────────

    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance);
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok);
    }

    function setHouseFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Max 10%");
        houseFeeBps = bps;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0));
        owner = newOwner;
    }

    receive() external payable {}
}
