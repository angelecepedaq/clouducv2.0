// Formulario de creación de evento — bottom sheet modal
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import type { FC, FormEvent } from 'react';
import type { Categoria } from '@/types/types';
import { useCrearEvento } from '@/hooks/useCrearEvento';
import { supabase } from '@/db/supabase';
import { compressImage } from '@/utils/imageUtils';

type CategoriaEvento = Exclude<Categoria, 'Todos'>;

interface FormularioEventoProps {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
}

const CATEGORIAS: CategoriaEvento[] = ['Académicos', 'Culturales', 'Deportivos', 'Comerciales'];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#fff',
  borderRadius: '0.75rem',
};

const inputFocusClass =
  'w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-purple-400/60';

// Estado inicial vacío del formulario
const estadoInicial = {
  title: '',
  category: '' as CategoriaEvento | '',
  fecha: '',
  hora: '',
  description: '',
  location: '',
};

const FormularioEvento: FC<FormularioEventoProps> = ({ abierto, onCerrar, onExito }) => {
  const [form, setForm] = useState(estadoInicial);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [exito, setExito] = useState(false);
  const { guardando, error: errorServidor, crearEvento, resetError } = useCrearEvento();
  const primerCampoRef = useRef<HTMLInputElement>(null);

  // Focus al abrir y reset al cerrar
  useEffect(() => {
    if (abierto) {
      setForm(estadoInicial);
      setErrores({});
      setExito(false);
      resetError();
      setTimeout(() => primerCampoRef.current?.focus(), 150);
    }
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [abierto, onCerrar]);

  const validar = (): boolean => {
    const nuevosErrores: Partial<typeof estadoInicial> = {};
    if (!form.title.trim()) nuevosErrores.title = 'El título es requerido';
    if (!form.category) nuevosErrores.category = 'Selecciona una categoría' as string & CategoriaEvento;
    if (!form.fecha) nuevosErrores.fecha = 'La fecha es requerida';
    if (!form.hora) nuevosErrores.hora = 'La hora es requerida';
    if (!form.description.trim()) nuevosErrores.description = 'La descripción es requerida';
    else if (form.description.trim().length > 1000) nuevosErrores.description = 'La descripción no puede superar los 1000 caracteres';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErrores((prev) => ({ ...prev, imagen: 'Por favor selecciona una imagen válida' }));
      return;
    }
    setImagenFile(f);
    setImagenPreview(URL.createObjectURL(f));
    setErrores((prev) => ({ ...prev, imagen: undefined }));
  };

  const handleRemoveImage = () => {
    setImagenFile(null);
    setImagenPreview(null);
    setErrores((prev) => ({ ...prev, imagen: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    // Generate an id up front so we can upload the image to a path that includes the event id
    const eventoId = crypto.randomUUID();

    let imagenUrl: string | undefined = undefined;
    if (imagenFile) {
      try {
        let fileToUpload = imagenFile;
        const maxSizeMB = 1;
        try {
          fileToUpload = await compressImage(imagenFile, maxSizeMB, 1080);
        } catch {
          if (imagenFile.size > 5 * 1024 * 1024) {
            setErrores((prev) => ({ ...prev, imagen: 'La imagen es demasiado grande (máximo 5MB)'}));
            return;
          }
        }

        const extension = fileToUpload.name.split('.').pop() || 'webp';
        const filePath = `eventos/${eventoId}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('eventos')
          .upload(filePath, fileToUpload, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('eventos')
          .getPublicUrl(filePath);

        imagenUrl = publicUrl;
      } catch (_err) {
        console.error('Error subiendo imagen:', _err);
        setErrores((prev) => ({ ...prev, imagen: 'Error subiendo imagen. Intenta nuevamente.' }));
        return;
      }
    }

    const ok = await crearEvento({
      id: eventoId,
      title: form.title,
      category: form.category as CategoriaEvento,
      fecha: form.fecha,
      hora: form.hora,
      description: form.description,
      location: form.location || undefined,
      ...(imagenUrl ? { imagen: imagenUrl } : {}),
    });

    if (ok) {
      setExito(true);
      setTimeout(() => {
        onExito();
        onCerrar();
      }, 1400);
    }
  };

  const handleChange = (field: keyof typeof estadoInicial, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errores[field]) setErrores((prev) => ({ ...prev, [field]: undefined }));
  };

  if (!abierto) return null;

  return (
    // Overlay oscuro
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center py-0 md:py-4 md:pb-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      {/* Panel / bottom sheet */}
      <div
        className="w-full md:max-w-[390px] rounded-t-3xl md:rounded-3xl flex flex-col relative bg-transparent mt-8 md:mt-0"
        style={{
          maxHeight: '92dvh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-ucv-purple-dark rounded-t-3xl md:rounded-3xl border border-white/10 flex flex-col h-full shadow-2xl overflow-hidden relative"
             style={{ backgroundColor: 'hsl(258 62% 22%)' }}>
        {/* Asa del bottom sheet (solo móvil) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Crear Nuevo Evento</h2>
            <p className="text-lavender text-xs mt-0.5">Completa los datos del evento</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            aria-label="Cerrar formulario"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Separador */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />

        {/* Estado de éxito */}
        {exito && (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base">¡Evento creado!</p>
              <p className="text-lavender text-sm mt-1">El evento fue guardado exitosamente</p>
            </div>
          </div>
        )}

        {/* Formulario scrollable */}
        {!exito && (
          <form
            onSubmit={handleSubmit}
            className="overflow-y-auto flex-1 hide-scrollbar"
            noValidate
          >
            <div className="px-5 py-4 flex flex-col gap-4 pb-64 mb-12">

              {/* Error del servidor */}
              {errorServidor && (
                <div
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <p className="text-red-300 text-sm">{errorServidor}</p>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Título del evento <span style={{ color: '#d946ef' }}>*</span>
                </label>
                <input
                  ref={primerCampoRef}
                  type="text"
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Ej: Conferencia de Inteligencia Artificial"
                  className={inputFocusClass}
                  style={inputStyle}
                  maxLength={100}
                />
                {errores.title && (
                  <p className="text-red-400 text-xs mt-1">{errores.title}</p>
                )}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Categoría <span style={{ color: '#d946ef' }}>*</span>
                </label>
                <div className="flex gap-2">
                  {CATEGORIAS.map((cat) => {
                    const activo = form.category === cat;
                    const colores: Record<CategoriaEvento, string> = {
                      Académicos: '#3B82F6',
                      Culturales: '#d946ef',
                      Deportivos: '#10B981',
                      Comerciales: '#F59E0B',
                    };
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleChange('category', cat)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                        style={
                          activo
                            ? {
                                backgroundColor: `${colores[cat]}22`,
                                border: `1.5px solid ${colores[cat]}`,
                                color: '#fff',
                              }
                            : {
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: 'rgba(255,255,255,0.6)',
                              }
                        }
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {errores.category && (
                  <p className="text-red-400 text-xs mt-1">{errores.category}</p>
                )}
              </div>

              {/* Fecha y Hora en fila */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-normal text-white/80 mb-1.5">
                    Fecha <span style={{ color: '#d946ef' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => handleChange('fecha', e.target.value)}
                    className={inputFocusClass}
                    style={inputStyle}
                  />
                  {errores.fecha && (
                    <p className="text-red-400 text-xs mt-1">{errores.fecha}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-normal text-white/80 mb-1.5">
                    Hora <span style={{ color: '#d946ef' }}>*</span>
                  </label>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={(e) => handleChange('hora', e.target.value)}
                    className={inputFocusClass}
                    style={inputStyle}
                  />
                  {errores.hora && (
                    <p className="text-red-400 text-xs mt-1">{errores.hora}</p>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-normal text-white/80">
                    Descripción del evento <span style={{ color: '#d946ef' }}>*</span>
                  </label>
                  <span className={`text-xs ${form.description.length > 1000 ? 'text-red-400' : 'text-white/40'}`}>
                    {form.description.length}/1000
                  </span>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe el evento..."
                  className={inputFocusClass + " resize-none min-h-[100px]"}
                  style={inputStyle}
                  maxLength={1000}
                />
                {errores.description && (
                  <p className="text-red-400 text-xs mt-1">{errores.description}</p>
                )}
              </div>

              {/* Dirección / Ubicación */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Dirección / Ubicación{' '}
                  <span className="text-white/40 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="Ej: Aula Magna UCV, Caracas"
                  className={inputFocusClass}
                  style={inputStyle}
                  maxLength={150}
                />
              </div>

              {/* Imagen del evento (opcional) */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Imagen del evento <span className="text-white/40">(opcional)</span>
                </label>
                <div className="flex items-center gap-3">
                  {imagenPreview ? (
                    <div className="relative w-20 h-14 rounded-md overflow-hidden">
                      <Image src={imagenPreview} alt="Preview" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="w-20 h-14 rounded-md" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
                  )}
                  <div className="flex-1">
                    <label
                      htmlFor="evento-imagen-upload"
                      className="inline-flex w-full max-w-[220px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)' }}
                    >
                      Seleccionar imagen
                    </label>
                    <input
                      id="evento-imagen-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    {imagenPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="mt-2 inline-flex w-full max-w-[220px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                      >
                        Quitar imagen
                      </button>
                    )}
                    {errores.imagen && (
                      <p className="text-red-400 text-xs mt-1">{errores.imagen}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4 pb-4 md:pb-8">
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.75)',
                  }}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: guardando
                      ? 'rgba(217,70,239,0.4)'
                      : 'linear-gradient(135deg, #d946ef, #a855f7)',
                    opacity: guardando ? 0.8 : 1,
                  }}
                >
                  {guardando ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                        style={{ borderColor: 'rgba(255,255,255,0.6)', borderTopColor: 'transparent' }}
                      />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                      </svg>
                      Guardar Evento
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};

export default FormularioEvento;
