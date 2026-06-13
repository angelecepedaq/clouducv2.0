// Componente EventoCard para Cloud UCV
import Image from 'next/image';
import { useState, MouseEvent } from 'react';
import type { FC } from 'react';
import type { Evento } from '@/types/types';
import { useLikes } from '@/hooks/useLikes';
import { useGuardar } from '@/hooks/useGuardar';
import ModalAuth from '@/components/ucv/ModalAuth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EventoCardProps {
  evento: Evento;
  onClick?: () => void;
}

const badgeStyles: Record<string, string> = {
  Culturales: 'badge-culturales',
  Académicos: 'badge-academicos',
  Deportivos: 'badge-deportivos',
  Comerciales: 'badge-comerciales',
};

// Colores de categoría para el indicador visual
const categoryColors: Record<string, string> = {
  Académicos: '#3B82F6',
  Culturales: '#D946EF',
  Deportivos: '#10B981',
  Comerciales: '#F59E0B',
};

// Formatear fecha desde ISO timestamp
function formatFecha(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

function formatHora(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const EventoCard: FC<EventoCardProps> = ({ evento, onClick }) => {
  const { user } = useAuth();
  const [guardado, setGuardado] = useState(evento.guardado);
  const [likeOptimista, setLikeOptimista] = useState(evento.like_local ?? false);
  const [likesContador, setLikesContador] = useState(evento.likes_count ?? 0);
  
  const { toggleLike, likesCargando } = useLikes();
  const { toggleGuardado, guardadoCargando } = useGuardar();
  
  const [authAbierto, setAuthAbierto] = useState(false);

  const catColor = categoryColors[evento.category] ?? '#a855f7';

  const handleLike = async (e: MouseEvent) => {
    e.stopPropagation();
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

  const handleGuardar = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setAuthAbierto(true);
      return;
    }
    if (guardadoCargando[evento.id]) return;

    // Actualización optimista
    setGuardado((prev) => !prev);

    const newState = await toggleGuardado(evento.id);
    if (newState === null) {
      // Revertir en caso de fallo
      setGuardado((prev) => !prev);
    } else if (newState) {
      toast.success('Evento guardado');
    } else {
      toast.success('Evento eliminado de guardados');
    }
  };

  const handleShare = async (e: MouseEvent) => {
    e.stopPropagation();
    
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

  return (
    <div
      className="rounded-2xl overflow-hidden ucv-card-bg shadow-card mb-4 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={onClick}
    >
      {/* Header visual con color de categoría */}
      <div className="relative w-full h-32 overflow-hidden">
        {evento.imagen ? (
          <Image src={evento.imagen} alt={evento.title} fill className="absolute inset-0 object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${catColor}33, ${catColor}11)` }} />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${catColor}22` }}>
            <span className="text-3xl">
              {evento.category === 'Académicos' ? '🎓' : evento.category === 'Culturales' ? '🎵' : evento.category === 'Deportivos' ? '⚽' : '💼'}
            </span>
          </div>
        </div>
        {/* Badge de categoría */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-xs font-semibold text-white px-3 py-1 rounded-full ${badgeStyles[evento.category] ?? 'bg-primary'}`}
          >
            {evento.category}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-3">
        <h3 className="text-white font-bold text-base mb-2 text-balance">{evento.title}</h3>

        {/* Fecha y hora */}
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"/>
            <path d="M16 2V6M8 2V6M3 10H21" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span className="text-xs text-lavender">
            {formatFecha(evento.start_date)} - {formatHora(evento.start_date)}
          </span>
        </div>

        {/* Ubicación (si existe) */}
        {evento.location && (
          <div className="flex items-center gap-2 mb-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="rgba(217,70,239,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="10" r="3" stroke="rgba(217,70,239,0.7)" strokeWidth="1.8"/>
            </svg>
            <span className="text-xs text-lavender truncate">{evento.location}</span>
          </div>
        )}

        {/* Acciones e info final */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Contador de Likes */}
            <div className="flex items-center gap-1.5" onClick={handleLike}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={likeOptimista ? '#ef4444' : 'none'} className="transition-transform active:scale-75" style={{ color: likeOptimista ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-semibold text-white/80">{likesContador}</span>
            </div>
          </div>

          {/* Bookmark y Compartir */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90 text-white/50 hover:text-white"
              aria-label="Compartir evento"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16 6 12 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={handleGuardar}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={guardado ? { color: '#d946ef' } : { color: 'rgba(255,255,255,0.5)' }}
              aria-label={guardado ? 'Quitar de guardados' : 'Guardar evento'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={guardado ? 'currentColor' : 'none'}>
                <path d="M19 21L12 16L5 21V5C5 4.45 5.45 4 6 4H18C18.55 4 19 4.45 19 5V21Z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal Auth for likes */}
      <ModalAuth abierto={authAbierto} onCerrar={() => setAuthAbierto(false)} />
    </div>
  );
};

export default EventoCard;
