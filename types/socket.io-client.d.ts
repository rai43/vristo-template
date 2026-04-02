// Minimal type declarations for socket.io-client
// Full types are available in node_modules after npm install inside Docker
declare module 'socket.io-client' {
    export interface SocketOptions {
        auth?: Record<string, any>;
        transports?: string[];
        reconnectionAttempts?: number;
        reconnectionDelay?: number;

        [key: string]: any;
    }

    export interface Socket {
        id: string;
        connected: boolean;
        disconnected: boolean;

        on(event: string, callback: (...args: any[]) => void): this;

        off(event: string, callback?: (...args: any[]) => void): this;

        emit(event: string, ...args: any[]): this;

        disconnect(): this;

        connect(): this;
    }

    export function io(url: string, opts?: SocketOptions): Socket;

    export { Socket as default };
}
