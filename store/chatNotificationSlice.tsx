import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChatNotificationState {
    /** Total unread message count across all channels */
    totalUnread: number;
    /** Unread counts per channel */
    unreadByChannel: Record<string, number>;
}

const initialState: ChatNotificationState = {
    totalUnread: 0,
    unreadByChannel: {},
};

const chatNotificationSlice = createSlice({
    name: 'chatNotification',
    initialState,
    reducers: {
        incrementUnread(state, action: PayloadAction<{ channelId: string }>) {
            const { channelId } = action.payload;
            state.unreadByChannel[channelId] = (state.unreadByChannel[channelId] || 0) + 1;
            state.totalUnread = Object.values(state.unreadByChannel).reduce((a, b) => a + b, 0);
        },
        clearChannelUnread(state, action: PayloadAction<{ channelId: string }>) {
            const { channelId } = action.payload;
            delete state.unreadByChannel[channelId];
            state.totalUnread = Object.values(state.unreadByChannel).reduce((a, b) => a + b, 0);
        },
        resetAllUnread(state) {
            state.totalUnread = 0;
            state.unreadByChannel = {};
        },
    },
});

export const { incrementUnread, clearChannelUnread, resetAllUnread } = chatNotificationSlice.actions;
export default chatNotificationSlice.reducer;
