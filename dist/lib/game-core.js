"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMultiplayerGame = createMultiplayerGame;
exports.handleSinglePlayer = handleSinglePlayer;
exports.handleMove = handleMove;
const chess_js_1 = require("chess.js");
const utils_1 = require("./utils");
const prisma_1 = require("./prisma");
async function createMultiplayerGame(state, player1, player2) {
    const board = new chess_js_1.Chess();
    const dbGame = await prisma_1.prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        },
    });
    const game = {
        player1,
        player2,
        board,
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id,
    };
    state.games.push(game);
    if (player1)
        (0, utils_1.safeSend)(player1, { type: 'init_game', payload: { color: 'white', fen: board.fen(), dbId: dbGame.id } });
    if (player2)
        (0, utils_1.safeSend)(player2, { type: 'init_game', payload: { color: 'black', fen: board.fen(), dbId: dbGame.id } });
}
function handleSinglePlayer(state, socket) {
    const board = new chess_js_1.Chess();
    const game = {
        player: socket,
        board,
        startTime: new Date(),
    };
    state.singlePlayerGames.push(game);
    (0, utils_1.safeSend)(socket, { type: 'init_game', payload: { color: 'white', fen: board.fen() } });
}
async function handleMove(state, socket, move) {
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const moveResult = game.board.move(move);
    if (!moveResult) {
        (0, utils_1.safeSend)(socket, { type: 'error', payload: { message: 'Invalid move' } });
        return;
    }
    game.moveCount++;
    await prisma_1.prisma.move.create({ data: {
            gameId: game.dbId,
            moveNum: game.moveCount,
            from: move.from,
            to: move.to,
            san: moveResult.san,
            fen: game.board.fen(),
        } });
    if (game.player1)
        (0, utils_1.safeSend)(game.player1, { type: 'move', payload: move });
    if (game.player2)
        (0, utils_1.safeSend)(game.player2, { type: 'move', payload: move });
    const over = (0, utils_1.checkGameOver)(game.board);
    if (over.isOver) {
        if (game.player1)
            (0, utils_1.safeSend)(game.player1, { type: 'game_over', payload: over });
        if (game.player2)
            (0, utils_1.safeSend)(game.player2, { type: 'game_over', payload: over });
        await prisma_1.prisma.game.update({ where: { id: game.dbId }, data: { status: 'COMPLETED' } });
        state.games = state.games.filter(g => g.dbId !== game.dbId);
    }
}
//# sourceMappingURL=game-core.js.map