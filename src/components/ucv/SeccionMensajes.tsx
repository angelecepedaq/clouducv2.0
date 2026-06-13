// Sección de comentarios públicos para eventos
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import type { MensajeEvento } from '@/types/types';
import { useMensajesEvento } from '@/hooks/useMensajesEvento';
import { useAuth } from '@/contexts/AuthContext';

interface SeccionMensajesProps {
  eventoId: string;
  onAbrirLogin: () => void;
}

// Tiempo relativo legible
function tiempoRelativo(fechaStr: string): string {
  if (!fechaStr) return '';
  const ahora = Date.now();
  const fecha = new Date(fechaStr).getTime();
  const diff = Math.floor((ahora - fecha) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}sem`;
}

// Avatar con iniciales o imagen
const AvatarMensaje: FC<{ username: string; avatarUrl?: string | null }> = ({ username, avatarUrl }) => (
  <div
    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white overflow-hidden"
    style={!avatarUrl ? { background: 'linear-gradient(135deg, #d946ef, #a855f7)' } : { backgroundColor: 'rgba(255,255,255,0.1)' }}
  >
    {avatarUrl ? (
      <div className="relative w-full h-full">
        <Image
          src={avatarUrl}
          alt={username}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    ) : (
      username.slice(0, 2).toUpperCase()
    )}
  </div>
);

export interface MensajeConRespuestas extends MensajeEvento {
  respuestas: MensajeConRespuestas[];
}

const ComentarioItem: FC<{ 
  mensaje: MensajeConRespuestas; 
  onReply: (m: MensajeEvento) => void;
  onLike: (id: string) => Promise<boolean>;
  getLikes: (id: string) => Promise<{count: number, userLiked: boolean}>;
  isReply?: boolean;
}> = ({ mensaje, onReply, onLike, getLikes, isReply = false }) => {
  const username = mensaje.profiles?.username ?? 'Usuario';
  const avatarUrl = mensaje.profiles?.avatar_url;
  
  const [likesCount, setLikesCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  
  useEffect(() => {
    getLikes(mensaje.id).then(res => {
      setLikesCount(res.count);
      setUserLiked(res.userLiked);
    });
  }, [mensaje.id, getLikes]);

  const handleLike = async () => {
    // Optimistic UI
    setUserLiked(!userLiked);
    setLikesCount(prev => userLiked ? Math.max(0, prev - 1) : prev + 1);
    
    const ok = await onLike(mensaje.id);
    if (!ok) {
      // Revert if failed
      setUserLiked(!userLiked);
      setLikesCount(prev => !userLiked ? Math.max(0, prev - 1) : prev + 1);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${isReply ? 'mt-3' : 'mt-5'}`}>
      <div className="flex gap-2.5">
        <AvatarMensaje username={username} avatarUrl={avatarUrl} />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-semibold">{username}</span>
            <span className="text-white/40 text-[10px]">{tiempoRelativo(mensaje.created_at)}</span>
          </div>
          
          <div className="text-sm text-white/90 leading-snug text-pretty mt-0.5 whitespace-pre-wrap break-words">
            {/* Si ya inyectamos el @username al enviar, evitamos duplicarlo aquí si queremos.
                Pero como puede tener un reply_to_id directo, usamos regex o simplemente renderizamos. */}
            {mensaje.contenido.startsWith('@') ? (
              <>
                <span className="text-[#a855f7] font-medium">{mensaje.contenido.split(' ')[0]}</span>
                {' ' + mensaje.contenido.split(' ').slice(1).join(' ')}
              </>
            ) : (
              <>
                {isReply && mensaje.reply_to?.profiles?.username && (
                  <span className="text-[#a855f7] mr-1.5 font-medium">@{mensaje.reply_to.profiles.username}</span>
                )}
                {mensaje.contenido}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-1">
            <button 
              onClick={handleLike} 
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${userLiked ? 'text-pink-500' : 'text-white/50 hover:text-white/80'}`}
            >
              {userLiked ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>{likesCount}</span>
            </button>
            <button 
              onClick={() => onReply(mensaje)} 
              className="text-[11px] text-white/50 hover:text-white/80 transition-colors font-medium"
            >
              Responder
            </button>
          </div>
        </div>
      </div>
      
      {/* Respuestas anidadas */}
      {mensaje.respuestas?.length > 0 && (
        <div className="pl-10 mt-1 flex flex-col relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-white/15">
          {mensaje.respuestas.map(r => (
            <ComentarioItem 
              key={r.id} 
              mensaje={r} 
              onReply={onReply} 
              onLike={onLike} 
              getLikes={getLikes} 
              isReply={true} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SeccionMensajes: FC<SeccionMensajesProps> = ({ eventoId, onAbrirLogin }) => {
  const { user } = useAuth();
  const { mensajes, cargando, enviando, error, enviarMensaje, toggleLikeMensaje, getMensajeLikes, resetError } = useMensajesEvento(eventoId);
  const [texto, setTexto] = useState('');
  const [replyTo, setReplyTo] = useState<(MensajeEvento & { original_reply_target?: string }) | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Organizar mensajes en árbol
  const mensajesTree = (() => {
    const map = new Map<string, MensajeConRespuestas>();
    const roots: MensajeConRespuestas[] = [];

    mensajes.forEach(m => {
      // Si el mensaje viene sin contenido (error por RLS en inserciones pasadas) lo ignoramos o manejamos.
      if (m.id) map.set(m.id, { ...m, respuestas: [] });
    });

    mensajes.forEach(m => {
      if (!m.id) return;
      
      // Aseguramos que solo tenga 1 nivel de anidación. Si reply_to_id apunta a otro mensaje, 
      // y ese otro mensaje tiene un reply_to_id, lo aplastamos al padre superior.
      // Ya estamos haciendo esto al hacer handleReply, pero por si acaso.
      if (m.reply_to_id) {
        // En lugar de pushearlo ciegamente, buscamos la raíz si es que existe en el map
        let padreId = m.reply_to_id;
        
        // Recorremos hacia arriba si el padre tiene a su vez un reply_to_id
        while(map.has(padreId) && map.get(padreId)!.reply_to_id) {
            padreId = map.get(padreId)!.reply_to_id!;
        }
        
        if (map.has(padreId)) {
          map.get(padreId)!.respuestas.push(map.get(m.id)!);
        } else {
          roots.push(map.get(m.id)!); // fallback
        }
      } else {
        roots.push(map.get(m.id)!);
      }
    });

    // Ordenamos las raíces y las respuestas cronológicamente por las dudas
    roots.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    roots.forEach(r => {
      r.respuestas.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return roots;
  })();

  // Scroll al último mensaje nuevo
  useEffect(() => {
    if (mensajes.length > 0) {
      finalRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes.length]);

  const handleEnviar = async () => {
    if (!texto.trim()) return;
    
    // Si estamos respondiendo, ya hemos prellenado el "@usuario ". 
    // No hace falta forzarlo en el contenidoFinal si el usuario lo borró conscientemente, 
    // pero mantenemos replyTo?.id para que la BD mantenga la relación.
    
    // Si el texto está vacío o solo contiene el @usuario, evitamos enviarlo (aunque texto.trim() ya filtra vacíos puros)
    if (replyTo?.profiles?.username && texto.trim() === `@${replyTo.profiles.username}`) {
       return; 
    }
    
    const ok = await enviarMensaje(texto, replyTo?.id);
    if (ok) {
      setTexto('');
      setReplyTo(null);
    }
  };

  const handleReply = (mensaje: MensajeEvento) => {
    // Aplanamos las respuestas a 1 solo nivel: 
    // Si respondemos a una respuesta, lo enlazamos al comentario original (raíz)
    const replyTargetId = mensaje.reply_to_id ? mensaje.reply_to_id : mensaje.id;
    
    // Guardamos la mención al usuario para mostrarlo en el texto o la UI
    setReplyTo({ ...mensaje, id: replyTargetId, original_reply_target: mensaje.profiles?.username });
    
    // Pre-llenar el input con el @usuario (comportamiento muy común en Instagram)
    if (mensaje.profiles?.username) {
      // Si el texto ya tiene contenido, no lo borramos, solo agregamos el @ al inicio si no está
      if (!texto.includes(`@${mensaje.profiles.username}`)) {
         setTexto(`@${mensaje.profiles.username} `);
      }
    }
    
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnviar();
    }
  };

  // ——— NO AUTENTICADO ———
  if (!user) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(217,70,239,0.15)', border: '1px solid rgba(217,70,239,0.3)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="rgba(217,70,239,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm text-balance">
            Comentarios del evento
          </p>
          <p className="text-lavender text-xs mt-1 text-pretty">
            Inicia sesión para dejar un comentario o hacer una pregunta
          </p>
        </div>
        <button
          onClick={onAbrirLogin}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  // ——— AUTENTICADO ———
  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado de la sección */}
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="rgba(217,70,239,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h3 className="text-white font-bold text-sm">
          Comentarios
        </h3>
        {mensajes.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(217,70,239,0.2)', color: '#e879f9' }}
          >
            {mensajes.length}
          </span>
        )}
      </div>

      {/* Lista de mensajes */}
      <div
        className="rounded-2xl overflow-y-auto flex flex-col gap-3 p-3"
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '280px',
          minHeight: '80px',
        }}
      >
        {cargando && (
          <div className="flex items-center justify-center py-6 gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(217,70,239,0.5)', borderTopColor: 'transparent' }}
            />
            <span className="text-lavender text-xs">Cargando mensajes...</span>
          </div>
        )}

        {!cargando && mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-lavender text-xs text-center">
              Sé el primero en dejar un comentario
            </p>
          </div>
        )}

        {!cargando && mensajesTree.map((m) => (
          <ComentarioItem
            key={m.id}
            mensaje={m}
            onReply={handleReply}
            onLike={toggleLikeMensaje}
            getLikes={getMensajeLikes}
          />
        ))}
        <div ref={finalRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.8"/>
            <path d="M12 8v4M12 16h.01" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p className="text-red-300 text-xs flex-1">{error}</p>
          <button onClick={resetError} className="text-red-300/60 text-xs hover:text-red-300">✕</button>
        </div>
      )}

      {/* Campo para escribir */}
      <div className="flex flex-col gap-2">
        {replyTo && (
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs text-lavender border border-white/10">
            <span className="truncate flex-1">
              Respondiendo a <span className="font-semibold text-white">{replyTo.original_reply_target || replyTo.profiles?.username || 'usuario'}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="ml-2 p-1 hover:text-white transition-colors" title="Cancelar respuesta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
        <div
          className="rounded-2xl overflow-hidden flex items-center bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); if (error) resetError(); }}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? "Escribe tu respuesta..." : "Añade un comentario..."}
            maxLength={500}
            className="flex-1 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none bg-transparent"
          />
          <div className="pr-2 shrink-0 flex items-center gap-2">
            <span className={`text-[10px] hidden sm:inline-block ${texto.length > 450 ? 'text-amber-400' : 'text-white/30'}`}>
              {texto.length}/500
            </span>
            <button
              onClick={handleEnviar}
              disabled={enviando || !texto.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
            >
              {enviando ? (
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
                />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeccionMensajes;
