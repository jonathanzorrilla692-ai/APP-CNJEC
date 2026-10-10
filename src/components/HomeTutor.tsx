import PanelEstudiante from './PanelEstudiante';
export default function HomeTutor({ modo = 'resumen' }: { modo?: 'resumen' | 'notas' | 'carnet' }) {
  return <PanelEstudiante modo={modo} />;
}
