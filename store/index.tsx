import { combineReducers, configureStore } from '@reduxjs/toolkit';
import themeConfigSlice from '@/store/themeConfigSlice';
import authSlice from '@/store/authSlice';
import chatNotificationSlice from '@/store/chatNotificationSlice';

const rootReducer = combineReducers({
    themeConfig: themeConfigSlice,
    chatNotification: chatNotificationSlice,
    auth: authSlice,
});

export default configureStore({
    reducer: rootReducer,
});

export type IRootState = ReturnType<typeof rootReducer>;
