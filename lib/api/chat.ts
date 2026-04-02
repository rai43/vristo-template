import { api } from '@/lib/api';

function chatGet(path: string, params?: Record<string, unknown>) {
    return api.client.get(path, params ? { params } : undefined).then((r) => r.data);
}

function chatPost(path: string, data?: unknown) {
    return api.client.post(path, data).then((r) => r.data);
}

function chatPatch(path: string, data?: unknown) {
    return api.client.patch(path, data).then((r) => r.data);
}

function chatDelete(path: string) {
    return api.client.delete(path).then((r) => r.data);
}

// ── Channels ──────────────────────────────────────────
export const getMyChannels = () => chatGet('/chat/channels');

export const createChannel = (data: { name: string; description?: string; icon?: string; members: string[]; admins?: string[]; isPrivate?: boolean }) => chatPost('/chat/channels', data);

export const updateChannel = (
    id: string,
    data: {
        name?: string;
        description?: string;
        icon?: string;
        members?: string[];
        admins?: string[];
        isPrivate?: boolean;
    },
) => chatPatch(`/chat/channels/${id}`, data);

export const deleteChannel = (id: string) => chatDelete(`/chat/channels/${id}`);

export const addChannelMembers = (id: string, memberIds: string[]) => chatPost(`/chat/channels/${id}/members`, { memberIds });

export const removeChannelMembers = (id: string, _memberIds: string[]) => chatDelete(`/chat/channels/${id}/members`);

// ── DM ────────────────────────────────────────────────
export const getOrCreateDm = (userId: string, userName: string) => chatPost('/chat/dm', { userId, userName });

// ── Messages ──────────────────────────────────────────
export const getChannelMessages = (channelId: string, before?: string, limit = 50) =>
    chatGet(`/chat/channels/${channelId}/messages`, {
        before,
        limit,
    });

// Legacy endpoints (backward compat)
export const getChatMessages = (channel: string, before?: string, limit = 50) =>
    chatGet('/chat/messages', {
        channel,
        before,
        limit,
    });

export const getDmMessages = (recipientId: string, before?: string, limit = 50) =>
    chatGet('/chat/messages', {
        recipientId,
        before,
        limit,
    });

export const getChatChannels = () => chatGet('/chat/channels');

export const getChatUnread = (channelId: string) => chatGet('/chat/unread', { channelId });

// ── Users ─────────────────────────────────────────────
export const getChatUsers = () => chatGet('/chat/users');

// ── Admin ─────────────────────────────────────────────
export const clearChatData = () => chatDelete('/chat/clear-all');

// ── WhatsApp ──────────────────────────────────────────
export const getWhatsAppChannels = () => chatGet('/chat/whatsapp-channels');

// ── Admin ─────────────────────────────────────────────
export const clearAllChat = () => chatDelete('/chat/clear-all');
