"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.leaveRoom = leaveRoom;
function createRoom(state, user) {
    const room = {
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        player1: user,
        player2: undefined,
        game: undefined,
    };
    state.rooms.set(room.id, room);
    return room;
}
function joinRoom(state, roomId, user) {
    const room = state.rooms.get(roomId);
    if (!room)
        return false;
    if (!room.player2) {
        room.player2 = user;
        return true;
    }
    return false;
}
function leaveRoom(state, roomId, user) {
    const room = state.rooms.get(roomId);
    if (!room)
        return;
    if (room.player1 === user) {
        state.rooms.delete(roomId);
        return;
    }
    if (room.player2 === user)
        room.player2 = undefined;
}
//# sourceMappingURL=rooms.js.map