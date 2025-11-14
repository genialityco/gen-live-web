/**
 * EJEMPLO DE USO FUTURO
 * Este archivo muestra cómo usar transformRegistrationDataToLabels
 * para exportar datos legibles a Excel o mostrar en tablas
 */

import { transformRegistrationDataToLabels } from './formDataTransform';
import type { FormField } from '../types';

// Ejemplo de estructura de datos
interface Attendee {
  _id: string;
  email: string;
  registrationData: Record<string, string | number | boolean | null | undefined>;
  createdAt: string;
}

/**
 * Convierte un array de asistentes a formato legible para exportación
 */
export function prepareAttendeesForExport(
  attendees: Attendee[],
  formFields: FormField[]
): Array<Record<string, string>> {
  return attendees.map(attendee => {
    // Transformar valores a etiquetas legibles
    const readableData = transformRegistrationDataToLabels(
      attendee.registrationData,
      formFields
    );

    // Crear objeto con campos legibles
    const exportRow: Record<string, string> = {
      'ID': attendee._id,
      'Email': attendee.email,
      'Fecha de Registro': new Date(attendee.createdAt).toLocaleString('es-CO'),
    };

    // Agregar campos del formulario con sus etiquetas
    formFields
      .filter(f => !f.hidden) // No incluir campos ocultos
      .sort((a, b) => a.order - b.order)
      .forEach(field => {
        const fieldLabel = field.label;
        const fieldValue = readableData[field.id] || '';
        exportRow[fieldLabel] = fieldValue;
      });

    return exportRow;
  });
}

/**
 * Ejemplo de uso en un componente de tabla
 */
export function useAttendeesTableData(
  attendees: Attendee[],
  formFields: FormField[]
) {
  // Columnas de la tabla
  const columns = [
    { key: 'email', label: 'Email' },
    ...formFields
      .filter(f => !f.hidden)
      .sort((a, b) => a.order - b.order)
      .map(field => ({
        key: field.id,
        label: field.label,
      })),
    { key: 'createdAt', label: 'Fecha de Registro' },
  ];

  // Filas de la tabla (con valores legibles)
  const rows = attendees.map(attendee => {
    const readableData = transformRegistrationDataToLabels(
      attendee.registrationData,
      formFields
    );

    return {
      id: attendee._id,
      email: attendee.email,
      ...readableData,
      createdAt: new Date(attendee.createdAt).toLocaleDateString('es-CO'),
    };
  });

  return { columns, rows };
}

/**
 * Ejemplo de endpoint backend para exportar a CSV
 * (Este código iría en el backend NestJS)
 */
/*
@Get(':eventId/attendees/export')
async exportAttendees(@Param('eventId') eventId: string) {
  // 1. Obtener asistentes
  const attendees = await this.attendeesService.findByEvent(eventId);
  
  // 2. Obtener configuración del formulario
  const event = await this.eventsService.findOne(eventId);
  const organization = await this.organizationsService.findById(event.organizationId);
  const formFields = organization.registrationForm.fields;
  
  // 3. Transformar datos a formato legible
  const exportData = attendees.map(attendee => {
    const readableData = transformRegistrationDataToLabels(
      attendee.registrationData,
      formFields
    );
    
    // Crear fila del CSV
    const row: any = {
      'ID': attendee._id,
      'Email': attendee.email,
      'Fecha de Registro': attendee.createdAt,
    };
    
    // Agregar campos del formulario
    formFields
      .filter(f => !f.hidden)
      .sort((a, b) => a.order - b.order)
      .forEach(field => {
        row[field.label] = readableData[field.id] || '';
      });
    
    return row;
  });
  
  // 4. Convertir a CSV
  const csv = this.convertToCSV(exportData);
  
  // 5. Enviar como descarga
  return {
    filename: `attendees-${eventId}.csv`,
    content: csv,
  };
}
*/
