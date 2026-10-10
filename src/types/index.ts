export type Rol = 'TUTOR' | 'DOCENTE' | 'DIRECTIVO' | 'ESTUDIANTE' | 'PRECEPTOR';
export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'TARDANZA';
export type Nota = 1 | 2 | 3 | 4 | 5;
export type EtiquetaComunicado = 'REUNION' | 'EXAMENES' | 'SALIDAS' | 'GENERAL';
export interface Usuario {
  id: string; ci: string; nombre_completo: string; rol: Rol;
  telefono: string | null; created_at: string;
}
export interface Estudiante {
  id: string; ci: string; nombre_completo: string; curso: string;
  especialidad: string | null; foto_url: string | null; tutor_id: string | null;
  id_link: string | null; created_at: string;
}
export interface Materia { id: string; nombre: string }
export interface PoliticaAcademica {
  anio: number; peso_etapa1: number; peso_etapa2: number; peso_proceso: number;
  minimo2: number; minimo3: number; minimo4: number; minimo5: number; confirmada: boolean;
}
export interface Puntajes {
  etapa1_puntos: number | null; etapa1_maximo: number;
  etapa2_puntos: number | null; etapa2_maximo: number;
  proceso_puntos: number | null; proceso_maximo: number;
}
export interface Calificacion extends Puntajes {
  id: string; estudiante_id: string; materia_id: string; anio: number;
  promedio: number | null; nota_final: Nota | null;
  created_at: string; updated_at: string; materia?: Materia;
}
export interface Asistencia {
  id: string; estudiante_id: string; fecha: string; hora: string;
  estado: EstadoAsistencia; registrado_por: string | null;
  created_at: string; updated_at: string; estudiante?: Estudiante;
}
export interface Comunicado {
  id: string; titulo: string; contenido: string; etiqueta: EtiquetaComunicado;
  autor: string; fecha: string; created_at: string;
}
