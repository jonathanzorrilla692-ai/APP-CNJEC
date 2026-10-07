export type Rol = 'TUTOR' | 'DOCENTE' | 'DIRECTIVO' | 'ESTUDIANTE';

export type EstadoAsistencia = 'PRESENTE' | 'TARDANZA';

export type EtiquetaComunicado = 'REUNION' | 'EXAMENES' | 'SALIDAS' | 'GENERAL';

export interface Usuario {
  id: string;
  ci: string;
  nombre_completo: string;
  rol: Rol;
  telefono: string | null;
  created_at: string;
}

export interface Estudiante {
  id: string;
  ci: string;
  nombre_completo: string;
  curso: string;
  foto_url: string | null;
  tutor_id: string | null;
  id_link: string | null;
  created_at: string;
}

export interface Calificacion {
  id: string;
  estudiante_id: string;
  materia: string;
  parcial1: number;
  parcial2: number;
  parcial3: number;
  examen_final: number;
  promedio: number;
  periodo: string;
  created_at: string;
}

export interface Asistencia {
  id: string;
  estudiante_id: string;
  fecha: string;
  hora: string;
  estado: EstadoAsistencia;
  registrado_por: string | null;
  created_at: string;
}

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  etiqueta: EtiquetaComunicado;
  autor: string;
  fecha: string;
  created_at: string;
}

export interface EstudianteConCalificaciones extends Estudiante {
  calificaciones: Calificacion[];
  promedio_general: number;
}

export interface ScanResult {
  estudiante: Estudiante;
  estado: EstadoAsistencia;
  hora: string;
}
