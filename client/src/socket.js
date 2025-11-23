import { io } from 'socket.io-client';

// Use environment variable if available, otherwise detect from window location
export const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const API_BASE = `${API_URL}/api`;

export const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
});

