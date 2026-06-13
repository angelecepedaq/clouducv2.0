// Hook para crear nuevos eventos en Supabase
import { useState } from 'react';
import { supabase } from '@/db/supabase';
import type { Categoria } from '@/types/types';

export interface NuevoEventoInput {
  title: string;
  category: Exclude<Categoria, 'Todos'>;
  fecha: string;   // date string from input type="date" (YYYY-MM-DD)
  hora: string;    // time string from input type="time" (HH:MM)
  description: string;
  location?: string;
  id?: string; // optional pre-generated id
  imagen?: string | null; // optional public URL
}

interface UseCrearEventoResult {
  guardando: boolean;
  error: string | null;
  crearEvento: (datos: NuevoEventoInput) => Promise<boolean>;
  resetError: () => void;
}

export function useCrearEvento(): UseCrearEventoResult {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crearEvento = async (datos: NuevoEventoInput): Promise<boolean> => {
    setGuardando(true);
    setError(null);

    // Obtener el usuario autenticado para el user_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Debes iniciar sesión para crear un evento.');
      setGuardando(false);
      return false;
    }

    // Combinar fecha + hora en un timestamp ISO para start_date
    const startDateObj = new Date(`${datos.fecha.trim()}T${datos.hora.trim()}`);
    const startDate = startDateObj.toISOString();

    // Como la base de datos requiere obligatoriamente un end_date, asumiremos
    // por defecto que los eventos duran 2 horas.
    const endDateObj = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000);
    const endDate = endDateObj.toISOString();

    const eventoId = datos.id ?? crypto.randomUUID();

    const insertPayload: Record<string, unknown> = {
      id: eventoId,
      title: datos.title.trim(),
      category: datos.category,
      description: datos.description.trim(),
      start_date: startDate,
      end_date: endDate,
      user_id: user.id,
      location: datos.location?.trim() || null,
    };

    if (Object.prototype.hasOwnProperty.call(datos, 'imagen')) {
      insertPayload.imagen = datos.imagen ?? null;
    }

    const { error: supabaseError } = await supabase.from('eventos').insert(insertPayload);

    setGuardando(false);

    if (supabaseError) {
      console.error('Error Supabase (Insert):', supabaseError);
      setError(supabaseError.message || 'Error al crear el evento en la base de datos.');
      return false;
    }

    return true;
  };

  const resetError = () => setError(null);

  return { guardando, error, crearEvento, resetError };
}
