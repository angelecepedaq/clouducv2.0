// Modal de autenticación — Login y Registro (bottom sheet)
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import type { FC, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ModalAuthProps {
  abierto: boolean;
  onCerrar: () => void;
  tabInicial?: 'login' | 'registro';
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#fff',
  borderRadius: '0.75rem',
};
const inputClass = 'w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-purple-400/60';

const ModalAuth: FC<ModalAuthProps> = ({ abierto, onCerrar, tabInicial = 'login' }) => {
  const { signInWithUsername, signUpWithUsername, resetPasswordForEmail } = useAuth();
  const [tab, setTab] = useState<'login' | 'registro' | 'recuperar'>(tabInicial);

  // Estado login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginCargando, setLoginCargando] = useState(false);

  // Estado recuperar
  const [recupEmail, setRecupEmail] = useState('');
  const [recupError, setRecupError] = useState<string | null>(null);
  const [recupExito, setRecupExito] = useState(false);
  const [recupCargando, setRecupCargando] = useState(false);

  // Estado registro
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConf, setRegPassConf] = useState('');
  const [regAcuerdo, setRegAcuerdo] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regCargando, setRegCargando] = useState(false);

  const primerInputRef = useRef<HTMLInputElement>(null);

  // Reset y focus al abrir
  useEffect(() => {
    if (abierto) {
      setTab(tabInicial);
      setLoginUser(''); setLoginPass(''); setLoginError(null);
      setRecupEmail(''); setRecupError(null); setRecupExito(false);
      setRegUser(''); setRegEmail(''); setRegPass(''); setRegPassConf(''); setRegAcuerdo(false); setRegError(null);
      setTimeout(() => primerInputRef.current?.focus(), 150);
    }
  }, [abierto, tabInicial]);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginError('Por favor completa todos los campos');
      return;
    }
    setLoginCargando(true);
    setLoginError(null);
    const { error } = await signInWithUsername(loginUser.trim(), loginPass);
    setLoginCargando(false);
    if (error) { setLoginError(error); return; }
    onCerrar();
  };

  const handleRegistro = async (e: FormEvent) => {
    e.preventDefault();
    if (!regUser.trim() || !regEmail.trim() || !regPass || !regPassConf) {
      setRegError('Por favor completa todos los campos');
      return;
    }
    // Validar email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setRegError('Por favor ingresa un correo electrónico válido');
      return;
    }
    // Validar solo letras, dígitos y _
    if (!/^[a-zA-Z0-9_]+$/.test(regUser.trim())) {
      setRegError('El usuario solo puede contener letras, números y _');
      return;
    }
    if (regPass !== regPassConf) { setRegError('Las contraseñas no coinciden'); return; }
    if (regPass.length < 6) { setRegError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!regAcuerdo) { setRegError('Debes aceptar el Acuerdo de Usuario y la Política de Privacidad'); return; }

    setRegCargando(true);
    setRegError(null);
    const { error, needsEmailConfirmation } = await signUpWithUsername(regUser.trim(), regEmail.trim(), regPass);
    setRegCargando(false);
    
    if (error) { setRegError(error); return; }
    
    if (needsEmailConfirmation) {
      toast.success('Cuenta creada. Por favor verifica tu correo electrónico para iniciar sesión.', { duration: 6000 });
    } else {
      toast.success('Cuenta creada exitosamente');
    }
    
    onCerrar();
  };

  const handleRecuperar = async (e: FormEvent) => {
    e.preventDefault();
    if (!recupEmail.trim()) {
      setRecupError('Por favor ingresa tu correo electrónico');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recupEmail.trim())) {
      setRecupError('Por favor ingresa un correo electrónico válido');
      return;
    }
    
    setRecupCargando(true);
    setRecupError(null);
    setRecupExito(false);
    const { error } = await resetPasswordForEmail(recupEmail.trim());
    setRecupCargando(false);
    if (error) { setRecupError(error); return; }
    setRecupExito(true);
  };

  if (!abierto) return null;

  const gradBtn = 'linear-gradient(135deg, #d946ef, #a855f7)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center py-0 md:py-4 md:pb-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div
        className="w-full md:max-w-[390px] rounded-t-3xl md:rounded-3xl flex flex-col relative bg-transparent mt-8 md:mt-0"
        style={{
          maxHeight: '92dvh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
          <div className="bg-ucv-purple-dark rounded-t-3xl md:rounded-3xl border border-white/10 flex flex-col h-full shadow-2xl overflow-hidden relative"
             style={{ backgroundColor: 'hsl(258 62% 22%)' }}>
        {/* Asa (solo móvil) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-20 h-20 -my-3 flex items-center justify-center bg-transparent overflow-hidden shrink-0 relative">
              <Image
                src="/images/logo/imgucv.png"
                alt="Logo UCV"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {tab === 'login' ? 'Iniciar sesión' : tab === 'registro' ? 'Crear cuenta' : 'Recuperar Contraseña'}
              </h2>
              <p className="text-lavender text-xs mt-0.5">Cloud UCV — Eventos Universitarios</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        {tab !== 'recuperar' && (
          <div className="mx-5 mb-4 flex rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
            {(['login', 'registro'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-sm font-semibold transition-all rounded-xl"
                style={
                  tab === t
                    ? { background: gradBtn, color: '#fff' }
                    : { color: 'rgba(255,255,255,0.55)' }
                }
              >
                {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>
        )}

        {/* Separador */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />

        {/* Formulario scrollable */}
        <div className="overflow-y-auto flex-1 px-5 pt-4 hide-scrollbar">

          {/* ——— TAB: LOGIN ——— */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4 pb-48 mb-12">
              {loginError && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <p className="text-red-300 text-sm">{loginError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">Correo electrónico</label>
                <input
                  ref={primerInputRef}
                  type="email"
                  value={loginUser}
                  onChange={(e) => { setLoginUser(e.target.value); setLoginError(null); }}
                  placeholder="Ingresa tu correo electrónico"
                  className={inputClass}
                  style={inputStyle}
                  autoCapitalize="none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-normal text-white/80">Contraseña</label>
                  <button type="button" onClick={() => setTab('recuperar')} className="text-xs font-medium transition-colors hover:text-white" style={{ color: '#d946ef' }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => { setLoginPass(e.target.value); setLoginError(null); }}
                  placeholder="Ingresa tu contraseña"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={loginCargando}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 mt-1"
                style={{ background: loginCargando ? 'rgba(217,70,239,0.4)' : gradBtn }}
              >
                {loginCargando ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: 'rgba(255,255,255,0.6)', borderTopColor: 'transparent' }} />
                    Entrando...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="10 17 15 12 10 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="15" y1="12" x2="3" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Iniciar sesión
                  </>
                )}
              </button>

              <p className="text-center text-xs text-lavender pb-1">
                ¿No tienes cuenta?{' '}
                <button type="button" onClick={() => setTab('registro')} className="font-semibold" style={{ color: '#d946ef' }}>
                  Regístrate aquí
                </button>
              </p>
            </form>
          )}

          {/* ——— TAB: REGISTRO ——— */}
          {tab === 'registro' && (
            <form onSubmit={handleRegistro} noValidate className="flex flex-col gap-4 pb-48 mb-12">
              {regError && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <p className="text-red-300 text-sm">{regError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Nombre de usuario
                </label>
                <input
                  ref={tab === 'registro' ? primerInputRef : undefined}
                  type="text"
                  value={regUser}
                  onChange={(e) => { setRegUser(e.target.value); setRegError(null); }}
                  placeholder="Elige un nombre de usuario"
                  className={inputClass}
                  style={inputStyle}
                  autoCapitalize="none"
                  maxLength={30}
                />
                <p className="text-white/35 text-xs mt-1">Solo letras, números y _</p>
              </div>

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => { setRegEmail(e.target.value); setRegError(null); }}
                  placeholder="Ingresa tu correo electrónico"
                  className={inputClass}
                  style={inputStyle}
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  value={regPass}
                  onChange={(e) => { setRegPass(e.target.value); setRegError(null); }}
                  placeholder="Crea una contraseña (mín. 6 caracteres)"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">Confirmar contraseña</label>
                <input
                  type="password"
                  value={regPassConf}
                  onChange={(e) => { setRegPassConf(e.target.value); setRegError(null); }}
                  placeholder="Repite tu contraseña"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {/* Checkbox acuerdo */}
              <label className="flex items-start gap-3 cursor-pointer">
                <div
                  onClick={() => setRegAcuerdo((v) => !v)}
                  className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                  style={
                    regAcuerdo
                      ? { background: gradBtn, border: 'none' }
                      : { border: '1.5px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' }
                  }
                >
                  {regAcuerdo && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-lavender leading-relaxed">
                  Acepto el{' '}
                  <span className="font-semibold" style={{ color: '#d946ef' }}>Acuerdo de Usuario</span>
                  {' '}y la{' '}
                  <span className="font-semibold" style={{ color: '#d946ef' }}>Política de Privacidad</span>
                  {' '}de Cloud UCV
                </span>
              </label>

              <button
                type="submit"
                disabled={regCargando}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 mt-1"
                style={{ background: regCargando ? 'rgba(217,70,239,0.4)' : gradBtn }}
              >
                {regCargando ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: 'rgba(255,255,255,0.6)', borderTopColor: 'transparent' }} />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2"/>
                      <line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Crear cuenta
                  </>
                )}
              </button>

            </form>
          )}

          {/* ——— TAB: RECUPERAR ——— */}
          {tab === 'recuperar' && (
            <form onSubmit={handleRecuperar} noValidate className="flex flex-col gap-4 pb-48 mb-12">
              {recupError && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <p className="text-red-300 text-sm">{recupError}</p>
                </div>
              )}

              {recupExito && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-emerald-300 text-sm">Se ha enviado un enlace de recuperación a tu correo electrónico</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">Correo electrónico</label>
                <input
                  ref={tab === 'recuperar' ? primerInputRef : undefined}
                  type="email"
                  value={recupEmail}
                  onChange={(e) => { setRecupEmail(e.target.value); setRecupError(null); }}
                  placeholder="Ingresa tu correo electrónico"
                  className={inputClass}
                  style={inputStyle}
                  autoCapitalize="none"
                />
                <p className="text-white/40 text-xs mt-2 text-pretty">Te enviaremos un enlace para que puedas restablecer tu contraseña.</p>
              </div>

              <button
                type="submit"
                disabled={recupCargando || recupExito}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 mt-1"
                style={{ background: recupCargando || recupExito ? 'rgba(217,70,239,0.4)' : gradBtn }}
              >
                {recupCargando ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: 'rgba(255,255,255,0.6)', borderTopColor: 'transparent' }} />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Enviar enlace de recuperación
                  </>
                )}
              </button>

              <p className="text-center text-xs text-lavender pb-1">
                ¿Recordaste tu contraseña?{' '}
                <button type="button" onClick={() => setTab('login')} className="font-semibold" style={{ color: '#d946ef' }}>
                  Inicia sesión
                </button>
              </p>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ModalAuth;