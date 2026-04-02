'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Socket = Record<string, any> & {
    on: (..._a: any[]) => void;
    off: (..._a: any[]) => void;
    emit: (..._a: any[]) => void;
    disconnect: () => void;
};

let ioFn: ((..._args: unknown[]) => Socket) | null = null;

async function getIo() {
    if (!ioFn) {
        const mod = await import('socket.io-client' as never);
        ioFn = ((mod as any).io ?? (mod as any).default) as typeof ioFn;
    }
    return ioFn!;
}

export interface ChatMessage {
    _id: string;
    content: string;
    senderId: string;
    senderName: string;
    channelId?: string;
    channel?: string;
    recipientId?: string;
    type: string;
    replyTo?: { _id: string; content: string; senderName: string } | null;
    readBy: string[];
    reactions: Record<string, string[]>;
    deleted: boolean;
    createdAt: string;
}

export interface OnlineUser {
    id: string;
    name: string;
    role: string;
    socketId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export function useChatSocket(token: string | null, onNewMessage?: (_msg: ChatMessage) => void) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
    const onNewMsgRef = useRef(onNewMessage);
    onNewMsgRef.current = onNewMessage;
    useEffect(() => {
        if (!token) return;
        let cancelled = false;

        getIo().then((io) => {
            if (cancelled) return;
            const socket = (io as (..._args: unknown[]) => Socket)(`${API_URL}/chat`, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socketRef.current = socket;

            socket.on('connect', () => setConnected(true));
            socket.on('disconnect', () => setConnected(false));
            socket.on('online_users', (users: OnlineUser[]) => setOnlineUsers(users));

            socket.on('new_message', (msg: ChatMessage) => {
                setMessages((prev) => {
                    if (prev.find((m) => m._id === msg._id)) return prev;
                    return [...prev, msg];
                });
                onNewMsgRef.current?.(msg);
            });

            socket.on('message_updated', (msg: ChatMessage) => {
                setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
            });

            socket.on('message_deleted', ({ messageId }: { messageId: string }) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === messageId
                            ? {
                                  ...m,
                                  deleted: true,
                                  content: 'Message supprimé',
                              }
                            : m,
                    ),
                );
            });

            socket.on('user_typing', ({ userId, isTyping }: { userId: string; name: string; isTyping: boolean }) => {
                setTypingUsers((prev) => {
                    if (isTyping) return { ...prev, [userId]: true };
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            });
        });

        return () => {
            cancelled = true;
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    const joinChannel = useCallback((channelId: string) => {
        socketRef.current?.emit('join_channel', { channelId });
    }, []);

    const sendMessage = useCallback((data: { content: string; channelId: string; type?: string; replyTo?: string }) => {
        socketRef.current?.emit('send_message', data);
    }, []);

    const sendTyping = useCallback((channelId: string, isTyping: boolean) => {
        socketRef.current?.emit('typing', { channelId, isTyping });
    }, []);

    const markRead = useCallback((messageIds: string[]) => {
        socketRef.current?.emit('mark_read', { messageIds });
    }, []);

    const react = useCallback((messageId: string, emoji: string, channelId: string) => {
        socketRef.current?.emit('react', { messageId, emoji, channelId });
    }, []);

    const deleteMessage = useCallback((messageId: string, channelId: string) => {
        socketRef.current?.emit('delete_message', { messageId, channelId });
    }, []);

    const loadHistory = useCallback((msgs: ChatMessage[]) => {
        setMessages(msgs);
    }, []);

    return {
        connected,
        onlineUsers,
        messages,
        typingUsers,
        joinChannel,
        sendMessage,
        sendTyping,
        markRead,
        react,
        deleteMessage,
        loadHistory,
    };
}
