"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.safeSend = safeSend;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const ws_1 = __importDefault(require("ws"));
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
// Safe WebSocket send utility for ws.WebSocket
function safeSend(socket, message) {
    if (socket.readyState === ws_1.default.OPEN) {
        try {
            socket.send(JSON.stringify(message));
            return true;
        }
        catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }
    return false;
}
//# sourceMappingURL=utils.js.map