'use client';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import IconX from '@/components/icon/icon-x';
import { getWhatsAppMessages, sendWhatsAppMessage } from '@/lib/api/whatsapp';
import { getWhatsAppChannels } from '@/lib/api/chat';
import Swal from 'sweetalert2';

interface PhoneOption {
    number: string;
    type: 'whatsapp' | 'call' | 'both';
}

interface Props {
    open: boolean;
    onClose: () => void;
    clientName: string;
    phoneNumber: string;
    /** All WhatsApp-capable phones for this client */
    phones?: PhoneOption[];
}

interface ChatMsg {
    _id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
}

const QUICK_MESSAGES = [
    '👋 Bonjour {name}, comment allez-vous ?',
    '📦 Votre commande est prête pour la livraison.',
    '💰 Rappel : un paiement est en attente.',
    '🧺 Votre linge est prêt ! Quand souhaitez-vous la livraison ?',
    '📅 Rappel : récupération prévue demain.',
];

const WhatsAppDialog = ({ open, onClose, clientName, phoneNumber, phones }: Props) => {
    const [selectedPhone, setSelectedPhone] = useState(phoneNumber);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState<ChatMsg[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [channelId, setChannelId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Filter phones that support WhatsApp
    const waPhones = (phones || []).filter((p) => p.type === 'whatsapp' || p.type === 'both');

    // Reset when dialog opens or phone changes
    useEffect(() => {
        if (open) {
            setSelectedPhone(phoneNumber);
            setHistory([]);
            setChannelId(null);
            loadChatHistory(phoneNumber);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, phoneNumber]);

    // Scroll to bottom when history changes
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const loadChatHistory = async (phone: string) => {
        setLoadingHistory(true);
        try {
            const channels = await getWhatsAppChannels();
            const cleanPhone = phone.replace(/\D/g, '');
            const ch = (channels || []).find((c: any) => {
                const chPhone = (c.whatsappPhone || '').replace(/\D/g, '');
                return chPhone === cleanPhone || cleanPhone.endsWith(chPhone) || chPhone.endsWith(cleanPhone);
            });
            if (ch) {
                setChannelId(ch._id);
                const msgs = await getWhatsAppMessages(ch._id);
                setHistory(msgs || []);
            }
        } catch {
            // No history yet — that's fine
        } finally {
            setLoadingHistory(false);
        }
    };

    const handlePhoneChange = (phone: string) => {
        setSelectedPhone(phone);
        setHistory([]);
        setChannelId(null);
        loadChatHistory(phone);
    };

    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            const res = await sendWhatsAppMessage(selectedPhone, message.trim(), clientName);
            if (res.success) {
                // Add message to local history
                setHistory((prev) => [
                    ...prev,
                    {
                        _id: res.messageId || Date.now().toString(),
                        content: message.trim(),
                        senderId: 'me',
                        senderName: 'Moi',
                        createdAt: new Date().toISOString(),
                    },
                ]);
                setChannelId(res.channelId);
                setMessage('');
                Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 2000 }).fire({
                    icon: 'success',
                    title: 'Message envoyé !',
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Erreur', text: "Échec de l'envoi du message WhatsApp.", timer: 3000 });
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Erreur', text: "Impossible d'envoyer le message.", timer: 3000 });
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const applyQuick = (tpl: string) => {
        setMessage(tpl.replace('{name}', clientName));
    };

    const handleClose = () => {
        setMessage('');
        setHistory([]);
        onClose();
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Hier';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Group messages by date
    const groupedMessages: { date: string; messages: ChatMsg[] }[] = [];
    let lastDate = '';
    for (const msg of history) {
        const date = formatDate(msg.createdAt);
        if (date !== lastDate) {
            groupedMessages.push({ date, messages: [msg] });
            lastDate = date;
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    }

    const isOutbound = (msg: ChatMsg) => !msg.senderId.startsWith('wa:');

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="flex h-[600px] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all dark:bg-slate-800">
                                {/* Header */}
                                <div className="flex shrink-0 items-center justify-between bg-emerald-500 px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.215l-.297-.178-2.871.853.853-2.871-.178-.297A8 8 0 1112 20z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{clientName}</p>
                                            {/* Phone selector */}
                                            {waPhones.length > 1 ? (
                                                <select
                                                    value={selectedPhone}
                                                    onChange={(e) => handlePhoneChange(e.target.value)}
                                                    className="mt-0.5 rounded border-0 bg-white/20 px-1.5 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/50"
                                                >
                                                    {waPhones.map((p, i) => (
                                                        <option key={i} value={p.number} className="text-slate-800">
                                                            {p.number} ({p.type === 'whatsapp' ? 'WA' : 'WA+Appel'})
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <p className="text-xs text-white/80">{selectedPhone}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={handleClose} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
                                        <IconX className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Chat history */}
                                <div
                                    className="flex-1 overflow-y-auto bg-[#e5ddd5] px-4 py-3 dark:bg-slate-900/50"
                                    style={{
                                        backgroundImage:
                                            "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h200v200H0z' fill='none'/%3E%3Cpath d='M40 40c0 0 10-10 20 0s20 0 20 0' stroke='%23ccc3' fill='none' stroke-width='.5'/%3E%3C/svg%3E\")",
                                    }}
                                >
                                    {loadingHistory && (
                                        <div className="flex justify-center py-4">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                                        </div>
                                    )}

                                    {!loadingHistory && history.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 text-center">
                                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-2xl dark:bg-slate-800">📱</div>
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nouvelle conversation WhatsApp</p>
                                            <p className="mt-1 text-xs text-slate-400">avec {clientName}</p>
                                        </div>
                                    )}

                                    {groupedMessages.map((group, gi) => (
                                        <div key={gi}>
                                            <div className="my-3 flex justify-center">
                                                <span className="rounded-lg bg-white/80 px-3 py-1 text-[10px] font-medium text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-400">
                                                    {group.date}
                                                </span>
                                            </div>
                                            {group.messages.map((msg) => (
                                                <div key={msg._id} className={`mb-1.5 flex ${isOutbound(msg) ? 'justify-end' : 'justify-start'}`}>
                                                    <div
                                                        className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm ${
                                                            isOutbound(msg)
                                                                ? 'rounded-br-sm bg-emerald-100 text-slate-800 dark:bg-emerald-800/40 dark:text-slate-200'
                                                                : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        {!isOutbound(msg) && <p className="mb-0.5 text-[10px] font-semibold text-emerald-600">{msg.senderName}</p>}
                                                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                                        <p className={`mt-0.5 text-right text-[10px] ${isOutbound(msg) ? 'text-emerald-700/60 dark:text-emerald-400/60' : 'text-slate-400'}`}>
                                                            {formatTime(msg.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Quick messages strip */}
                                <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                                    {QUICK_MESSAGES.map((tpl, i) => (
                                        <button
                                            key={i}
                                            onClick={() => applyQuick(tpl)}
                                            className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-500/10"
                                        >
                                            {tpl.split(' ').slice(0, 3).join(' ')}…
                                        </button>
                                    ))}
                                </div>

                                {/* Message input */}
                                <div className="flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={`Message à ${clientName}…`}
                                        rows={1}
                                        className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:focus:border-emerald-500"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!message.trim() || sending}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                        {sending ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default WhatsAppDialog;
