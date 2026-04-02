import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import { AuthState, LoginCredentials, User } from '@/types/auth';

const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // Start as true to prevent redirects before session restoration
    error: null,
};

// Async thunk for user login
export const loginUser = createAsyncThunk('auth/loginUser', async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
        const response = await api.login(credentials.email, credentials.password);

        if (!response.ok) {
            return rejectWithValue('Invalid credentials');
        }

        const userData: User = {
            email: response.email,
            name: response.name,
            role: (response.role as any) || 'operator',
            id: (response as any).id,
        };

        // Store auth state in localStorage for persistence
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        // Store token for WebSocket use
        const wsToken = response.access_token ?? '';
        if (wsToken) localStorage.setItem('ws_token', wsToken);

        return { user: userData, token: wsToken || null };
    } catch (error: any) {
        const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
        return rejectWithValue(message);
    }
});

// Async thunk for user logout
export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { rejectWithValue }) => {
    try {
        await api.logout();

        // Clear localStorage
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('ws_token');

        return true;
    } catch (error: any) {
        const message = error.response?.data?.message || 'Logout failed';
        return rejectWithValue(message);
    }
});

// Async thunk for getting current user (session check)
export const getCurrentUser = createAsyncThunk('auth/getCurrentUser', async (_, { rejectWithValue }) => {
    try {
        const response = await api.getMe();

        if (!response.ok) {
            return rejectWithValue('Session expired');
        }

        const userData: User = {
            email: response.email,
            name: response.name,
            role: (response as any).role || 'operator',
            id: (response as any).id,
        };

        return userData;
    } catch (error: any) {
        // Clear localStorage on error
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');

        const message = error.response?.data?.message || 'Session validation failed';
        return rejectWithValue(message);
    }
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        // Manual logout (without API call)
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.error = null;
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('user');
            localStorage.removeItem('ws_token');
        },
        // Restore session from localStorage
        restoreSession: (state) => {
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userString = localStorage.getItem('user');
            const wsToken = localStorage.getItem('ws_token');

            if (isAuthenticated === 'true' && userString) {
                try {
                    state.user = JSON.parse(userString);
                    state.isAuthenticated = true;
                    state.token = wsToken || null;
                } catch {
                    // Invalid JSON, clear state
                    state.user = null;
                    state.isAuthenticated = false;
                    localStorage.removeItem('isAuthenticated');
                    localStorage.removeItem('user');
                }
            }
            state.isLoading = false; // Set loading to false after restoration
        },
    },
    extraReducers: (builder) => {
        // Login User
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action: PayloadAction<any>) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user ?? action.payload;
                state.token = action.payload.token ?? null;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.error = action.payload as string;
            });

        // Logout User
        builder
            .addCase(logoutUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = null;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.isLoading = false;
                // Still clear auth state even if logout API fails
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = action.payload as string;
            });

        // Get Current User
        builder
            .addCase(getCurrentUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(getCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload;
                state.error = null;
                // Update localStorage with fresh user data (includes id)
                localStorage.setItem('user', JSON.stringify(action.payload));
                localStorage.setItem('isAuthenticated', 'true');
            })
            .addCase(getCurrentUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, logout, restoreSession } = authSlice.actions;
export default authSlice.reducer;
