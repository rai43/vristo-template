'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname } from 'next/navigation';
import { IRootState } from '@/store';
import { incrementUnread } from '@/store/chatNotificationSlice';

type Socket = Record<string, any> & {
    on: (..._a: any[]) => void;
    off: (..._a: any[]) => void;
    emit: (..._a: any[]) => void;
    disconnect: () => void;
    connected: boolean;
};

let ioFn: ((..._args: unknown[]) => Socket) | null = null;

async function getIo() {
    if (!ioFn) {
        const mod = await import('socket.io-client' as never);
        ioFn = ((mod as any).io ?? (mod as any).default) as typeof ioFn;
    }
    return ioFn!;
}

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * Global chat notification listener.
 * Maintains a single persistent socket connection for notifications.
 * Uses refs so the socket is NOT torn down on page navigation.
 */
const ChatNotificationListener = () => {
    const dispatch = useDispatch();
    const pathname = usePathname();
    const authState = useSelector((state: IRootState) => state.auth);
    const userId = (authState.user as any)?.id || (authState.user as any)?._id;
    const socketRef = useRef<Socket | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

    const isOnChatPage = pathname?.startsWith('/apps/chat') ?? false;

    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return authState.token || localStorage.getItem('ws_token');
    }, [authState.token]);

    // Request notification permission on mount
    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setNotificationPermission(Notification.permission);
            if (Notification.permission === 'default') {
                Notification.requestPermission().then((permission) => {
                    setNotificationPermission(permission);
                });
            }
        }
    }, []);

    // Connect socket ONLY when NOT on the chat page (chat component has its own socket)
    useEffect(() => {
        if (!token || !userId || isOnChatPage) {
            // Disconnect if we were connected and navigated to chat
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        // Already connected with same token, don't reconnect
        if (socketRef.current?.connected) {
            return;
        }

        let cancelled = false;

        getIo().then((io) => {
            if (cancelled) return;

            const socket = (io as (..._args: unknown[]) => Socket)(`${API_URL}/chat`, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay: 3000,
                timeout: 10000,
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('[ChatNotification] Socket connected');
            });

            socket.on('connect_error', (err: Error) => {
                console.warn('[ChatNotification] Socket connection error:', err.message);
            });

            socket.on('new_message', (msg: any) => {
                // Don't notify for own messages
                if (msg.senderId === userId) return;

                const channelId = msg.channelId || msg.channel || '';
                dispatch(incrementUnread({ channelId }));

                // Browser notification
                if (notificationPermission === 'granted') {
                    try {
                        const notification = new Notification(`💬 ${msg.senderName || 'Nouveau message'}`, {
                            body: (msg.content || '').slice(0, 100),
                            icon: '/mirai-logo.png',
                            tag: `chat-${msg._id}`,
                            silent: false,
                        });

                        // Auto-close after 5 seconds
                        setTimeout(() => notification.close(), 5000);

                        // Click to focus
                        notification.onclick = () => {
                            window.focus();
                            notification.close();
                        };
                    } catch (e) {
                        console.warn('[ChatNotification] Failed to show notification:', e);
                    }
                }

                // Also play a sound (optional)
                try {
                    const audio = new Audio('/assets/audio/notification.mp3');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                } catch {
                    // Audio not available
                }
            });
        });

        return () => {
            cancelled = true;
        };
    }, [token, userId, isOnChatPage, dispatch, notificationPermission]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, []);

    return null;
};

export default ChatNotificationListener;
