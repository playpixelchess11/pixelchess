// ─── CHESS BOARD RENDERER ────────────────────────────────────────────────────

const ChessBoard = (() => {
  const PIECE_SYMBOLS = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };

  let selectedSquare = null;
  let validMoves = [];
  let lastMove = null;
  let playerColor = "w";
  let onMoveCallback = null;
  let game = null;

  function init(chessGame, color, onMove) {
    game = chessGame;
    playerColor = color;
    onMoveCallback = onMove;
    render();
  }

  function setGame(chessGame) {
    game = chessGame;
  }

  function setLastMove(from, to) {
    lastMove = { from, to };
  }

  function render() {
    const boardEl = document.getElementById("chessboard");
    if (!boardEl) return;

    boardEl.innerHTML = "";
    const board = game.board();

    // Flip board if player is black
    const ranks = playerColor === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const files = playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    for (const r of ranks) {
      for (const c of files) {
        const square = String.fromCharCode(97 + c) + (r + 1);
        const isLight = (r + c) % 2 !== 0;
        const piece = board[7 - r][c];

        const cell = document.createElement("div");
        cell.className = "square " + (isLight ? "light" : "dark");
        cell.dataset.square = square;

        // Highlight classes
        if (selectedSquare === square) cell.classList.add("selected");
        if (validMoves.includes(square)) cell.classList.add("valid-move");
        if (lastMove && (lastMove.from === square || lastMove.to === square)) {
          cell.classList.add("last-move");
        }
        if (game.inCheck()) {
          // Highlight king in check
          if (piece && piece.type === "k" && piece.color === game.turn()) {
            cell.classList.add("in-check");
          }
        }

        // Valid move dot
        if (validMoves.includes(square)) {
          const dot = document.createElement("div");
          dot.className = piece ? "capture-ring" : "move-dot";
          cell.appendChild(dot);
        }

        // Piece
        if (piece) {
          const pieceEl = document.createElement("div");
          pieceEl.className = `piece ${piece.color === "w" ? "piece-white" : "piece-black"}`;
          pieceEl.textContent = PIECE_SYMBOLS[piece.color][piece.type];
          pieceEl.dataset.square = square;
          cell.appendChild(pieceEl);

          // Drag
          if (piece.color === playerColor && game.turn() === playerColor) {
            pieceEl.draggable = true;
            pieceEl.addEventListener("dragstart", (e) => handleDragStart(e, square));
          }
        }

        // Click handler
        cell.addEventListener("click", () => handleClick(square));
        cell.addEventListener("dragover", (e) => e.preventDefault());
        cell.addEventListener("drop", (e) => handleDrop(e, square));

        boardEl.appendChild(cell);
      }
    }
  }

  function handleClick(square) {
    if (game.turn() !== playerColor) return; // not player's turn

    const board = game.board();
    const rank = parseInt(square[1]) - 1;
    const file = square.charCodeAt(0) - 97;
    const piece = board[7 - rank][file];

    if (selectedSquare === null) {
      if (piece && piece.color === playerColor) {
        selectedSquare = square;
        validMoves = game.moves({ square, verbose: true }).map((m) => m.to);
        render();
      }
    } else {
      if (square === selectedSquare) {
        // Deselect
        selectedSquare = null;
        validMoves = [];
        render();
        return;
      }

      if (piece && piece.color === playerColor) {
        // Select different piece
        selectedSquare = square;
        validMoves = game.moves({ square, verbose: true }).map((m) => m.to);
        render();
        return;
      }

      // Try to make move
      attemptMove(selectedSquare, square);
    }
  }

  function handleDragStart(e, square) {
    selectedSquare = square;
    validMoves = game.moves({ square, verbose: true }).map((m) => m.to);
    render();
    e.dataTransfer.setData("text/plain", square);
  }

  function handleDrop(e, toSquare) {
    e.preventDefault();
    const fromSquare = e.dataTransfer.getData("text/plain");
    if (fromSquare) attemptMove(fromSquare, toSquare);
  }

  function attemptMove(from, to) {
    // Handle pawn promotion — always promote to queen for simplicity
    const moveObj = { from, to, promotion: "q" };
    const result = game.move(moveObj);

    if (result) {
      selectedSquare = null;
      validMoves = [];
      lastMove = { from, to };
      render();
      if (onMoveCallback) onMoveCallback(result);
    } else {
      // Invalid move — deselect
      selectedSquare = null;
      validMoves = [];
      render();
    }
  }

  function setPlayerColor(color) {
    playerColor = color;
    selectedSquare = null;
    validMoves = [];
    lastMove = null;
    render();
  }

  function animateMove(from, to) {
    lastMove = { from, to };
    render();
  }

  function reset() {
    selectedSquare = null;
    validMoves = [];
    lastMove = null;
    render();
  }

  return { init, render, setGame, setPlayerColor, animateMove, reset, setLastMove };
})();

window.ChessBoard = ChessBoard;
