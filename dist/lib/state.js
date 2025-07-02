"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameState = createGameState;
function createGameState() {
    return {
        games: [],
        singlePlayerGames: [],
        pendingUser: null,
        users: [],
        rooms: new Map(),
        videoCalls: new Map()
    };
}
//# sourceMappingURL=state.js.map