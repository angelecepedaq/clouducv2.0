// Componente Header de Cloud UCV con autenticación
import Image from 'next/image';
import { useState, useRef, useEffect, type FC } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ModalAuth from '@/components/ucv/ModalAuth';
import { useNotificaciones } from '@/hooks/useNotificaciones';

const Header: FC = () => {
  const { user, profile } = useAuth();
  const [authAbierto, setAuthAbierto] = useState(false);
  const [notifAbierto, setNotifAbierto] = useState(false);
  const { notificaciones, noLeidas, marcarComoLeidas } = useNotificaciones();
  
  const notifRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  // Marcar como leídas al abrir
  useEffect(() => {
    if (notifAbierto && noLeidas > 0) {
      marcarComoLeidas();
    }
  }, [notifAbierto, noLeidas, marcarComoLeidas]);

  // Iniciales del username para el avatar
  const iniciales = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo y nombre */}
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 -my-2 flex items-center justify-center bg-transparent overflow-hidden shrink-0 relative">
            <Image
              src="/images/logo/imgucv.png"
              alt="Logo UCV"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div>
            <p className="text-xs text-lavender leading-none mb-0.5">Eventos Universitarios</p>
            <p className="text-sm font-bold text-white leading-none">Cloud UCV</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {/* Campana */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setNotifAbierto(!notifAbierto)}
                className="relative w-9 h-9 rounded-full border border-white/20 flex items-center justify-center bg-white/5 active:scale-95 transition-transform"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {noLeidas > 0 && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#2a1351]"></span>
                )}
              </button>

              {/* Menú de notificaciones */}
              {notifAbierto && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl ucv-card-bg border border-white/10 shadow-2xl z-50 overflow-hidden"
                     style={{ backdropFilter: 'blur(12px)' }}>
                  <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="text-white font-semibold text-sm">Notificaciones</h3>
                    <span className="text-xs text-lavender">{notificaciones.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto hide-scrollbar">
                    {notificaciones.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-lavender">
                        No tienes notificaciones aún
                      </div>
                    ) : (
                      notificaciones.map(notif => {
                        return (
                          <div key={notif.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div className="flex gap-3 items-start">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm" 
                                   style={{ 
                                     background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' 
                                   }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-semibold leading-tight">
                                  {notif.title || 'Notificación'}
                                </p>
                                {notif.body && (
                                  <p className="text-sm text-white/70 mt-0.5 text-pretty leading-tight">
                                    {notif.body}
                                  </p>
                                )}
                                {notif.evento?.title && (
                                  <p className="text-xs text-lavender mt-0.5">
                                    Evento: &quot;{notif.evento.title}&quot;
                                  </p>
                                )}
                                <p className="text-[10px] text-lavender mt-1">
                                  {new Date(notif.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estado de sesión: login o avatar */}
          {user ? (
            // Avatar con iniciales o imagen del usuario autenticado
            profile?.avatar_url ? (
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/10">
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/10"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
                title={profile?.username ?? 'Usuario'}
              >
                {iniciales}
              </div>
            )
          ) : (
            // Botón de login para usuarios no autenticados
            <button
              onClick={() => setAuthAbierto(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-white active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="10 17 15 12 10 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="15" y1="12" x2="3" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* Modal de autenticación */}
      <ModalAuth
        abierto={authAbierto}
        onCerrar={() => setAuthAbierto(false)}
      />
    </>
  );
};

export default Header;
