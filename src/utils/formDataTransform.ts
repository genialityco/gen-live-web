import type { FormField } from "../types";

/**
 * Transforma los valores técnicos de registrationData a etiquetas legibles
 * @param registrationData - Objeto con los valores del formulario (ej: { field_123: "medico_especialista" })
 * @param formFields - Array de campos del formulario con sus configuraciones
 * @returns Objeto con las etiquetas legibles (ej: { field_123: "Médico Especialista" })
 */
export function transformRegistrationDataToLabels(
  registrationData: Record<string, string | number | boolean | null | undefined>,
  formFields: FormField[]
): Record<string, string> {
  const transformed: Record<string, string> = {};

  // Crear un mapa de fieldId -> FormField para búsqueda rápida
  const fieldMap = new Map<string, FormField>();
  formFields.forEach(field => {
    fieldMap.set(field.id, field);
  });

  // Transformar cada valor
  Object.entries(registrationData).forEach(([fieldId, value]) => {
    const field = fieldMap.get(fieldId);
    
    // Si no encontramos la definición del campo, guardar el valor original
    if (!field) {
      transformed[fieldId] = String(value ?? '');
      return;
    }

    // Transformar según el tipo de campo
    switch (field.type) {
      case 'select': {
        if (value === null || value === undefined || value === '') {
          transformed[fieldId] = '';
          break;
        }

        // Manejar formato "Ciudad|Estado" (para ciudades)
        let searchValue = String(value);
        if (searchValue.includes('|')) {
          searchValue = searchValue.split('|')[0];
        }

        // Buscar la etiqueta en las opciones
        const option = field.options?.find(
          opt => opt.value === searchValue || opt.value === String(value)
        );
        
        transformed[fieldId] = option?.label || String(value);
        break;
      }

      case 'checkbox': {
        // Convertir booleano a Sí/No
        transformed[fieldId] = value ? 'Sí' : 'No';
        break;
      }

      case 'email':
      case 'tel':
      case 'text':
      case 'textarea':
      case 'number':
      default: {
        // Para otros tipos, solo convertir a string
        transformed[fieldId] = String(value ?? '');
        break;
      }
    }
  });

  return transformed;
}

/**
 * Obtiene el label de un campo por su ID
 * @param fieldId - ID del campo
 * @param formFields - Array de campos del formulario
 * @returns Label del campo o el ID si no se encuentra
 */
export function getFieldLabel(fieldId: string, formFields: FormField[]): string {
  const field = formFields.find(f => f.id === fieldId);
  return field?.label || fieldId;
}
