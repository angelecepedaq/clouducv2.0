// Formulario de edición de evento — bottom sheet con campos pre-llenados
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import type { Categoria, EventoRow } from '@/types/types';
import { useEditarEvento } from '@/hooks/useEditarEvento';
import { supabase } from '@/db/supabase';
import { compressImage } from '@/utils/imageUtils';

type CategoriaEvento = Exclude<Categoria, 'Todos'>;

interface FormularioEditarEventoProps {
  abierto: boolean;
  evento: EventoRow | null;
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

const inputClass =
  'w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-purple-400/60';

const gradBtn = 'linear-gradient(135deg, #f59e0b, #d97706)';

// Helpers para extraer fecha y hora de un ISO timestamp
function extractDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return '';
  }
}

function extractTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toTimeString().slice(0, 5); // HH:MM
  } catch {
    return '';
  }
}

const FormularioEditarEvento: FC<FormularioEditarEventoProps> = ({
  abierto,
  evento,
  onCerrar,
  onExito,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoriaEvento | ''>('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState(false);
  const { guardando, error: errorServidor, editarEvento, resetError } = useEditarEvento();
  const primerCampoRef = useRef<HTMLInputElement>(null);

  // Pre-llenar campos al abrir con los datos del evento
  useEffect(() => {
    if (abierto && evento) {
      setTitle(evento.title);
      setCategory(evento.category as CategoriaEvento);
      setFecha(extractDate(evento.start_date));
      setHora(extractTime(evento.start_date));
      setDescription(evento.description ?? '');
      setLocation(evento.location ?? '');
      setImagenPreview(evento.imagen ?? null);
      setErrores({});
      setExito(false);
      resetError();
      setTimeout(() => primerCampoRef.current?.focus(), 150);
    }
  }, [abierto, evento]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'El título es requerido';
    if (!category) e.category = 'Selecciona una categoría';
    if (!fecha.trim()) e.fecha = 'La fecha es requerida';
    if (!hora.trim()) e.hora = 'La hora es requerida';
    if (!description.trim()) e.description = 'La descripción es requerida';
    else if (description.trim().length > 1000) e.description = 'La descripción no puede superar los 1000 caracteres';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErrores((prev) => ({ ...prev, imagen: 'Por favor selecciona una imagen válida' }));
      return;
    }
    setImagenFile(f);
    setImagenPreview(URL.createObjectURL(f));
    limpiarError('imagen');
  };

  const handleRemoveImage = () => {
    setImagenFile(null);
    setImagenPreview(null);
    limpiarError('imagen');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!evento || !validar()) return;

    let imagenUrl: string | undefined = undefined;

        if (imagenFile) {
      try {
        setSubiendoImagen(true);
        let fileToUpload = imagenFile;
        const maxSizeMB = 1;
            try {
              fileToUpload = await compressImage(imagenFile, maxSizeMB, 1080);
            } catch {
              // If compression fails, fall back to original file (but enforce size limit)
              if (imagenFile.size > 5 * 1024 * 1024) {
                setErrores({ imagen: 'La imagen es demasiado grande (máximo 5MB)'});
                setSubiendoImagen(false);
                return;
              }
            }

        const extension = fileToUpload.name.split('.').pop() || 'webp';
        const filePath = `eventos/${evento.id}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('eventos')
          .upload(filePath, fileToUpload, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('eventos')
          .getPublicUrl(filePath);

        imagenUrl = publicUrl;
      } catch (err) {
        console.error('Error subiendo imagen del evento:', err);
        setErrores({ imagen: 'Error subiendo imagen. Intenta nuevamente.' });
        setSubiendoImagen(false);
        return;
      } finally {
        setSubiendoImagen(false);
      }
    }

    const ok = await editarEvento({
      id: evento.id,
      title,
      category: category as CategoriaEvento,
      fecha,
      hora,
      description,
      location: location || undefined,
      ...(imagenUrl ? { imagen: imagenUrl } : {}),
    });

    if (ok) {
      setExito(true);
      setTimeout(() => {
        onExito();
        onCerrar();
      }, 1300);
    }
  };

  const limpiarError = (campo: string) =>
    setErrores((prev) => { const n = { ...prev }; delete n[campo]; return n; });

  if (!abierto || !evento) return null;

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
        {/* Asa móvil */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              {/* Ícono lápiz */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: gradBtn }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-white font-bold text-lg">Editar Evento</h2>
            </div>
            <p className="text-lavender text-xs mt-0.5 truncate max-w-[220px]">
              {evento.title}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Separador */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />

        {/* Pantalla de éxito */}
        {exito && (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base">¡Evento actualizado!</p>
              <p className="text-lavender text-sm mt-1">Los cambios fueron guardados exitosamente</p>
            </div>
          </div>
        )}

        {/* Formulario */}
        {!exito && (
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 hide-scrollbar" noValidate>
            <div className="px-5 py-4 flex flex-col gap-4 pb-48 mb-12">

              {/* Error servidor */}
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
                  Título del evento <span style={{ color: '#f59e0b' }}>*</span>
                </label>
                <input
                  ref={primerCampoRef}
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); limpiarError('title'); }}
                  placeholder="Ej: Conferencia de Inteligencia Artificial"
                  className={inputClass}
                  style={inputStyle}
                />
                {errores.title && (
                  <p className="text-red-300 text-xs mt-1">{errores.title}</p>
                )}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Categoría <span style={{ color: '#f59e0b' }}>*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIAS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setCategory(cat); limpiarError('category'); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                      style={
                        category === cat
                          ? { background: gradBtn, color: '#fff' }
                          : {
                              backgroundColor: 'rgba(255,255,255,0.07)',
                              color: 'rgba(255,255,255,0.6)',
                              border: '1px solid rgba(255,255,255,0.12)',
                            }
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {errores.category && (
                  <p className="text-red-300 text-xs mt-1">{errores.category}</p>
                )}
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-normal text-white/80 mb-1.5">
                    Fecha <span style={{ color: '#f59e0b' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => { setFecha(e.target.value); limpiarError('fecha'); }}
                    className={inputClass}
                    style={inputStyle}
                  />
                  {errores.fecha && (
                    <p className="text-red-300 text-xs mt-1">{errores.fecha}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-normal text-white/80 mb-1.5">
                    Hora <span style={{ color: '#f59e0b' }}>*</span>
                  </label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => { setHora(e.target.value); limpiarError('hora'); }}
                    className={inputClass}
                    style={inputStyle}
                  />
                  {errores.hora && (
                    <p className="text-red-300 text-xs mt-1">{errores.hora}</p>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-normal text-white/80">
                    Descripción del evento <span style={{ color: '#f59e0b' }}>*</span>
                  </label>
                  <span className={`text-xs ${description.length > 1000 ? 'text-red-400' : 'text-white/40'}`}>
                    {description.length}/1000
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); limpiarError('description'); }}
                  placeholder="Describe el evento..."
                  className={inputClass + " resize-none min-h-[100px]"}
                  style={inputStyle}
                  maxLength={1000}
                />
                {errores.description && (
                  <p className="text-red-300 text-xs mt-1">{errores.description}</p>
                )}
              </div>

              {/* Dirección / Ubicación */}
              <div>
                <label className="block text-sm font-normal text-white/80 mb-1.5">
                  Dirección / Ubicación <span className="text-white/35">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Aula Magna UCV, Caracas"
                  className={inputClass}
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
                      htmlFor="evento-edit-imagen-upload"
                      className="inline-flex w-full max-w-[220px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                      Seleccionar imagen
                    </label>
                    <input
                      id="evento-edit-imagen-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    {errores.imagen && (
                      <p className="text-red-300 text-xs mt-1">{errores.imagen}</p>
                    )}
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
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-3 pb-4 md:pb-8">
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || subiendoImagen}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: guardando ? 'rgba(245,158,11,0.4)' : gradBtn }}
                >
                  {guardando ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
                        style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}
                      />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="17 21 17 13 7 13 7 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="7 3 7 8 15 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Guardar Cambios
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

export default FormularioEditarEvento;
