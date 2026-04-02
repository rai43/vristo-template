import { api } from '@/lib/api';

/**
 * Send a WhatsApp message AND persist it to chat history.
 * Returns { success, channelId, messageId, channel }
 */
export const sendWhatsAppMessage = (phone: string, message: string, contactName?: string) => api.client.post('/chat/whatsapp-send', { phone, message, contactName }).then((r) => r.data);

/**
 * Get messages for a WhatsApp channel (uses standard chat messages endpoint)
 */
export const getWhatsAppMessages = (channelId: string) => api.client.get(`/chat/channels/${channelId}/messages`).then((r) => r.data);
