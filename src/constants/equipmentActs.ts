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

export type ActType = 'entry' | 'exit';

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
  created_at?: string;
  updated_at?: string;
  photos?: EquipmentActMedia[];
  videos?: EquipmentActMedia[];
  attachments?: EquipmentActMedia[];
};
