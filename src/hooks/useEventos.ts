// Hook para obtener eventos desde Supabase
import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Evento, EventoRow } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';

interface UseEventosResult {
  eventos: Evento[];
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

export function useEventos(): UseEventosResult {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contador, setContador] = useState(0);

  useEffect(() => {
    let cancelado = false;

    const fetchEventos = async () => {
      setCargando(true);
      setError(null);

      // 1. Fetch de los eventos
      const { data, error: supabaseError } = await supabase
        .from('eventos')
        .select('id, title, description, category, location, start_date, end_date, user_id, created_at, updated_at, imagen')
        .order('created_at', { ascending: true });

      if (cancelado) return;

      if (supabaseError) {
        setError('No se pudieron cargar los eventos. Intenta nuevamente.');
        setCargando(false);
        return;
      }

      const rows = (Array.isArray(data) ? data : []) as EventoRow[];
      
      let likesSet = new Set<string>();
      let guardadosSet = new Set<string>();
      const likesCountMap = new Map<string, number>();

      // 2. Contar likes por evento
      if (rows.length > 0) {
        const eventIds = rows.map(r => r.id);
        const { data: likesData } = await supabase
          .from('likes_evento')
          .select('evento_id')
          .in('evento_id', eventIds);
        
        if (likesData) {
          for (const like of likesData) {
            likesCountMap.set(like.evento_id, (likesCountMap.get(like.evento_id) || 0) + 1);
          }
        }
      }

      // 3. Si hay usuario, hacer fetch de sus likes y eventos guardados
      if (user) {
        const [likesRes, guardadosRes] = await Promise.all([
          supabase.from('likes_evento').select('evento_id').eq('user_id', user.id),
          supabase.from('eventos_guardados').select('evento_id').eq('user_id', user.id)
        ]);
        
        if (likesRes.data) {
          likesSet = new Set(likesRes.data.map(r => r.evento_id));
        }
        if (guardadosRes.data) {
          guardadosSet = new Set(guardadosRes.data.map(r => r.evento_id));
        }
      }
      
      if (cancelado) return;

      // 4. Mapear al tipo Evento con el estado del usuario actual
      const eventosConEstado: Evento[] = rows.map((row) => ({
        ...row,
        likes_count: likesCountMap.get(row.id) || 0,
        guardado: guardadosSet.has(row.id),
        like_local: likesSet.has(row.id)
      }));

      setEventos(eventosConEstado);
      setCargando(false);
    };

    fetchEventos();

    return () => {
      cancelado = true;
    };
  }, [contador, user]);

  const recargar = () => setContador((c) => c + 1);

  return { eventos, cargando, error, recargar };
}
