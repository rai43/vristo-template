'use client';
import { useEffect, useRef } from 'react';
import { clientPortalApi } from '@/lib/api/client-portal';

/**
 * Registers the client portal service worker, fetches VAPID key,
 * subscribes to push notifications and sends the subscription to the backend.
 */
export function useClientPushNotifications() {
    const registered = useRef(false);

    useEffect(() => {
        if (registered.current) return;
        registered.current = true;

        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const setup = async () => {
            try {
                // Register service worker
                const reg = await navigator.serviceWorker.register('/sw-client.js', { scope: '/portal/' });

                // Request notification permission (soft — don't block)
                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                if (Notification.permission !== 'granted') return;

                // Fetch VAPID public key from the API
                let vapidKey: string | null = null;
                try {
                    vapidKey = await clientPortalApi.getVapidPublicKey();
                } catch {
                    console.warn('[Mirai Push] Could not fetch VAPID key');
                    return;
                }

                if (!vapidKey) {
                    console.log('[Mirai Push] VAPID key not configured on server');
                    return;
                }

                // Convert VAPID key from base64url to Uint8Array
                const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
                    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                    }
                    return outputArray;
                };

                // Check if we already have a subscription
                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey),
                    });
                    console.log('[Mirai Push] New subscription created');
                }

                // Send subscription to backend
                const subJSON = sub.toJSON();
                if (subJSON.endpoint && subJSON.keys) {
                    await clientPortalApi.pushSubscribe({
                        endpoint: subJSON.endpoint,
                        keys: {
                            p256dh: subJSON.keys.p256dh as string,
                            auth: subJSON.keys.auth as string,
                        },
                    });
                    console.log('[Mirai Push] Subscription sent to server');
                }
            } catch (err) {
                console.warn('[Mirai Push] Setup failed:', err);
            }
        };

        // Delay to not interfere with page load
        setTimeout(setup, 3000);
    }, []);
}
