// Hook para comentarios de eventos con Realtime
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';
import type { MensajeEvento } from '@/types/types';

interface UseMensajesEventoResult {
  mensajes: MensajeEvento[];
  cargando: boolean;
  enviando: boolean;
  error: string | null;
  enviarMensaje: (contenido: string, replyToId?: string) => Promise<boolean>;
  toggleLikeMensaje: (mensajeId: string) => Promise<boolean>;
  getMensajeLikes: (mensajeId: string) => Promise<{ count: number, userLiked: boolean }>;
  resetError: () => void;
}

type RawMensajeEvento = Record<string, unknown>;

export function useMensajesEvento(eventoId: string | null): UseMensajesEventoResult {
  const [mensajes, setMensajes] = useState<MensajeEvento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeMensaje = (m: RawMensajeEvento): MensajeEvento => ({
    ...(m as unknown as MensajeEvento),
    contenido: String(m.contenido ?? m.mensaje ?? m.content ?? m.text ?? ''),
  });

  const cargarMensajes = useCallback(async () => {
    if (!eventoId) return;
    setCargando(true);
    setError(null);

    const selectQuery = `
      *,
      likes:likes_mensaje(count)
    `;

    const result = await supabase
      .from('mensajes_evento')
      .select(selectQuery)
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: true })
      .limit(100);

    setCargando(false);
    if (result.error) {
      console.error(result.error);
      setError('No se pudieron cargar los comentarios.');
      return;
    }
    
    const mensajesProcesados = Array.isArray(result.data)
      ? (result.data as RawMensajeEvento[]).map(normalizeMensaje)
      : [];    
    let mensajesConPerfil = mensajesProcesados as MensajeEvento[];
    
    const remitenteIds = Array.from(new Set(mensajesProcesados.map(m => m.remitente_id).filter(Boolean)));
    const perfilesMap = new Map<string, { username?: string; avatar_url?: string | null }>();

    if (remitenteIds.length > 0) {
      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', remitenteIds as string[]);

      if (Array.isArray(perfiles)) {
        perfiles.forEach((perfil) => {
          if (perfil?.id) {
            perfilesMap.set(perfil.id, {
              username: perfil.username,
              avatar_url: perfil.avatar_url,
            });
          }
        });
      }
    }

    mensajesConPerfil = mensajesConPerfil.map((m) => ({
      ...m,
      profiles: perfilesMap.get(m.remitente_id) ?? null,
    } as MensajeEvento));

    // Necesitamos cargar el nombre del usuario al que se le responde si hay reply_to_id
    const mensajesMap = new Map(mensajesProcesados.map((m) => [m.id, m]));
    mensajesConPerfil = mensajesConPerfil.map((m) => {
      if (m.reply_to_id && mensajesMap.has(m.reply_to_id)) {
        const parentMsg = mensajesMap.get(m.reply_to_id);
        if (parentMsg && parentMsg.profiles) {
          m.reply_to = { profiles: parentMsg.profiles };
        }
      }
      return m;
    });
    
    setMensajes(mensajesConPerfil);
  }, [eventoId]);

  // Cargar al montar o cuando cambia el eventoId
  useEffect(() => {
    if (!eventoId) { setMensajes([]); return; }
    cargarMensajes();
  }, [eventoId, cargarMensajes]);

  // Suscripción Realtime para mensajes en tiempo real
  useEffect(() => {
    if (!eventoId) return;

    const channel = supabase
      .channel(`mensajes-evento-${eventoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_evento',
          filter: `evento_id=eq.${eventoId}`,
        },
        async (payload) => {
          const nuevoRaw = payload.new as RawMensajeEvento;
          const nuevo = normalizeMensaje(nuevoRaw);

          const { data: perfilData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', nuevo.remitente_id)
            .maybeSingle();

          setMensajes((prev) => {
            if (prev.some((m) => m.id === nuevo.id)) return prev;

            const msgToInsert = { ...nuevo, profiles: perfilData, likes: [{ count: 0 }] } as MensajeEvento;

            if (msgToInsert.reply_to_id) {
              const parentMsg = prev.find(p => p.id === msgToInsert.reply_to_id);
              if (parentMsg && parentMsg.profiles) {
                msgToInsert.reply_to = { profiles: parentMsg.profiles };
              }
            }

            return [...prev, msgToInsert];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventoId]);

  const enviarMensaje = async (contenido: string, replyToId?: string): Promise<boolean> => {
    if (!eventoId) return false;

    const texto = contenido.trim();
    if (!texto) {
      setError('El mensaje no puede estar vacío.');
      return false;
    }
    if (texto.length > 500) {
      setError('El mensaje no puede superar los 500 caracteres.');
      return false;
    }

    setEnviando(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Debes iniciar sesión para enviar un mensaje.');
      setEnviando(false);
      return false;
    }

    const insertMensaje = async (fieldName: 'contenido' | 'mensaje') => {
      const payload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        evento_id: eventoId,
        remitente_id: user.id,
        [fieldName]: texto,
        reply_to_id: replyToId || null,
      };
      console.debug('[enviarMensaje] insert payload:', payload);

      // Validate replyToId if provided
      if (replyToId) {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(String(replyToId))) {
          console.warn('[enviarMensaje] replyToId no es un UUID válido:', replyToId);
          // clear replyToId to avoid 400 from PostgREST
          payload.reply_to_id = null;
        }
      }

      try {
        // Insert and rely on Realtime subscription to receive the new message
        const res = await supabase.from('mensajes_evento').insert(payload as Record<string, unknown>);
        console.debug('[enviarMensaje] insert response:', res);
        return res;
      } catch (ex) {
        console.error('[enviarMensaje] insert threw:', ex);
        throw ex;
      }
    };

    let insertResult = await insertMensaje('mensaje');
    if (insertResult.error && (
      insertResult.error.code === '42703' ||
      insertResult.error.code === 'PGRST204' ||
      insertResult.error.message?.includes('mensaje') ||
      insertResult.error.message?.includes("Could not find the 'mensaje' column")
    )) {
      insertResult = await insertMensaje('contenido');
    }

    console.debug('[enviarMensaje] final insertResult:', insertResult);

    setEnviando(false);
    if (insertResult.error) {
      console.error('Error enviando comentario:', insertResult.error);
      setError(`Error al enviar el comentario: ${insertResult.error.message}`);
      return false;
    }
    return true;
  };

  const pendingLikesRef = useRef<Record<string, boolean>>({});

  const toggleLikeMensaje = async (mensajeId: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    console.debug('[toggleLikeMensaje] session:', session);
    if (!session?.user) {
      console.warn('[toggleLikeMensaje] no session user');
      return false;
    }

    // Prevent concurrent operations on the same mensajeId
    if (pendingLikesRef.current[mensajeId]) {
      console.debug('[toggleLikeMensaje] already pending for', mensajeId);
      return false;
    }
    pendingLikesRef.current[mensajeId] = true;

    const { data: existingLike, error: existingLikeError } = await supabase
      .from('likes_mensaje')
      .select('mensaje_id')
      .eq('mensaje_id', mensajeId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existingLikeError) {
      console.error('Error comprobando like_mensaje existente:', existingLikeError);
      // Si no podemos comprobar el like existente, proseguimos con la inserción.
    }

    if (existingLike) {
      const { error } = await supabase
        .from('likes_mensaje')
        .delete()
        .eq('mensaje_id', mensajeId)
        .eq('user_id', session.user.id);
      pendingLikesRef.current[mensajeId] = false;
      return !error;
    }

    // Use RPC that inserts using auth.uid() to satisfy RLS policies
    const { error } = await supabase.rpc('insert_like_mensaje', { p_mensaje_id: mensajeId });

    if (error) {
      if (error.code === '23505' || ('status' in error && error.status === 409)) {
        pendingLikesRef.current[mensajeId] = false;
        return true;
      }
      console.error('Error insertando like_mensaje:', error);
      pendingLikesRef.current[mensajeId] = false;
      return false;
    }
    pendingLikesRef.current[mensajeId] = false;
    return true;
  };

  const getMensajeLikes = async (mensajeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { count } = await supabase
      .from('likes_mensaje')
      .select('*', { count: 'exact', head: true })
      .eq('mensaje_id', mensajeId);
      
    let userLiked = false;
    if (session?.user) {
      const { data } = await supabase
        .from('likes_mensaje')
        .select('mensaje_id')
        .eq('mensaje_id', mensajeId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      userLiked = !!data;
    }
    
    return { count: count || 0, userLiked };
  };

  const resetError = useCallback(() => setError(null), []);

  return { mensajes, cargando, enviando, error, enviarMensaje, toggleLikeMensaje, getMensajeLikes, resetError };
}
