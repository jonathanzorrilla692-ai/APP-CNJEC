import PanelEstudiante from './PanelEstudiante';
export default function HomeEstudiante({ modo = 'resumen' }: { modo?: 'resumen' | 'notas' | 'carnet' }) {
  return <PanelEstudiante alumno modo={modo} />;
}
