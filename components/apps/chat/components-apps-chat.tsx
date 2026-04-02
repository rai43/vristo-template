'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IRootState } from '@/store';
import { resetAllUnread } from '@/store/chatNotificationSlice';
import { ChatMessage, useChatSocket } from '@/hooks/useChatSocket';
import { clearChatData, createChannel, deleteChannel, getChannelMessages, getChatUsers, getMyChannels, getOrCreateDm, updateChannel } from '@/lib/api/chat';
import { getCustomers } from '@/lib/api/clients';
import WhatsAppDialog from '@/components/apps/customers/whatsapp-dialog';

// ── Types ──────────────────────────────────────────────────────────────────
interface ChannelObj {
    _id: string;
    name: string;
    description?: string;
    icon: string;
    type: 'group' | 'dm' | 'whatsapp';
    members: string[];
    admins: string[];
    createdBy: string;
    isPrivate?: boolean;
    whatsappPhone?: string;
    whatsappContactName?: string;
    lastMessage?: { content: string; senderName: string; createdAt: string } | null;
}

interface TeamUser {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const isSameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '✅'];
const GROUP_ICONS = ['💬', '⚙️', '🚚', '💰', '📢', '🎯', '🏠', '📋', '🔧', '🎨', '📦', '🌟'];

function getBg(name: string) {
    const bgs = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-indigo-500'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return bgs[Math.abs(h) % bgs.length];
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
    return (
        <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full text-${size < 9 ? 'xs' : 'sm'} font-bold text-white ${getBg(name)}`}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

// ── Bubble ─────────────────────────────────────────────────────────────────
function Bubble({
    msg,
    isMine,
    userId,
    isGroup,
    onReact,
    onDelete,
    onReply,
}: {
    msg: ChatMessage;
    isMine: boolean;
    userId: string;
    isGroup: boolean;
    onReact: (_id: string, _emoji: string) => void;
    onDelete: (_id: string) => void;
    onReply: (_msg: ChatMessage) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    return (
        <div className={`group flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
            {!isMine && <Avatar name={msg.senderName} size={7} />}
            <div className={`flex max-w-[72%] flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && isGroup && <span className="px-1 text-[10px] font-semibold text-slate-400">{msg.senderName}</span>}
                {msg.replyTo && (
                    <div className={`mb-0.5 max-w-full rounded-lg border-l-2 border-primary/70 bg-slate-100 px-2.5 py-1 text-[10px] dark:bg-slate-800 ${isMine ? 'self-end' : 'self-start'}`}>
                        <span className="font-semibold text-primary">{(msg.replyTo as any).senderName}</span>
                        <span className="ml-1 line-clamp-1 text-slate-500">{(msg.replyTo as any).content}</span>
                    </div>
                )}
                <div className="relative">
                    <div
                        className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                            msg.deleted
                                ? 'bg-slate-100 italic text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                : isMine
                                  ? 'rounded-br-sm bg-primary text-white'
                                  : 'rounded-bl-sm border border-slate-100 bg-white text-slate-700 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                    >
                        {msg.content}
                    </div>
                    {!msg.deleted && (
                        <div className={`absolute -top-1 ${isMine ? 'right-full mr-1.5' : 'left-full ml-1.5'} hidden items-center gap-1 group-hover:flex`}>
                            <button
                                onClick={() => setShowPicker((v) => !v)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-md hover:bg-slate-50 dark:bg-slate-700"
                            >
                                😊
                            </button>
                            <button
                                onClick={() => onReply(msg)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-md hover:bg-slate-50 dark:bg-slate-700"
                                title="Répondre"
                            >
                                ↩
                            </button>
                            {isMine && (
                                <button
                                    onClick={() => onDelete(msg._id)}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] text-red-400 shadow-md hover:bg-red-50 dark:bg-slate-700"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                    {showPicker && (
                        <div
                            className={`absolute z-20 mt-1 flex gap-1 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${
                                isMine ? 'right-0' : 'left-0'
                            }`}
                        >
                            {EMOJIS.map((e) => (
                                <button
                                    key={e}
                                    onClick={() => {
                                        onReact(msg._id, e);
                                        setShowPicker(false);
                                    }}
                                    className="rounded-lg p-1 text-base leading-none hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {Object.entries(msg.reactions || {}).some(([, u]) => u.length > 0) && (
                    <div className={`flex flex-wrap gap-1 px-0.5 ${isMine ? 'justify-end' : ''}`}>
                        {Object.entries(msg.reactions)
                            .filter(([, u]) => u.length > 0)
                            .map(([emoji, users]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(msg._id, emoji)}
                                    className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                                        users.includes(userId) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800'
                                    }`}
                                >
                                    {emoji} <span>{users.length}</span>
                                </button>
                            ))}
                    </div>
                )}
                <span className={`px-1 text-[10px] text-slate-400 ${isMine ? 'text-right' : ''}`}>
                    {fmtTime(msg.createdAt)}
                    {isMine && msg.readBy.length > 1 && <span className="ml-1 text-[9px] text-primary">✓✓</span>}
                </span>
            </div>
        </div>
    );
}

// ── Create Group Modal ─────────────────────────────────────────────────────
function CreateGroupModal({ users, onClose, onCreate }: { users: TeamUser[]; onClose: () => void; onCreate: (data: any) => void }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [icon, setIcon] = useState('💬');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    const toggle = (id: string) => setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Nouveau groupe</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-wrap gap-1">
                            {GROUP_ICONS.map((ic) => (
                                <button
                                    key={ic}
                                    onClick={() => setIcon(ic)}
                                    className={`rounded-lg p-1.5 text-lg ${icon === ic ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom du groupe"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <div>
                        <p className="mb-2 text-xs font-semibold text-slate-400">Membres</p>
                        <div className="max-h-40 space-y-1 overflow-y-auto">
                            {users
                                .filter((u) => u.isActive)
                                .map((u) => (
                                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggle(u.id)} className="rounded text-primary" />
                                        <Avatar name={u.name} size={6} />
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                                        <span className="ml-auto text-[10px] text-slate-400">{u.role}</span>
                                    </label>
                                ))}
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        Annuler
                    </button>
                    <button
                        onClick={() => onCreate({ name, description: desc, icon, members: selectedMembers })}
                        disabled={!name.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
                    >
                        Créer
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Group Settings Panel ───────────────────────────────────────────────────
function GroupSettings({
    channel,
    users,
    userId,
    onClose,
    onUpdate,
    onDelete,
}: {
    channel: ChannelObj;
    users: TeamUser[];
    userId: string;
    onClose: () => void;
    onUpdate: (_data: any) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(channel.name);
    const [desc, setDesc] = useState(channel.description || '');
    const [icon, setIcon] = useState(channel.icon);
    const [members, setMembers] = useState<string[]>(channel.members || []);
    const [admins, setAdmins] = useState<string[]>(channel.admins || []);

    const isAdmin = (channel.admins || []).includes(userId) || channel.createdBy === userId;

    const toggleMember = (id: string) => {
        if (!isAdmin) return;
        if (members.includes(id)) {
            // Can't remove someone who is the last admin
            if (admins.includes(id) && admins.length <= 1) return;
            setMembers((prev) => prev.filter((m) => m !== id));
            setAdmins((prev) => prev.filter((a) => a !== id));
        } else {
            setMembers((prev) => [...prev, id]);
        }
    };

    const toggleAdmin = (id: string) => {
        if (!isAdmin) return;
        if (admins.includes(id)) {
            // Prevent removing the last admin
            if (admins.length <= 1) return;
            setAdmins((prev) => prev.filter((a) => a !== id));
        } else {
            setAdmins((prev) => [...prev, id]);
        }
    };

    // Validate before saving: must have at least 1 admin
    const canSave = name.trim().length > 0 && admins.length >= 1 && members.length >= 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Paramètres du groupe</h3>
                    {isAdmin && (
                        <button onClick={onDelete} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                            Supprimer
                        </button>
                    )}
                </div>
                {isAdmin ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                            {GROUP_ICONS.map((ic) => (
                                <button
                                    key={ic}
                                    onClick={() => setIcon(ic)}
                                    className={`rounded-lg p-1.5 text-lg ${icon === ic ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                        <input
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="Description"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                        <div>
                            <p className="mb-2 text-xs font-semibold text-slate-400">Membres & Admins</p>
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                                {users
                                    .filter((u) => u.isActive)
                                    .map((u) => {
                                        const isMember = members.includes(u.id);
                                        const isUserAdmin = admins.includes(u.id);
                                        const isLastAdmin = isUserAdmin && admins.length <= 1;
                                        return (
                                            <div key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <input
                                                    type="checkbox"
                                                    checked={isMember}
                                                    onChange={() => toggleMember(u.id)}
                                                    disabled={isLastAdmin}
                                                    className="rounded text-primary disabled:opacity-40"
                                                    title={isLastAdmin ? 'Impossible de retirer le dernier admin' : ''}
                                                />
                                                <Avatar name={u.name} size={6} />
                                                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                                                {isMember && (
                                                    <button
                                                        onClick={() => toggleAdmin(u.id)}
                                                        disabled={isLastAdmin}
                                                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                                            isUserAdmin
                                                                ? isLastAdmin
                                                                    ? 'cursor-not-allowed bg-primary/20 text-primary opacity-60'
                                                                    : 'bg-primary/20 text-primary'
                                                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                        }`}
                                                        title={isLastAdmin ? 'Le groupe doit avoir au moins un admin' : ''}
                                                    >
                                                        {isUserAdmin ? 'Admin' : 'Membre'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                            {admins.length <= 1 && <p className="mt-1.5 text-[10px] text-amber-500">⚠ Le groupe doit toujours avoir au moins un admin</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
                                Annuler
                            </button>
                            <button
                                onClick={() => onUpdate({ name, description: desc, icon, members, admins })}
                                disabled={!canSave}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{channel.icon}</span>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-white">{channel.name}</p>
                                {channel.description && <p className="text-sm text-slate-400">{channel.description}</p>}
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-semibold text-slate-400">Membres ({(channel.members || []).length})</p>
                            <div className="space-y-1">
                                {users
                                    .filter((u) => (channel.members || []).includes(u.id))
                                    .map((u) => (
                                        <div key={u.id} className="flex items-center gap-2 px-2 py-1">
                                            <Avatar name={u.name} size={6} />
                                            <span className="text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                                            {(channel.admins || []).includes(u.id) && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Admin</span>}
                                        </div>
                                    ))}
                            </div>
                        </div>
                        <button onClick={onClose} className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">
                            Fermer
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Chat Component ────────────────────────────────────────────────────
const ComponentsAppsChat = () => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const authState = useSelector((state: IRootState) => state.auth);
    const currentUser = authState.user;
    const userId = (currentUser as any)?.id || (currentUser as any)?._id || 'unknown';
    const userName = currentUser?.name || 'Utilisateur';
    const userRole = (currentUser as any)?.role || '';

    // Clear global unread count when entering the chat page
    useEffect(() => {
        dispatch(resetAllUnread());
    }, [dispatch]);

    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return authState.token || localStorage.getItem('ws_token');
    }, [authState.token]);

    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [showWaClientSearch, setShowWaClientSearch] = useState(false);
    const [waClientSearch, setWaClientSearch] = useState('');
    const [waClients, setWaClients] = useState<any[]>([]);
    const [waSearchLoading, setWaSearchLoading] = useState(false);
    const [waTarget, setWaTarget] = useState<{ name: string; phone: string; phones: any[] } | null>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const activeChannelRef = useRef<string | null>(null);

    // Keep ref in sync so socket callback sees latest
    useEffect(() => {
        activeChannelRef.current = activeChannelId;
    }, [activeChannelId]);

    // Clear unread when switching channels
    const handleSetActiveChannel = useCallback((chId: string) => {
        setActiveChannelId(chId);
        setUnreadCounts((prev) => {
            if (!prev[chId]) return prev;
            const next = { ...prev };
            delete next[chId];
            return next;
        });
    }, []);

    // Track unread for non-active channels within the chat page
    const handleNewMessage = useCallback(
        (msg: ChatMessage) => {
            const msgChId = msg.channelId || msg.channel;
            if (!msgChId || msg.senderId === userId) return;
            // Only increment for channels that are NOT currently active
            if (msgChId !== activeChannelRef.current) {
                setUnreadCounts((prev) => ({ ...prev, [msgChId]: (prev[msgChId] || 0) + 1 }));
            }
        },
        [userId],
    );

    const { connected, onlineUsers, messages, typingUsers, joinChannel, sendMessage, sendTyping, markRead, react, deleteMessage, loadHistory } = useChatSocket(token, handleNewMessage);

    // Request notification permission
    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Fetch channels & users
    const { data: channels = [], refetch: refetchChannels } = useQuery<ChannelObj[]>({
        queryKey: ['chat-channels'],
        queryFn: async () => {
            const raw = await getMyChannels();
            return (raw || []).map((ch: any) => ({ ...ch, members: ch.members || [], admins: ch.admins || [] }));
        },
        staleTime: 30_000,
        enabled: !!token,
    });
    const { data: teamUsers = [] } = useQuery<TeamUser[]>({
        queryKey: ['chat-users'],
        queryFn: getChatUsers,
        staleTime: 60_000,
        enabled: !!token,
    });

    const activeChannel = useMemo(() => channels.find((c) => c._id === activeChannelId) || null, [channels, activeChannelId]);
    const onlineSet = useMemo(() => new Set(onlineUsers.map((u) => u.id)), [onlineUsers]);

    // Sorted channels: groups first, then DMs, then WhatsApp
    const groups = useMemo(() => channels.filter((c) => c.type === 'group'), [channels]);
    const dms = useMemo(() => channels.filter((c) => c.type === 'dm'), [channels]);
    const waChannels = useMemo(() => channels.filter((c) => c.type === 'whatsapp'), [channels]);

    // Get DM partner name
    const dmPartnerName = useCallback(
        (ch: ChannelObj) => {
            const otherId = (ch.members || []).find((m) => m !== userId);
            const user = teamUsers.find((u) => u.id === otherId);
            return user?.name || ch.name.replace(` & ${userName}`, '').replace(`${userName} & `, '');
        },
        [teamUsers, userId, userName],
    );

    // Auto-select first channel
    useEffect(() => {
        if (!activeChannelId && channels.length > 0) {
            handleSetActiveChannel(channels[0]._id);
        }
    }, [channels, activeChannelId, handleSetActiveChannel]);

    // Search clients for WhatsApp conversations
    useEffect(() => {
        if (!showWaClientSearch) return;
        const timer = setTimeout(async () => {
            if (!waClientSearch.trim()) {
                setWaClients([]);
                return;
            }
            setWaSearchLoading(true);
            try {
                const res = await getCustomers({ q: waClientSearch, page: 1, limit: 10 });
                const clients = res?.data?.data || [];
                // Filter clients that have WhatsApp-capable phones
                const filtered = clients.filter((c: any) => (c.phones || []).some((p: any) => p.type === 'whatsapp' || p.type === 'both'));
                setWaClients(filtered);
            } catch {
                setWaClients([]);
            } finally {
                setWaSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [waClientSearch, showWaClientSearch]);

    // Load messages when channel changes
    useEffect(() => {
        if (!activeChannelId || !token) return;
        joinChannel(activeChannelId);
        getChannelMessages(activeChannelId)
            .then((msgs: ChatMessage[]) => loadHistory(msgs))
            .catch(() => loadHistory([]));
    }, [activeChannelId, token, joinChannel, loadHistory]);

    // Auto-scroll
    useEffect(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, [messages.length]);

    // Mark read
    useEffect(() => {
        if (!activeChannelId) return;
        const chId = activeChannelId;
        const unread = messages
            .filter((m) => {
                const mChId = m.channelId || m.channel;
                return mChId === chId && !m.readBy.includes(userId) && m.senderId !== userId;
            })
            .map((m) => m._id);
        if (unread.length) markRead(unread);
    }, [messages, activeChannelId, userId, markRead]);

    // Filtered messages
    const visible = useMemo(() => {
        if (!activeChannelId) return [];
        let filtered = messages.filter((m) => {
            const mChId = m.channelId || m.channel;
            return mChId === activeChannelId;
        });
        if (searchTerm.trim()) {
            filtered = filtered.filter((m) => m.content.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return filtered;
    }, [messages, activeChannelId, searchTerm]);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || !activeChannelId) return;
        sendMessage({ content: text, channelId: activeChannelId, replyTo: replyTo?._id });
        setInput('');
        setReplyTo(null);
        sendTyping(activeChannelId, false);
        inputRef.current?.focus();
    }, [input, activeChannelId, replyTo, sendMessage, sendTyping]);

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (v: string) => {
        setInput(v);
        if (activeChannelId) {
            sendTyping(activeChannelId, true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {
                if (activeChannelId) sendTyping(activeChannelId, false);
            }, 2000);
        }
    };

    const handleCreateGroup = async (data: any) => {
        await createChannel(data);
        setShowCreateGroup(false);
        refetchChannels();
    };

    const handleUpdateGroup = async (data: any) => {
        if (!activeChannelId) return;
        await updateChannel(activeChannelId, data);
        setShowGroupSettings(false);
        refetchChannels();
    };

    const handleDeleteGroup = async () => {
        if (!activeChannelId) return;
        if (!confirm('Supprimer ce groupe ?')) return;
        await deleteChannel(activeChannelId);
        setShowGroupSettings(false);
        setActiveChannelId(null);
        refetchChannels();
    };

    const handleClearChat = async () => {
        if (!confirm('Effacer toutes les conversations ? Cette action est irréversible.')) return;
        await clearChatData();
        setActiveChannelId(null);
        loadHistory([]);
        setUnreadCounts({});
        dispatch(resetAllUnread());
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        refetchChannels();
    };

    const handleStartDm = async (user: TeamUser) => {
        const ch = await getOrCreateDm(user.id, user.name);
        await refetchChannels();
        handleSetActiveChannel(ch._id);
        joinChannel(ch._id);
    };

    const typingNames = Object.keys(typingUsers)
        .map((tid) => onlineUsers.find((u) => u.id === tid)?.name)
        .filter(Boolean);

    if (!token) {
        return (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200/60 bg-white dark:border-slate-700/40 dark:bg-[#1a2234]">
                <div className="text-center">
                    <p className="text-2xl">🔒</p>
                    <p className="mt-2 text-sm font-medium text-slate-500">Reconnectez-vous pour accéder au chat</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-130px)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
            {/* ── Sidebar ─────────────────────────────────── */}
            <div className={`flex flex-col border-r border-slate-100 transition-all duration-200 dark:border-slate-700/40 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
                {/* User info */}
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-700/40">
                    <Avatar name={userName} size={9} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{userName}</p>
                        <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="text-[10px] text-slate-400">{connected ? `${onlineUsers.length} en ligne` : 'Connexion...'}</span>
                        </div>
                    </div>
                    {(userRole === 'super_admin' || userRole === 'admin') && (
                        <button
                            onClick={handleClearChat}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            title="Effacer toutes les conversations"
                        >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path
                                    fillRule="evenodd"
                                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                    {/* Groups */}
                    <div className="px-2">
                        <div className="mb-1.5 flex items-center justify-between px-2">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Groupes</p>
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700"
                                title="Nouveau groupe"
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                                </svg>
                            </button>
                        </div>
                        {groups.map((ch) => (
                            <button
                                key={ch._id}
                                onClick={() => handleSetActiveChannel(ch._id)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    activeChannelId === ch._id ? 'bg-primary/10 font-semibold text-primary' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <span className="text-base leading-none">{ch.icon}</span>
                                <span className="flex-1 truncate">{ch.name}</span>
                                {unreadCounts[ch._id] ? (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{unreadCounts[ch._id]}</span>
                                ) : (
                                    <span className="text-[10px] text-slate-400">{(ch.members || []).length}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* DMs */}
                    <div className="mt-4 px-2">
                        <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Messages directs</p>
                        {dms.map((ch) => {
                            const name = dmPartnerName(ch);
                            const otherId = (ch.members || []).find((m) => m !== userId);
                            const isOnline = otherId ? onlineSet.has(otherId) : false;
                            return (
                                <button
                                    key={ch._id}
                                    onClick={() => handleSetActiveChannel(ch._id)}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                        activeChannelId === ch._id ? 'bg-primary/10 font-semibold text-primary' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="relative">
                                        <Avatar name={name} size={6} />
                                        <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </div>
                                    <span className="flex-1 truncate">{name}</span>
                                    {unreadCounts[ch._id] ? (
                                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                                            {unreadCounts[ch._id]}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                        {/* Team members not yet in DM */}
                        {teamUsers.filter((u) => u.id !== userId && u.isActive && !dms.some((d) => (d.members || []).includes(u.id))).length > 0 && (
                            <>
                                <p className="mb-1 mt-3 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Démarrer un DM</p>
                                {teamUsers
                                    .filter((u) => u.id !== userId && u.isActive && !dms.some((d) => (d.members || []).includes(u.id)))
                                    .map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleStartDm(u)}
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        >
                                            <div className="relative">
                                                <Avatar name={u.name} size={6} />
                                                <div
                                                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${onlineSet.has(u.id) ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                />
                                            </div>
                                            <span className="truncate">{u.name}</span>
                                        </button>
                                    ))}
                            </>
                        )}
                    </div>

                    {/* WhatsApp */}
                    <div className="mt-4 px-2">
                        <div className="mb-1.5 flex items-center justify-between px-2">
                            <div className="flex items-center gap-1.5">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-emerald-500">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.215l-.297-.178-2.871.853.853-2.871-.178-.297A8 8 0 1112 20z" />
                                </svg>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">WhatsApp</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowWaClientSearch(true);
                                    setWaClientSearch('');
                                    setWaClients([]);
                                }}
                                className="rounded p-0.5 text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10"
                                title="Nouvelle conversation WhatsApp"
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                                </svg>
                            </button>
                        </div>

                        {/* Client search panel */}
                        {showWaClientSearch && (
                            <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={waClientSearch}
                                        onChange={(e) => setWaClientSearch(e.target.value)}
                                        placeholder="Rechercher un client…"
                                        autoFocus
                                        className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                    />
                                    <button onClick={() => setShowWaClientSearch(false)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                            <path
                                                fillRule="evenodd"
                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </div>
                                {waSearchLoading && <p className="mt-2 text-center text-[10px] text-slate-400">Recherche…</p>}
                                {!waSearchLoading && waClientSearch && waClients.length === 0 && <p className="mt-2 text-center text-[10px] text-slate-400">Aucun client trouvé</p>}
                                <div className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                                    {waClients.map((c: any) => {
                                        const waPhone = (c.phones || []).find((p: any) => p.type === 'whatsapp' || p.type === 'both');
                                        return (
                                            <button
                                                key={c._id}
                                                onClick={() => {
                                                    setWaTarget({
                                                        name: c.name,
                                                        phone: waPhone?.number || '',
                                                        phones: c.phones || [],
                                                    });
                                                    setShowWaClientSearch(false);
                                                }}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-emerald-100/60 dark:hover:bg-emerald-500/10"
                                            >
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                    {c.name
                                                        ?.split(' ')
                                                        .map((n: string) => n[0])
                                                        .join('')
                                                        .toUpperCase()
                                                        .slice(0, 2)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{c.name}</p>
                                                    <p className="truncate text-[10px] text-slate-400">{waPhone?.number}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {waChannels.length === 0 && !showWaClientSearch && <p className="px-3 py-2 text-[11px] italic text-slate-400">Aucune conversation</p>}
                        {waChannels.map((ch) => (
                            <button
                                key={ch._id}
                                onClick={() => handleSetActiveChannel(ch._id)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    activeChannelId === ch._id ? 'bg-emerald-500/10 font-semibold text-emerald-600' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <span className="text-base leading-none">📱</span>
                                <div className="min-w-0 flex-1">
                                    <span className="block truncate">{ch.whatsappContactName || ch.name}</span>
                                    <span className="block truncate text-[10px] text-slate-400">{ch.whatsappPhone}</span>
                                </div>
                                {unreadCounts[ch._id] ? (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                                        {unreadCounts[ch._id]}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main area ────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/40">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                                <path d="M3 12h18M3 6h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                        {activeChannel ? (
                            activeChannel.type === 'dm' ? (
                                <div className="flex items-center gap-2">
                                    <Avatar name={dmPartnerName(activeChannel)} size={8} />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{dmPartnerName(activeChannel)}</p>
                                        <p className="text-[10px] text-slate-400">Message direct</p>
                                    </div>
                                </div>
                            ) : activeChannel.type === 'whatsapp' ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.215l-.297-.178-2.871.853.853-2.871-.178-.297A8 8 0 1112 20z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{activeChannel.whatsappContactName || activeChannel.name}</p>
                                        <p className="text-[10px] text-emerald-500">WhatsApp · {activeChannel.whatsappPhone}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-xl leading-none">{activeChannel.icon}</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{activeChannel.name}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {activeChannel.members?.length ?? 0} membres · {visible.length} messages
                                        </p>
                                    </div>
                                </div>
                            )
                        ) : (
                            <p className="text-sm text-slate-400">Sélectionnez un salon</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher..."
                            className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-xs focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        />
                        {activeChannel?.type === 'group' && (
                            <button
                                onClick={() => setShowGroupSettings(true)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Paramètres"
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path
                                        fillRule="evenodd"
                                        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {!activeChannelId && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800">💬</div>
                            <p className="text-sm font-medium text-slate-500">Sélectionnez un salon ou démarrez une conversation</p>
                        </div>
                    )}
                    {activeChannelId && visible.length === 0 && !searchTerm && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800">{activeChannel?.icon || '💬'}</div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                {activeChannel?.type === 'whatsapp'
                                    ? `Conversation WhatsApp avec ${activeChannel.whatsappContactName || activeChannel.whatsappPhone}`
                                    : activeChannel?.type === 'dm'
                                      ? `Commencez une conversation avec ${dmPartnerName(activeChannel!)}`
                                      : `Bienvenue dans ${activeChannel?.name || ''}`}
                            </p>
                            <p className="text-xs text-slate-400">Envoyez le premier message !</p>
                        </div>
                    )}
                    {activeChannelId && visible.length === 0 && searchTerm && (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-slate-400">Aucun résultat pour &laquo;{searchTerm}&raquo;</p>
                        </div>
                    )}
                    <div className="space-y-3">
                        {visible.map((msg, i) => {
                            const prev = visible[i - 1];
                            const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
                            const isMine = msg.senderId === userId;
                            const isGroup = activeChannel?.type === 'group';
                            return (
                                <React.Fragment key={msg._id}>
                                    {showDate && (
                                        <div className="flex items-center gap-3 py-1">
                                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700/50" />
                                            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800">{fmtDay(msg.createdAt)}</span>
                                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700/50" />
                                        </div>
                                    )}
                                    <Bubble
                                        msg={msg}
                                        isMine={isMine}
                                        userId={userId}
                                        isGroup={isGroup ?? false}
                                        onReact={(id, emoji) => react(id, emoji, activeChannelId!)}
                                        onDelete={(id) => deleteMessage(id, activeChannelId!)}
                                        onReply={setReplyTo}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div ref={bottomRef} />
                </div>

                {/* Typing */}
                {typingNames.length > 0 && (
                    <div className="px-5 py-1 text-xs text-slate-400">
                        {typingNames.join(', ')} {typingNames.length === 1 ? 'écrit' : 'écrivent'}...
                        <span className="ml-1 animate-pulse">●●●</span>
                    </div>
                )}

                {/* Reply preview */}
                {replyTo && (
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-2 dark:border-slate-700/40 dark:bg-slate-800/20">
                        <div className="flex-1 rounded-lg border-l-2 border-primary/60 pl-2">
                            <span className="text-[11px] font-semibold text-primary">{replyTo.senderName}</span>
                            <span className="ml-1.5 line-clamp-1 text-[11px] text-slate-500">{replyTo.content}</span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="text-sm text-slate-400 hover:text-slate-600">
                            ✕
                        </button>
                    </div>
                )}

                {/* Input */}
                {activeChannelId && (
                    <div className="border-t border-slate-100 p-3 dark:border-slate-700/40">
                        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 transition-colors focus-within:border-primary dark:border-slate-600 dark:bg-slate-800/50">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => handleInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder={
                                    activeChannel?.type === 'whatsapp'
                                        ? `WhatsApp → ${activeChannel.whatsappContactName || activeChannel.whatsappPhone}…`
                                        : activeChannel?.type === 'dm'
                                          ? `Message à ${dmPartnerName(activeChannel!)}…`
                                          : `Message ${activeChannel?.name || ''}…`
                                }
                                rows={1}
                                className="flex-1 resize-none bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none dark:text-slate-200"
                                style={{ maxHeight: '120px', overflowY: 'auto' }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <p className="mt-1 text-center text-[10px] text-slate-400">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreateGroup && <CreateGroupModal users={teamUsers} onClose={() => setShowCreateGroup(false)} onCreate={handleCreateGroup} />}
            {showGroupSettings && activeChannel && activeChannel.type === 'group' && (
                <GroupSettings channel={activeChannel} users={teamUsers} userId={userId} onClose={() => setShowGroupSettings(false)} onUpdate={handleUpdateGroup} onDelete={handleDeleteGroup} />
            )}
            {waTarget && (
                <WhatsAppDialog
                    open={!!waTarget}
                    onClose={() => {
                        setWaTarget(null);
                        refetchChannels();
                    }}
                    clientName={waTarget.name}
                    phoneNumber={waTarget.phone}
                    phones={waTarget.phones}
                />
            )}
        </div>
    );
};

export default ComponentsAppsChat;
