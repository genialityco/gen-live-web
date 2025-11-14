/**
 * Plantilla de formulario ACE (Asociación Colombiana de Endocrinología)
 * Cumple con todos los requisitos especificados en la guía
 */

import type { FormField } from '../types';

export const ACE_FORM_TEMPLATE: FormField[] = [
  // 1. Cédula o número de identificación
  {
    id: 'cedula',
    type: 'text',
    label: 'Cédula o número de identificación',
    placeholder: 'Ingrese solo números',
    required: true,
    order: 1,
    helpText: 'Si su cédula o número de identificación contiene números y letras, por favor ingrese solo los números.',
    validation: {
      pattern: '^[0-9]+$', // Solo números
      minLength: 6,
    },
  },

  // 2. Nombres
  {
    id: 'nombres',
    type: 'text',
    label: 'Nombres',
    placeholder: 'Ingrese sus nombres',
    required: true,
    order: 2,
    validation: {
      pattern: '^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$', // Solo letras y espacios
    },
  },

  // 3. Apellidos
  {
    id: 'apellidos',
    type: 'text',
    label: 'Apellidos',
    placeholder: 'Ingrese sus apellidos',
    required: true,
    order: 3,
    validation: {
      pattern: '^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$', // Solo letras y espacios
    },
  },

  // 4. Indicativo de país (oculto, se calcula automáticamente)
  {
    id: 'indicativo_pais',
    type: 'text',
    label: 'Indicativo de país',
    required: true,
    order: 4,
    hidden: true,
    autoCalculated: true,
    dependsOn: 'pais',
  },

  // 5. Número de contacto
  {
    id: 'numero_contacto',
    type: 'tel',
    label: 'Número de contacto',
    placeholder: 'Ingrese su número sin espacios',
    required: true,
    order: 5,
    validation: {
      pattern: '^[0-9]+$', // Solo números
      minLength: 6,
    },
  },

  // 6. Correo electrónico (campo del sistema)
  {
    id: 'email_system',
    type: 'email',
    label: 'Correo electrónico',
    placeholder: 'tu@email.com',
    required: true,
    order: 6,
  },

  // 7. País
  {
    id: 'pais',
    type: 'select',
    label: 'País',
    placeholder: 'Seleccione su país',
    required: true,
    order: 7,
    options: [
      { label: 'Colombia', value: 'CO' },
      { label: 'Argentina', value: 'AR' },
      { label: 'Brasil', value: 'BR' },
      { label: 'Chile', value: 'CL' },
      { label: 'Ecuador', value: 'EC' },
      { label: 'México', value: 'MX' },
      { label: 'Perú', value: 'PE' },
      { label: 'Venezuela', value: 'VE' },
      { label: 'Estados Unidos', value: 'US' },
      { label: 'España', value: 'ES' },
    ],
  },

  // 8. Ciudad (solo visible si país es Colombia)
  {
    id: 'ciudad',
    type: 'select',
    label: 'Ciudad',
    placeholder: 'Seleccione su ciudad',
    required: true,
    order: 8,
    defaultValue: 'No aplica',
    conditionalLogic: [
      {
        action: 'show',
        conditions: [{ field: 'pais', operator: 'equals', value: 'CO' }],
        logic: 'and',
      },
    ],
    options: [
      // Antioquia
      { label: 'Medellín', value: 'Medellín' },
      { label: 'Envigado', value: 'Envigado' },
      { label: 'Bello', value: 'Bello' },
      { label: 'Itagüí', value: 'Itagüí' },
      { label: 'Rionegro', value: 'Rionegro' },
      // Atlántico
      { label: 'Barranquilla', value: 'Barranquilla' },
      { label: 'Soledad', value: 'Soledad' },
      // Bogotá
      { label: 'Bogotá', value: 'Bogotá' },
      // Bolívar
      { label: 'Cartagena', value: 'Cartagena' },
      // Boyacá
      { label: 'Tunja', value: 'Tunja' },
      { label: 'Duitama', value: 'Duitama' },
      { label: 'Sogamoso', value: 'Sogamoso' },
      // Caldas
      { label: 'Manizales', value: 'Manizales' },
      // Cauca
      { label: 'Popayán', value: 'Popayán' },
      // Cesar
      { label: 'Valledupar', value: 'Valledupar' },
      // Córdoba
      { label: 'Montería', value: 'Montería' },
      // Cundinamarca
      { label: 'Soacha', value: 'Soacha' },
      { label: 'Zipaquirá', value: 'Zipaquirá' },
      { label: 'Facatativá', value: 'Facatativá' },
      { label: 'Chía', value: 'Chía' },
      // Huila
      { label: 'Neiva', value: 'Neiva' },
      // La Guajira
      { label: 'Riohacha', value: 'Riohacha' },
      // Magdalena
      { label: 'Santa Marta', value: 'Santa Marta' },
      // Meta
      { label: 'Villavicencio', value: 'Villavicencio' },
      // Nariño
      { label: 'Pasto', value: 'Pasto' },
      // Norte de Santander
      { label: 'Cúcuta', value: 'Cúcuta' },
      // Quindío
      { label: 'Armenia', value: 'Armenia' },
      // Risaralda
      { label: 'Pereira', value: 'Pereira' },
      { label: 'Dosquebradas', value: 'Dosquebradas' },
      // Santander
      { label: 'Bucaramanga', value: 'Bucaramanga' },
      { label: 'Floridablanca', value: 'Floridablanca' },
      // Sucre
      { label: 'Sincelejo', value: 'Sincelejo' },
      // Tolima
      { label: 'Ibagué', value: 'Ibagué' },
      // Valle del Cauca
      { label: 'Cali', value: 'Cali' },
      { label: 'Palmira', value: 'Palmira' },
      { label: 'Buenaventura', value: 'Buenaventura' },
    ],
  },

  // 9. Departamento (oculto, se calcula automáticamente cuando se selecciona ciudad)
  {
    id: 'departamento',
    type: 'text',
    label: 'Departamento',
    required: true,
    order: 9,
    hidden: true,
    autoCalculated: true,
    dependsOn: 'ciudad',
    defaultValue: 'No aplica',
  },

  // 10. Perfil
  {
    id: 'perfil',
    type: 'select',
    label: 'Perfil',
    placeholder: 'Seleccione su perfil',
    required: true,
    order: 10,
    options: [
      { label: 'Médico especialista', value: 'medico-especialista' },
      { label: 'Residente', value: 'residente' },
      { label: 'Médico general', value: 'medico-general' },
      { label: 'Profesional de otra área de la salud', value: 'profesional-otra-area' },
      { label: 'Estudiante', value: 'estudiante' },
    ],
  },

  // 11. Área de especialidad (solo visible si perfil es "Médico especialista" o "Residente")
  {
    id: 'area_especialidad',
    type: 'select',
    label: 'Área de especialidad',
    placeholder: 'Seleccione el área',
    required: true,
    order: 11,
    conditionalLogic: [
      {
        action: 'show',
        conditions: [
          { field: 'perfil', operator: 'equals', value: 'medico-especialista' },
          { field: 'perfil', operator: 'equals', value: 'residente' },
        ],
        logic: 'or',
      },
    ],
    options: [
      { label: 'Medicina Interna', value: 'medicina-interna' },
      { label: 'Medicina Familiar y Comunitaria', value: 'medicina-familiar' },
      { label: 'Cirugía', value: 'cirugia' },
      { label: 'Pediatría', value: 'pediatria' },
      { label: 'Ginecología y Obstetricia', value: 'ginecologia' },
      { label: 'Anestesiología', value: 'anestesiologia' },
      { label: 'Radiología', value: 'radiologia' },
      { label: 'Psiquiatría', value: 'psiquiatria' },
      { label: 'Otra', value: 'otra' },
    ],
  },

  // 12. Especialidad/Subespecialidad (depende de área de especialidad)
  {
    id: 'especialidad',
    type: 'select',
    label: 'Especialidad/Subespecialidad',
    placeholder: 'Seleccione la especialidad',
    required: true,
    order: 12,
    dependsOn: 'area_especialidad',
    conditionalLogic: [
      {
        action: 'show',
        conditions: [
          { field: 'perfil', operator: 'equals', value: 'medico-especialista' },
          { field: 'perfil', operator: 'equals', value: 'residente' },
        ],
        logic: 'or',
      },
    ],
    options: [
      // Medicina Interna
      { label: 'Endocrinología', value: 'endocrinologia', parentValue: 'medicina-interna' },
      { label: 'Cardiología', value: 'cardiologia', parentValue: 'medicina-interna' },
      { label: 'Nefrología', value: 'nefrologia', parentValue: 'medicina-interna' },
      { label: 'Gastroenterología', value: 'gastroenterologia', parentValue: 'medicina-interna' },
      { label: 'Neumología', value: 'neumologia', parentValue: 'medicina-interna' },
      { label: 'Hematología', value: 'hematologia', parentValue: 'medicina-interna' },
      { label: 'Reumatología', value: 'reumatologia', parentValue: 'medicina-interna' },
      { label: 'Infectología', value: 'infectologia', parentValue: 'medicina-interna' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'medicina-interna' },
      
      // Medicina Familiar
      { label: 'Salud Pública', value: 'salud-publica', parentValue: 'medicina-familiar' },
      { label: 'Medicina Comunitaria', value: 'medicina-comunitaria', parentValue: 'medicina-familiar' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'medicina-familiar' },
      
      // Cirugía
      { label: 'Cirugía General', value: 'cirugia-general', parentValue: 'cirugia' },
      { label: 'Cirugía Cardiovascular', value: 'cirugia-cardiovascular', parentValue: 'cirugia' },
      { label: 'Cirugía Plástica', value: 'cirugia-plastica', parentValue: 'cirugia' },
      { label: 'Neurocirugía', value: 'neurocirugia', parentValue: 'cirugia' },
      { label: 'Ortopedia y Traumatología', value: 'ortopedia', parentValue: 'cirugia' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'cirugia' },
      
      // Pediatría
      { label: 'Neonatología', value: 'neonatologia', parentValue: 'pediatria' },
      { label: 'Pediatría General', value: 'pediatria-general', parentValue: 'pediatria' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'pediatria' },
      
      // Ginecología
      { label: 'Obstetricia', value: 'obstetricia', parentValue: 'ginecologia' },
      { label: 'Ginecología Oncológica', value: 'ginecologia-oncologica', parentValue: 'ginecologia' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'ginecologia' },
      
      // Anestesiología
      { label: 'Anestesia Cardiovascular', value: 'anestesia-cardiovascular', parentValue: 'anestesiologia' },
      { label: 'Dolor y Cuidado Paliativo', value: 'dolor-cuidado-paliativo', parentValue: 'anestesiologia' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'anestesiologia' },
      
      // Radiología
      { label: 'Radiología Intervencionista', value: 'radiologia-intervencionista', parentValue: 'radiologia' },
      { label: 'Imagenología Diagnóstica', value: 'imagenologia-diagnostica', parentValue: 'radiologia' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'radiologia' },
      
      // Psiquiatría
      { label: 'Psiquiatría General', value: 'psiquiatria-general', parentValue: 'psiquiatria' },
      { label: 'Psiquiatría Infantil', value: 'psiquiatria-infantil', parentValue: 'psiquiatria' },
      { label: 'No aplica', value: 'no-aplica', parentValue: 'psiquiatria' },
      
      // Otra
      { label: 'No aplica', value: 'no-aplica', parentValue: 'otra' },
    ],
  },

  // Campo alternativo: Área profesional (solo si perfil es "Profesional de otra área de la salud")
  {
    id: 'area_profesional_otra',
    type: 'select',
    label: 'Área profesional – otra área de la salud',
    placeholder: 'Seleccione su área profesional',
    required: true,
    order: 13,
    conditionalLogic: [
      {
        action: 'show',
        conditions: [
          { field: 'perfil', operator: 'equals', value: 'profesional-otra-area' },
        ],
        logic: 'and',
      },
    ],
    options: [
      { label: 'Enfermería', value: 'enfermeria' },
      { label: 'Nutrición', value: 'nutricion' },
      { label: 'Fisioterapia', value: 'fisioterapia' },
      { label: 'Psicología', value: 'psicologia' },
      { label: 'Farmacia', value: 'farmacia' },
      { label: 'Odontología', value: 'odontologia' },
      { label: 'Trabajo Social', value: 'trabajo-social' },
      { label: 'Terapia Respiratoria', value: 'terapia-respiratoria' },
      { label: 'Bacteriología', value: 'bacteriologia' },
      { label: 'Otra', value: 'otra' },
    ],
  },

  // 13. Checks de autorización obligatorios
  {
    id: 'check_profesional_salud',
    type: 'checkbox',
    label: 'Acepto que soy un profesional de la salud',
    required: true,
    order: 14,
  },

  {
    id: 'check_consentimiento_datos',
    type: 'checkbox',
    label: 'Al marcar esta casilla y diligenciar el presente formulario, se entenderá como una conducta inequívoca de que otorga su consentimiento de forma libre, voluntaria y expresa para el tratamiento de su información personal de acuerdo con lo descrito en nuestro "AVISO DE PRIVACIDAD PARA REGISTRO PROFESIONALES DE LA SALUD".',
    required: true,
    order: 15,
    helpText: 'Ver aviso de privacidad: https://asoendocrinocol.dataprotected.co/#privacynotice',
  },
];
