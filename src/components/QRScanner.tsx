import { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Scan, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estudiante, EstadoAsistencia } from '@/types';

interface QRScannerProps {
  onScanComplete?: (estudiante: Estudiante, estado: EstadoAsistencia) => void;
}

interface ScanConfirmation {
  estudiante: Estudiante;
  estado: EstadoAsistencia;
  hora: string;
}

const TARDANZA_THRESHOLD_MINUTES = 30;

export default function QRScanner({ onScanComplete }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ ci: string; time: number } | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmation, setConfirmation] = useState<ScanConfirmation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  const processQRData = useCallback(
    async (data: string) => {
      // Prevent duplicate scans within 5 seconds
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.ci === data &&
        now - lastScanRef.current.time < 5000
      ) {
        return;
      }
      lastScanRef.current = { ci: data, time: now };

      setProcessing(true);
      stopCamera();

      // Extract CI from QR data. Expected format: "CI:8765432" or just "8765432"
      const ci = data.replace(/^CI:/i, '').trim();

      const { data: estudiante, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('ci', ci)
        .maybeSingle();

      if (error || !estudiante) {
        setCameraError(`No se encontró un estudiante con C.I. ${ci}`);
        setProcessing(false);
        return;
      }

      // Determine if tardanza based on current time vs 07:30 threshold
      const now_date = new Date();
      const threshold = new Date(now_date);
      threshold.setHours(7, 30, 0, 0);
      const estado: EstadoAsistencia =
        now_date.getTime() > threshold.getTime() ? 'TARDANZA' : 'PRESENTE';

      // Insert attendance record
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('asistencia').insert({
        estudiante_id: estudiante.id,
        fecha: now_date.toISOString().split('T')[0],
        hora: now_date.toTimeString().split(' ')[0],
        estado,
        registrado_por: userData.user?.id ?? null,
      });

      if (insertError) {
        setCameraError('Error al registrar la asistencia. Intente nuevamente.');
        setProcessing(false);
        return;
      }

      const horaStr = now_date.toLocaleTimeString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
      });

      setConfirmation({
        estudiante: estudiante as Estudiante,
        estado,
        hora: horaStr,
      });
      setProcessing(false);
      setWhatsappSent(false);

      if (onScanComplete) {
        onScanComplete(estudiante as Estudiante, estado);
      }
    },
    [stopCamera, onScanComplete]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      processQRData(code.data);
      return;
    }

    animationRef.current = requestAnimationFrame(scanFrame);
  }, [processQRData]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setConfirmation(null);
    setStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setScanning(true);
      setStarting(false);
      animationRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError(
        'No se pudo acceder a la cámara. Verifique los permisos del navegador.'
      );
      setStarting(false);
    }
  }, [scanFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleSendWhatsApp = () => {
    if (!confirmation) return;
    const { estudiante, estado, hora } = confirmation;
    const today = new Date().toLocaleDateString('es-PY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const estadoText = estado === 'PRESENTE' ? 'presente' : 'llegó con tardanza';
    const message = `*Colegio Nacional Juan Eudoro Cáceres*\n\nEstimado/a tutor/a, le informamos que su hijo/a *${estudiante.nombre_completo}* (C.I. ${estudiante.ci}) ha sido registrado/a como *${estadoText}* el día ${today} a las ${hora}.\n\nSaludos cordiales,\nDirección Académica.`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    setWhatsappSent(true);
  };

  const handleNewScan = () => {
    setConfirmation(null);
    setWhatsappSent(false);
    setCameraError(null);
    startCamera();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Scanner area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-600" />
            Escáner QR de Asistencia
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Enfoque la cámara hacia el código QR del carnet del estudiante
          </p>
        </div>

        <div className="p-6">
          {/* Camera viewport */}
          <div className="relative aspect-square max-w-sm mx-auto bg-navy-900 rounded-2xl overflow-hidden">
            {!cameraActive && !confirmation && !processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                {cameraError ? (
                  <>
                    <CameraOff className="w-12 h-12 mb-3 text-error-400" />
                    <p className="text-sm text-center px-6">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <Scan className="w-16 h-16 mb-3 text-white/30" />
                    <p className="text-sm text-center">Cámara inactiva</p>
                  </>
                )}
              </div>
            )}

            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-900/90 z-10">
                <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-3" />
                <p className="text-white text-sm">Procesando asistencia...</p>
              </div>
            )}

            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan overlay */}
            {cameraActive && scanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/40" />
                {/* Scanning frame */}
                <div className="absolute inset-8 rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 border-2 border-white/80 rounded-2xl" />
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                  {/* Scan line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-scan-line" />
                </div>
                <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-medium">
                  Escaneando... Acerque el código QR
                </p>
              </div>
            )}

            {/* Confirmation overlay */}
            {confirmation && (
              <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 animate-scale-in">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                    confirmation.estado === 'PRESENTE'
                      ? 'bg-success-100'
                      : 'bg-warning-100'
                  }`}
                >
                  {confirmation.estado === 'PRESENTE' ? (
                    <CheckCircle2 className="w-12 h-12 text-success-600" />
                  ) : (
                    <AlertTriangle className="w-12 h-12 text-warning-600" />
                  )}
                </div>
                <p
                  className={`text-sm font-bold uppercase tracking-wide mb-4 ${
                    confirmation.estado === 'PRESENTE'
                      ? 'text-success-600'
                      : 'text-warning-600'
                  }`}
                >
                  {confirmation.estado === 'PRESENTE' ? 'Presente' : 'Llegada Tardía'}
                </p>

                {/* Student info card */}
                <div className="w-full bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  {confirmation.estudiante.foto_url ? (
                    <img
                      src={confirmation.estudiante.foto_url}
                      alt={confirmation.estudiante.nombre_completo}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Scan className="w-8 h-8 text-brand-400" />
                    </div>
                  )}
                  <div className="min-w-0 text-left">
                    <p className="font-bold text-navy-900 truncate">
                      {confirmation.estudiante.nombre_completo}
                    </p>
                    <p className="text-sm text-gray-500">C.I. {confirmation.estudiante.ci}</p>
                    <p className="text-xs text-gray-400">
                      {confirmation.estudiante.curso} · {confirmation.hora}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            {!cameraActive && !confirmation && !processing && (
              <button
                onClick={startCamera}
                disabled={starting}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Iniciando cámara...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Activar Cámara
                  </>
                )}
              </button>
            )}

            {cameraActive && (
              <button
                onClick={stopCamera}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-navy-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <CameraOff className="w-5 h-5" />
                Detener Cámara
              </button>
            )}

            {confirmation && (
              <>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={whatsappSent}
                  className={`w-full py-3.5 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    whatsappSent
                      ? 'bg-success-100 text-success-700'
                      : 'bg-[#25D366] hover:bg-[#1ebd5d] text-white shadow-lg shadow-[#25D366]/20'
                  }`}
                >
                  {whatsappSent ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Notificación enviada
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.43-.53-2.72-1.68-1-.89-1.68-1.99-1.88-2.34-.2-.34-.02-.53.11-.7.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
                      </svg>
                      Notificar al Tutor por WhatsApp
                    </>
                  )}
                </button>
                <button
                  onClick={handleNewScan}
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  Escanear Otro Estudiante
                </button>
              </>
            )}
          </div>

          {/* Info note */}
          {!confirmation && !cameraActive && !processing && (
            <div className="mt-4 p-4 bg-brand-50 rounded-xl">
              <p className="text-xs text-brand-700 leading-relaxed">
                <strong>Nota:</strong> La asistencia se registra automáticamente como
                "Presente" si el escaneo ocurre antes de las 07:30 hs, y como "Llegada Tardía"
                si ocurre después.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
