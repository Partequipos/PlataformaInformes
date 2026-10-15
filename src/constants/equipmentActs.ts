export const ACT_LOCATIONS = [
  'Partequipos Maquinaria Bogotá Fontibón',
  'Partequipos Maquinaria Guarne',
  'Partequipos Maquinaria Barranquilla',
  'Partequipos Maquinaria Cali',
  'Partequipos Maquinaria Itminia',
  'Partequipos Maquinaria Ibagué',
  'Partequipos Maquinaria Bucaramanga',
  'Partequipos Maquinaria Montería',
] as const;

export const COMPANY_LOGO_URL =
  'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

export const DEFAULT_MECHANICAL_STATE =
  'El equipo se encuentra en buenas condiciones generales de funcionamiento, habiendo solventado las novedades presentadas en el encendido.';

export const DEFAULT_LUBRICATION =
  'Se entrega debidamente lubricado en sus puntos articulados y con niveles de fluidos verificados.';

export const DEFAULT_OPERATION_TEST =
  'Se realizó la prueba de operación en sitio, verificando encendido, mandos, orugas, sistema hidráulico y respuesta del motor, confirmando su óptimo funcionamiento.';

export type ActType = 'entry' | 'exit' | 'delivery';

export type InspectionRating = '' | 'bueno' | 'regular' | 'malo' | 'na';

export type InspectionValues = Record<string, Record<string, string>>;

export const INSPECTION_RATING_OPTIONS: Array<{ value: InspectionRating; label: string }> = [
  { value: '', label: 'Seleccione' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'malo', label: 'Malo' },
  { value: 'na', label: 'No Aplica' },
];

export const INSPECTION_RATING_LABEL: Record<string, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  na: 'No Aplica',
};

export const DELIVERY_INSPECTION_SECTIONS: Array<{
  id: string;
  title: string;
  items: Array<{ key: string; label: string }>;
}> = [
  {
    id: 'exterior',
    title: '1. Inspección Exterior',
    items: [
      { key: 'pintura_general', label: 'Pintura General' },
      { key: 'estado_estructura', label: 'Estado general estructura' },
      { key: 'logos', label: 'Logos' },
      { key: 'calcomanias', label: 'Calcomanías' },
      { key: 'rayones', label: 'Rayones' },
      { key: 'golpes', label: 'Golpes' },
      { key: 'corrosion', label: 'Corrosión' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'cabina',
    title: '2. Cabina / Estación del Operador',
    items: [
      { key: 'vidrios', label: 'Vidrios' },
      { key: 'puertas', label: 'Puertas' },
      { key: 'cerraduras', label: 'Cerraduras' },
      { key: 'espejos', label: 'Espejos' },
      { key: 'asiento', label: 'Asiento' },
      { key: 'cinturon', label: 'Cinturón' },
      { key: 'tablero', label: 'Tablero' },
      { key: 'manual_operador', label: 'Manual del operador' },
      { key: 'llaves', label: 'Llaves' },
      { key: 'herramientas', label: 'Herramientas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'fluidos',
    title: '3. Niveles de fluidos',
    items: [
      { key: 'aceite_motor', label: 'Aceite de motor' },
      { key: 'aceite_hidraulico', label: 'Aceite hidráulico' },
      { key: 'aceite_transmision', label: 'Aceite de transmisión' },
      { key: 'refrigerante', label: 'Refrigerante' },
      { key: 'combustible', label: 'Combustible' },
      { key: 'urea', label: 'Nivel de Urea' },
      { key: 'limpiaparabrisas', label: 'Líquido limpiaparabrisas' },
      { key: 'fugas', label: 'Verificación de fugas' },
      { key: 'tapas', label: 'Tapas de los depósitos' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'hidraulico',
    title: '4. Sistema Hidráulico',
    items: [
      { key: 'mangueras', label: 'Mangueras y tubos' },
      { key: 'cilindros', label: 'Cilindros' },
      { key: 'conexiones', label: 'Conexiones' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'implementos',
    title: '5. Implementos',
    items: [
      { key: 'balde', label: 'Balde' },
      { key: 'brazos', label: 'Brazos' },
      { key: 'cucharon', label: 'Cucharón' },
      { key: 'acoples', label: 'Acoples' },
      { key: 'dientes', label: 'Dientes' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'rodaje',
    title: '6. Tren de rodaje',
    items: [
      { key: 'llantas', label: 'Llantas' },
      { key: 'orugas', label: 'Orugas' },
      { key: 'rines', label: 'Rines' },
      { key: 'rodillos', label: 'Rodillos' },
      { key: 'tensor', label: 'Tensor' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'electrico',
    title: '7. Sistema eléctrico',
    items: [
      { key: 'luces', label: 'Luces' },
      { key: 'farolas', label: 'Farolas' },
      { key: 'alarma_reversa', label: 'Alarma de reversa' },
      { key: 'bocina', label: 'Bocina' },
      { key: 'bateria', label: 'Batería' },
      { key: 'cables', label: 'Cables' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'ventilacion',
    title: '8. Sistema de ventilación',
    items: [
      { key: 'radiador', label: 'Radiador' },
      { key: 'ventilador', label: 'Ventilador de motor' },
      { key: 'aire_acondicionado', label: 'Aire Acondicionado' },
      { key: 'correa_poleas', label: 'Correa y poleas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'motor',
    title: '9. Motor',
    items: [
      { key: 'motor', label: 'Motor' },
      { key: 'compartimiento', label: 'Estado compartimiento motor' },
      { key: 'tapas', label: 'Tapas y cubiertas' },
      { key: 'cableado', label: 'Cableado' },
      { key: 'correa_poleas', label: 'Correa y poleas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
];

export const emptyInspection = (): InspectionValues => {
  const values: InspectionValues = {};
  for (const section of DELIVERY_INSPECTION_SECTIONS) {
    values[section.id] = { comentarios: '' };
    for (const item of section.items) {
      values[section.id][item.key] = '';
    }
  }
  return values;
};

export const actTypeLabel = (type?: string): string => {
  if (type === 'entry') return 'Entrada';
  if (type === 'exit') return 'Salida';
  if (type === 'delivery') return 'Entrega';
  return type || '—';
};

export const actTitle = (type?: string): string => {
  if (type === 'exit') return 'Acta de Salida';
  if (type === 'delivery') return 'Acta de Entrega';
  return 'Acta de Entrada';
};

export type EquipmentActMedia = {
  id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  photo_name?: string;
  video_name?: string;
  source?: string;
};

export type EquipmentAct = {
  id: string;
  user_id?: string;
  act_type: ActType;
  location: string;
  act_date: string;
  status: 'draft' | 'completed';
  equipment_type?: string;
  brand?: string;
  line_series?: string;
  model_type?: string;
  pin_serial?: string;
  engine_number?: string;
  internal_code?: string;
  manufacture_date?: string;
  load_capacity?: string;
  gps_serial?: string;
  gps_install_date?: string;
  motive?: string;
  works?: string;
  mechanical_state?: string;
  lubrication?: string;
  operation_test?: string;
  deliverer_name?: string;
  deliverer_cc?: string;
  deliverer_signature?: string;
  receiver_name?: string;
  receiver_cc?: string;
  receiver_signature?: string;
  inspection?: InspectionValues;
  created_at?: string;
  updated_at?: string;
  photos?: EquipmentActMedia[];
  videos?: EquipmentActMedia[];
  attachments?: EquipmentActMedia[];
};
