// Página Perfil - Cloud UCV con autenticación real, edición y eliminación de eventos propios
import Image from 'next/image';
import { useState, useEffect, useRef, type FC } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { EventoRow } from '@/types/types';
import ModalAuth from '@/components/ucv/ModalAuth';
import FormularioEditarEvento from '@/components/ucv/FormularioEditarEvento';
import DialogoConfirmarEliminar from '@/components/ucv/DialogoConfirmarEliminar';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageUtils';

type TabType = 'creados' | 'guardados';

// Helpers
function formatFechaCorta(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return isoDate; }
}

function formatHora(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const PerfilPagina: FC = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [authAbierto, setAuthAbierto] = useState(false);
  const [tabActual, setTabActual] = useState<TabType>('guardados');
  const [misEventos, setMisEventos] = useState<EventoRow[]>([]);
  const [eventosGuardados, setEventosGuardados] = useState<EventoRow[]>([]);
  const [cargandoEventos, setCargandoEventos] = useState(false);

  // Estado para editar username
  const [editandoUsername, setEditandoUsername] = useState(false);
  const [nuevoUsername, setNuevoUsername] = useState('');
  const [guardandoUsername, setGuardandoUsername] = useState(false);

  // Estado para avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [progresoAvatar, setProgresoAvatar] = useState(0);

  // Estado para editar evento
  const [eventoEditar, setEventoEditar] = useState<EventoRow | null>(null);
  const [editarAbierto, setEditarAbierto] = useState(false);

  // Estado para eliminar
  const [eventoEliminarId, setEventoEliminarId] = useState<string | null>(null);
  const [eventoEliminarTitulo, setEventoEliminarTitulo] = useState('');
  const [eliminarAbierto, setEliminarAbierto] = useState(false);

  const cargarEventos = async () => {
    if (!user) { 
      setMisEventos([]); 
      setEventosGuardados([]);
      return; 
    }
    setCargandoEventos(true);
    
    try {
      // 1. Cargar eventos creados
      const { data: dataCreados } = await supabase
        .from('eventos')
        .select('id, title, description, category, location, start_date, end_date, user_id, created_at, updated_at, imagen')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      setMisEventos(Array.isArray(dataCreados) ? (dataCreados as EventoRow[]) : []);

      // 2. Cargar eventos guardados
      const { data: dataGuardados } = await supabase
        .from('eventos_guardados')
        .select('evento_id, created_at, eventos(id, title, description, category, location, start_date, end_date, user_id, created_at, updated_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (Array.isArray(dataGuardados)) {
        const eventosExtractados = dataGuardados
          .filter(g => g.eventos)
          .map(g => {
            const ev = g.eventos as unknown as EventoRow;
            return ev;
          });
          
        // Ordenar: eventos futuros primero
        eventosExtractados.sort((a, b) => {
          const dateA = new Date(a.start_date).getTime();
          const dateB = new Date(b.start_date).getTime();
          const now = Date.now();
          const aIsFuture = dateA >= now;
          const bIsFuture = dateB >= now;
          
          if (aIsFuture && !bIsFuture) return -1;
          if (!aIsFuture && bIsFuture) return 1;
          if (aIsFuture && bIsFuture) return dateA - dateB;
          return dateB - dateA;
        });
        
        setEventosGuardados(eventosExtractados);
      } else {
        setEventosGuardados([]);
      }
    } catch (e) {
      console.error('Error al cargar eventos:', e);
    } finally {
      setCargandoEventos(false);
    }
  };

  useEffect(() => {
    cargarEventos();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditar = (ev: EventoRow) => {
    setEventoEditar(ev);
    setEditarAbierto(true);
  };

  const abrirEliminar = (ev: EventoRow) => {
    setEventoEliminarId(ev.id);
    setEventoEliminarTitulo(ev.title);
    setEliminarAbierto(true);
  };

  const onEditarExito = () => {
    toast.success('Evento actualizado exitosamente');
    cargarEventos();
  };

  const onEliminarExito = () => {
    toast.success('Evento eliminado exitosamente');
    cargarEventos();
  };

  const iniciales = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : '??';

  const coloresCat: Record<string, string> = {
    Académicos: '#3B82F6',
    Culturales: '#D946EF',
    Deportivos: '#10B981',
    Comerciales: '#F59E0B',
  };

  const handleGuardarUsername = async () => {
    if (!user || !nuevoUsername.trim() || nuevoUsername.trim() === profile?.username) {
      setEditandoUsername(false);
      return;
    }
    
    setGuardandoUsername(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: nuevoUsername.trim() })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Este nombre de usuario ya está en uso');
        }
        throw error;
      }
      
      await refreshProfile();
      toast.success('Nombre de usuario actualizado');
      setEditandoUsername(false);
    } catch (err: unknown) {
      console.error('Error al actualizar username:', err);
      const mensaje = err instanceof Error ? err.message : 'No se pudo actualizar el nombre de usuario';
      toast.error(mensaje);
    } finally {
      setGuardandoUsername(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    setSubiendoAvatar(true);
    setProgresoAvatar(10);
    
    try {
      let fileToUpload = file;
      const maxSizeMB = 1;
      
      setProgresoAvatar(30);
      try {
        fileToUpload = await compressImage(file, maxSizeMB, 1080);
      } catch (err) {
        console.warn('Fallo compresión local, subiendo original si es menor a 5MB', err);
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('La imagen es demasiado grande (máximo 5MB sin compresión)');
        }
      }
      
      setProgresoAvatar(50);
      const extension = fileToUpload.name.split('.').pop() || 'webp';
      const filePath = `${user.id}/${Date.now()}.${extension}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;
      
      setProgresoAvatar(75);
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      setProgresoAvatar(100);
      await refreshProfile();
      toast.success('Foto de perfil actualizada exitosamente');
    } catch (err: unknown) {
      console.error('Error al subir avatar:', err);
      const mensaje = err instanceof Error ? err.message : 'Error al actualizar foto de perfil';
      toast.error(mensaje);
    } finally {
      setSubiendoAvatar(false);
      setProgresoAvatar(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ——— ESTADO: NO AUTENTICADO ———
  if (!user) {
    return (
      <>
        <div className="flex-1 overflow-y-auto min-w-0 flex flex-col items-center justify-center px-6 gap-6 py-16">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(217,70,239,0.15), rgba(168,85,247,0.15))', border: '2px solid rgba(217,70,239,0.3)' }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="rgba(217,70,239,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke="rgba(217,70,239,0.8)" strokeWidth="1.8"/>
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-white font-bold text-xl text-balance">Tu perfil te espera</h2>
            <p className="text-lavender text-sm mt-2 text-pretty">
              Inicia sesión para ver tu perfil, gestionar tus eventos creados y acceder a todas las funciones de Cloud UCV.
            </p>
          </div>
          <button
            onClick={() => setAuthAbierto(true)}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)', boxShadow: '0 4px 20px rgba(217,70,239,0.4)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="10 17 15 12 10 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="15" y1="12" x2="3" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Iniciar sesión
          </button>
        </div>
        <ModalAuth abierto={authAbierto} onCerrar={() => setAuthAbierto(false)} />
      </>
    );
  }

  // ——— ESTADO: AUTENTICADO ———
  return (
    <>
      <div className="flex-1 overflow-y-auto min-w-0 pb-4">
        {/* Banner + Avatar */}
        <div className="relative">
          <div
            className="h-28 w-full"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #d946ef 50%, #06b6d4 100%)' }}
          />
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 group">
            <div
              className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold text-white shadow-card overflow-hidden relative cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)', borderColor: 'hsl(258 62% 25%)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {profile?.avatar_url ? (
                <div className="relative w-full h-full">
                  <Image
                    src={profile.avatar_url}
                    alt={profile.username}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                iniciales
              )}
              
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              
              {subiendoAvatar && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                  <span className="text-[10px] font-bold">{progresoAvatar}%</span>
                </div>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Info usuario */}
        <div className="pt-14 px-4 flex flex-col items-center">
          {editandoUsername ? (
            <div className="flex items-center gap-2 max-w-xs w-full">
              <input 
                type="text" 
                value={nuevoUsername}
                onChange={(e) => setNuevoUsername(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white text-center text-sm outline-none focus:border-purple-400"
                placeholder="Nuevo usuario"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleGuardarUsername()}
              />
              <button 
                onClick={handleGuardarUsername}
                disabled={guardandoUsername}
                className="w-8 h-8 flex items-center justify-center bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors"
              >
                {guardandoUsername ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <button 
                onClick={() => setEditandoUsername(false)}
                disabled={guardandoUsername}
                className="w-8 h-8 flex items-center justify-center bg-white/10 text-white/70 rounded-xl hover:bg-white/20 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-white font-bold text-xl text-balance">{profile?.username ?? 'Usuario'}</h2>
              <button 
                onClick={() => {
                  setNuevoUsername(profile?.username || '');
                  setEditandoUsername(true);
                }}
                className="text-white/40 hover:text-white/80 transition-colors active:scale-90"
                aria-label="Editar nombre de usuario"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
          
          <p className="text-lavender text-sm mt-0.5">Estudiante UCV</p>
          <div
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: 'rgba(217,70,239,0.15)', color: '#e879f9', border: '1px solid rgba(217,70,239,0.3)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
            Sesión activa
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mx-4 mt-5 rounded-2xl ucv-card-bg p-4 grid grid-cols-2 divide-x divide-white/10">
          <div className="flex flex-col items-center gap-1 px-2">
            <span className="text-white font-bold text-xl">{misEventos.length}</span>
            <span className="text-lavender text-[10px] text-center leading-tight">Eventos creados</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <span className="text-white font-bold text-xl capitalize">{profile?.role ?? 'user'}</span>
            <span className="text-lavender text-[10px] text-center leading-tight">Rol</span>
          </div>
        </div>

        {/* Selector de Tabs */}
        <div className="mx-4 mt-6">
          <div className="flex bg-white/5 rounded-xl p-1 mb-4 border border-white/10">
            <button
              onClick={() => setTabActual('guardados')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tabActual === 'guardados' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-lavender hover:text-white hover:bg-white/5'
              }`}
            >
              Guardados ({eventosGuardados.length})
            </button>
            <button
              onClick={() => setTabActual('creados')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tabActual === 'creados' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-lavender hover:text-white hover:bg-white/5'
              }`}
            >
              Mis Creados ({misEventos.length})
            </button>
          </div>
          
          {/* Cargando */}
          {cargandoEventos && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(217,70,239,0.6)', borderTopColor: 'transparent' }} />
              <span className="text-lavender text-sm">Cargando eventos...</span>
            </div>
          )}

          {/* Tab: Eventos Guardados */}
          {!cargandoEventos && tabActual === 'guardados' && (
            <div className="flex flex-col gap-2">
              {eventosGuardados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl ucv-card-bg">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path d="M19 21L12 16L5 21V5C5 4.45 5.45 4 6 4H18C18.55 4 19 4.45 19 5V21Z" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-lavender text-sm text-center">
                    Aún no has guardado eventos.<br/>
                    <span style={{ color: '#d946ef' }}>Guarda los que te interesen para verlos aquí.</span>
                  </p>
                </div>
              ) : (
                eventosGuardados.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 rounded-2xl ucv-card-bg p-3"
                  >
                    {/* Indicador de categoría */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                         style={{ backgroundColor: `${coloresCat[ev.category] ?? '#a855f7'}22` }}>
                      <span className="text-2xl">
                        {ev.category === 'Académicos' ? '🎓' : ev.category === 'Culturales' ? '🎵' : ev.category === 'Deportivos' ? '⚽' : '💼'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{ev.title}</p>
                      <p className="text-lavender text-xs mt-0.5 truncate">{formatFechaCorta(ev.start_date)} · {formatHora(ev.start_date)}</p>
                      <div
                        className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${coloresCat[ev.category] ?? '#a855f7'}22`,
                          color: coloresCat[ev.category] ?? '#a855f7',
                          border: `1px solid ${coloresCat[ev.category] ?? '#a855f7'}44`,
                        }}
                      >
                        {ev.category}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Mis eventos creados */}
          {!cargandoEventos && tabActual === 'creados' && (
            <div className="flex flex-col gap-2">
              {misEventos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl ucv-card-bg">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8"/>
                    <line x1="16" y1="2" x2="16" y2="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="8" y1="2" x2="8" y2="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="3" y1="10" x2="21" y2="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8"/>
                  </svg>
                  <p className="text-lavender text-sm text-center">
                    Aún no has creado eventos.<br/>
                    <span style={{ color: '#d946ef' }}>¡Crea el primero desde Inicio!</span>
                  </p>
                </div>
              ) : (
                misEventos.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 rounded-2xl ucv-card-bg p-3"
                  >
                    {/* Indicador de categoría */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                         style={{ backgroundColor: `${coloresCat[ev.category] ?? '#a855f7'}22` }}>
                      <span className="text-2xl">
                        {ev.category === 'Académicos' ? '🎓' : ev.category === 'Culturales' ? '🎵' : ev.category === 'Deportivos' ? '⚽' : '💼'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{ev.title}</p>
                      <p className="text-lavender text-xs mt-0.5 truncate">{formatFechaCorta(ev.start_date)} · {formatHora(ev.start_date)}</p>
                      <div
                        className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${coloresCat[ev.category] ?? '#a855f7'}22`,
                          color: coloresCat[ev.category] ?? '#a855f7',
                          border: `1px solid ${coloresCat[ev.category] ?? '#a855f7'}44`,
                        }}
                      >
                        {ev.category}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => abrirEditar(ev)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
                        style={{ backgroundColor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
                        aria-label={`Editar evento: ${ev.title}`}
                        title="Editar evento"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                            stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                            stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      <button
                        onClick={() => abrirEliminar(ev)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
                        style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                        aria-label={`Eliminar evento: ${ev.title}`}
                        title="Eliminar evento"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <polyline points="3 6 5 6 21 6" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10 11v6M14 11v6" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Cerrar sesión */}
        <div className="mx-4 mt-4">
          <button
            onClick={signOut}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-opacity active:opacity-70 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 17 21 12 16 7" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>

      <FormularioEditarEvento
        abierto={editarAbierto}
        evento={eventoEditar}
        onCerrar={() => { setEditarAbierto(false); setEventoEditar(null); }}
        onExito={onEditarExito}
      />

      <DialogoConfirmarEliminar
        abierto={eliminarAbierto}
        eventoId={eventoEliminarId}
        eventoTitulo={eventoEliminarTitulo}
        onCerrar={() => { setEliminarAbierto(false); setEventoEliminarId(null); }}
        onExito={onEliminarExito}
      />
    </>
  );
};

export default PerfilPagina;
