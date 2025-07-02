"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUser = addUser;
exports.removeUser = removeUser;
exports.cleanupUserState = cleanupUserState;
function addUser(state, user) {
    state.users.push(user);
}
function removeUser(state, user) {
    state.users = state.users.filter(u => u !== user);
}
function cleanupUserState(state, user) {
    // Remove user from users
    removeUser(state, user);
    // Remove from pendingUser
    if (state.pendingUser === user) {
        state.pendingUser = null;
    }
    // Remove from games
    state.games = state.games.filter(g => g.player1 !== user && g.player2 !== user);
    // Remove from rooms
    for (const [roomId, room] of state.rooms.entries()) {
        if (room.player1 === user || room.player2 === user) {
            state.rooms.delete(roomId);
        }
    }
}
//# sourceMappingURL=users.js.map