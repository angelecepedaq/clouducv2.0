// Página de detalle completo de un evento
import Image from 'next/image';
import { useState, useEffect, type FC } from 'react';
import { supabase } from '@/db/supabase';
import type { EventoRow } from '@/types/types';
import SeccionMensajes from '@/components/ucv/SeccionMensajes';
import ModalAuth from '@/components/ucv/ModalAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useLikes } from '@/hooks/useLikes';
import { toast } from 'sonner';

interface DetalleEventoPaginaProps {
  eventoId: string;
  onVolver: () => void;
}

const badgeStyles: Record<string, { bg: string; color: string }> = {
  Académicos: { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa' },
  Culturales: { bg: 'rgba(217,70,239,0.18)', color: '#e879f9' },
  Deportivos: { bg: 'rgba(16,185,129,0.18)', color: '#34d399' },
};

// Helpers
function formatFecha(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return isoDate; }
}

function formatHora(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const DetalleEventoPagina: FC<DetalleEventoPaginaProps> = ({ eventoId, onVolver }) => {
  const { user } = useAuth();
  const { toggleLike, likesCargando } = useLikes();
  
  const [evento, setEvento] = useState<EventoRow | null>(null);
  const [creadorUsername, setCreadorUsername] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [authAbierto, setAuthAbierto] = useState(false);
  
  const [likeOptimista, setLikeOptimista] = useState(false);
  const [likesContador, setLikesContador] = useState(0);

  const handleLike = async () => {
    if (!evento) return;
    if (!user) {
      setAuthAbierto(true);
      return;
    }
    if (likesCargando[evento.id]) return;

    // Actualización optimista
    setLikeOptimista((prev) => !prev);
    setLikesContador((prev) => (likeOptimista ? Math.max(0, prev - 1) : prev + 1));

    const success = await toggleLike(evento.id);
    if (!success) {
      // Revertir en caso de fallo
      setLikeOptimista((prev) => !prev);
      setLikesContador((prev) => (!likeOptimista ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleShare = async () => {
    if (!evento) return;
    
    const urlCompartir = `${window.location.origin}?evento=${evento.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: evento.title,
          text: `¡Mira este evento en Cloud UCV! - ${evento.title}`,
          url: urlCompartir,
        });
      } catch (err) {
        console.error('Error compartiendo', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(
          `¡Mira este evento en Cloud UCV!\n${evento.title}\n${urlCompartir}`
        );
        toast.success('¡Enlace copiado al portapapeles!');
      } catch {
        toast.error('No se pudo copiar el enlace');
      }
    }
  };

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorCarga(false);

    supabase
      .from('eventos')
      .select('id, title, description, category, location, start_date, end_date, user_id, created_at, updated_at, imagen')
      .eq('id', eventoId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!activo) return;
        if (error || !data) { setErrorCarga(true); setCargando(false); return; }
        
        const eventoData = data as EventoRow;
        setEvento(eventoData);
        
        // Contar likes del evento
        const { count } = await supabase
          .from('likes_evento')
          .select('*', { count: 'exact', head: true })
          .eq('evento_id', eventoId);
        
        if (activo) setLikesContador(count || 0);
        
        // Cargar estado de like del usuario actual si está autenticado
        if (user) {
          const { data: likeData } = await supabase
            .from('likes_evento')
            .select('id')
            .eq('evento_id', eventoId)
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (activo && likeData) {
            setLikeOptimista(true);
          }
        }

        // Cargar username del creador si existe
        if (data.user_id) {
          const { data: perfil } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.user_id)
            .maybeSingle();
          if (activo) setCreadorUsername(perfil?.username ?? null);
        }
        setCargando(false);
      });

      return () => { activo = false; };
  }, [eventoId, user]);

  const badge = evento ? (badgeStyles[evento.category] ?? { bg: 'rgba(168,85,247,0.18)', color: '#c084fc' }) : null;
  const catColor = evento ? (evento.category === 'Académicos' ? '#3B82F6' : evento.category === 'Culturales' ? '#D946EF' : evento.category === 'Deportivos' ? '#10B981' : '#F59E0B') : '#a855f7';

  // ——— CARGANDO ———
  if (cargando) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Skeleton hero */}
        <div className="w-full h-56 animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <div className="px-4 py-5 flex flex-col gap-3">
          {[80, 50, 65, 45].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded-full animate-pulse"
              style={{ width: `${w}%`, backgroundColor: 'rgba(255,255,255,0.07)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ——— ERROR ———
  if (errorCarga || !evento) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="rgba(248,113,113,0.6)" strokeWidth="1.8"/>
          <path d="M12 8v4M12 16h.01" stroke="rgba(248,113,113,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <p className="text-white font-semibold text-sm text-balance">
          No se pudo cargar el evento
        </p>
        <p className="text-lavender text-xs text-pretty">Intenta nuevamente o regresa a la lista</p>
        <button
          onClick={onVolver}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
        >
          Volver
        </button>
      </div>
    );
  }

  // ——— DETALLE ———
  return (
    <>
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Hero — gradient con categoría */}
            <div className="relative w-full h-56">
                {evento.imagen ? (
                  <Image src={evento.imagen} alt={evento.title} fill className="absolute inset-0 object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${catColor}44, ${catColor}11)` }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ backgroundColor: `${catColor}22` }}>
                    <span className="text-5xl">
                      {evento.category === 'Académicos' ? '🎓' : evento.category === 'Culturales' ? '🎵' : evento.category === 'Deportivos' ? '⚽' : '💼'}
                    </span>
                  </div>
                </div>
                {/* Gradiente para legibilidad */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)' }}
                />

          {/* Botón volver */}
          <button
            onClick={onVolver}
            className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)' }}
            aria-label="Volver"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Botón compartir */}
          <button
            onClick={handleShare}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)' }}
            aria-label="Compartir evento"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 6 12 2 8 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="2" x2="12" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Badge categoría sobre la imagen */}
          {badge && (
            <div className="absolute bottom-4 left-4">
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: badge.bg, color: badge.color, backdropFilter: 'blur(4px)', border: `1px solid ${badge.color}44` }}
              >
                {evento.category}
              </span>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="px-4 pt-5 pb-6 flex flex-col gap-4">

          {/* Título */}
          <h1 className="text-white font-bold text-xl leading-snug text-balance">{evento.title}</h1>

          {/* Descripción */}
          {evento.description && (
            <div className="mb-2">
              <p className="text-lavender text-sm leading-relaxed whitespace-pre-wrap">
                {evento.description}
              </p>
            </div>
          )}

          {/* Metadatos del evento */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            {/* Fecha y hora */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(217,70,239,0.15)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#d946ef" strokeWidth="1.8"/>
                  <path d="M16 2V6M8 2V6M3 10H21" stroke="#d946ef" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{formatFecha(evento.start_date)}</p>
                <p className="text-lavender text-xs">{formatHora(evento.start_date)}</p>
              </div>
            </div>

            {/* Ubicación (solo si existe) */}
            {evento.location && (
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(217,70,239,0.15)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#d946ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="10" r="3" stroke="#d946ef" strokeWidth="1.8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Ubicación</p>
                  <p className="text-lavender text-xs text-pretty">{evento.location}</p>
                </div>
              </div>
            )}

            {/* Likes */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(217,70,239,0.15)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#d946ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-white text-sm font-semibold">{likesContador} me gusta</p>
              </div>

              {/* Botón Like */}
              <button 
                onClick={handleLike}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-colors active:scale-90"
                style={{ backgroundColor: likeOptimista ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={likeOptimista ? '#ef4444' : 'none'} className="transition-all" style={{ color: likeOptimista ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Organizador */}
            {creadorUsername && (
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(217,70,239,0.15)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#d946ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" stroke="#d946ef" strokeWidth="1.8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-lavender text-[10px] font-medium uppercase tracking-wide">Organizador</p>
                  <p className="text-white text-sm font-semibold">@{creadorUsername}</p>
                </div>
              </div>
            )}
          </div>

          {/* Separador */}
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* Sección de mensajes al administrador */}
          <SeccionMensajes
            eventoId={evento.id}
            onAbrirLogin={() => setAuthAbierto(true)}
          />
        </div>
      </div>

      {/* Modal de autenticación */}
      <ModalAuth abierto={authAbierto} onCerrar={() => setAuthAbierto(false)} />
    </>
  );
};

export default DetalleEventoPagina;
