'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PhotoAnnotatorProps {
    /** The image source (object URL or a remote URL) */
    imageSrc: string;
    /** Called when the user saves the annotated image */
    onSave: (_annotatedFile: File) => void;
    /** Called when the user closes without saving */
    onClose: () => void;
}

type DrawColor = '#e7515a' | '#4361ee' | '#00ab55' | '#e2a03f' | '#000000';
type BrushSize = 2 | 4 | 6 | 10;

const COLORS: { value: DrawColor; label: string }[] = [
    { value: '#e7515a', label: 'Rouge' },
    { value: '#4361ee', label: 'Bleu' },
    { value: '#00ab55', label: 'Vert' },
    { value: '#e2a03f', label: 'Orange' },
    { value: '#000000', label: 'Noir' },
];

const BRUSH_SIZES: BrushSize[] = [2, 4, 6, 10];

/**
 * Full-screen photo annotation component.
 * Uses HTML5 Canvas to draw freehand lines over a photo.
 * The user can pick pen color, brush size, undo, clear, and save.
 * Saved output is a composite image (photo + drawings) as a File object.
 */
const PhotoAnnotator: React.FC<PhotoAnnotatorProps> = ({ imageSrc, onSave, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState<DrawColor>('#e7515a');
    const [brushSize, setBrushSize] = useState<BrushSize>(4);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Track the last point for smooth lines
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const resizeAndDraw = useCallback((img: HTMLImageElement) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const maxW = container.clientWidth;
        const maxH = container.clientHeight;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);

        // Save initial state
        setHistory([ctx.getImageData(0, 0, w, h)]);
    }, []);

    // Load the image and set up the canvas
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imgRef.current = img;
            setImageLoaded(true);
            resizeAndDraw(img);
        };
        img.onerror = () => {
            console.error('[PhotoAnnotator] Failed to load image');
        };
        img.src = imageSrc;

        const handleResize = () => {
            if (imgRef.current) resizeAndDraw(imgRef.current);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [imageSrc, resizeAndDraw]);

    // Get pointer position relative to canvas
    const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
    }, []);

    const startDraw = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            e.preventDefault();
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Capture pointer for reliable tracking on touch devices
            canvas.setPointerCapture(e.pointerId);

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const pos = getPos(e);
            lastPointRef.current = pos;

            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);

            setIsDrawing(true);
        },
        [color, brushSize, getPos],
    );

    const draw = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing) return;
            e.preventDefault();

            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;

            const pos = getPos(e);

            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (lastPointRef.current) {
                ctx.beginPath();
                ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

            lastPointRef.current = pos;
        },
        [isDrawing, color, brushSize, getPos],
    );

    const endDraw = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing) return;
            e.preventDefault();

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.releasePointerCapture(e.pointerId);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Save state for undo
                    setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                }
            }

            lastPointRef.current = null;
            setIsDrawing(false);
        },
        [isDrawing],
    );

    const undo = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || history.length <= 1) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const newHistory = [...history];
        newHistory.pop(); // Remove last state
        const prevState = newHistory[newHistory.length - 1];
        ctx.putImageData(prevState, 0, 0);
        setHistory(newHistory);
    }, [history]);

    const clearDrawings = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    }, []);

    const handleSave = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsSaving(true);

        try {
            // Export at full resolution: draw original image + scale drawings
            const img = imgRef.current;
            if (!img) return;

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = img.width;
            exportCanvas.height = img.height;
            const ectx = exportCanvas.getContext('2d');
            if (!ectx) return;

            // Draw original image at full resolution
            ectx.drawImage(img, 0, 0);

            // Draw the annotations on top (scale from canvas to full resolution)
            ectx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, img.width, img.height);

            const blob = await new Promise<Blob | null>((resolve) => {
                exportCanvas.toBlob(resolve, 'image/jpeg', 0.85);
            });

            if (blob) {
                const file = new File([blob], `annotated_${Date.now()}.jpg`, { type: 'image/jpeg' });
                onSave(file);
            }
        } catch (err) {
            console.error('[PhotoAnnotator] Save error:', err);
        } finally {
            setIsSaving(false);
        }
    }, [onSave]);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-slate-900/95 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        title="Fermer"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <span className="text-xs font-bold text-slate-300">✏️ Annoter le défaut</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={history.length <= 1}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-30"
                        title="Annuler"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={clearDrawings}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        title="Effacer tout"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || history.length <= 1}
                        className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40"
                    >
                        {isSaving ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* Color & brush size picker */}
            <div className="flex items-center justify-center gap-4 bg-slate-900/80 px-3 py-2">
                {/* Colors */}
                <div className="flex items-center gap-1.5">
                    {COLORS.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            onClick={() => setColor(c.value)}
                            className={`h-7 w-7 rounded-full border-2 transition-transform ${
                                color === c.value ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                        />
                    ))}
                </div>

                <div className="h-5 w-px bg-slate-700" />

                {/* Brush sizes */}
                <div className="flex items-center gap-1.5">
                    {BRUSH_SIZES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setBrushSize(s)}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                                brushSize === s ? 'bg-slate-600 ring-2 ring-white/50' : 'bg-slate-800 hover:bg-slate-700'
                            }`}
                            title={`Épaisseur ${s}px`}
                        >
                            <span className="rounded-full bg-white" style={{ width: `${s + 2}px`, height: `${s + 2}px` }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas area */}
            <div ref={containerRef} className="flex flex-1 items-center justify-center overflow-hidden bg-black p-2">
                {!imageLoaded && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                        <p className="text-sm text-slate-400">Chargement de l&apos;image...</p>
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    className={`max-h-full max-w-full touch-none ${imageLoaded ? '' : 'hidden'}`}
                    style={{ cursor: 'crosshair' }}
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    onPointerCancel={endDraw}
                    onPointerLeave={endDraw}
                />
            </div>

            {/* Bottom hint */}
            <div className="bg-slate-900/80 px-4 py-2 text-center text-[10px] text-slate-500">
                Dessinez sur la photo pour marquer les défauts · Le client verra ces annotations sur son portail
            </div>
        </div>
    );
};

export default PhotoAnnotator;




