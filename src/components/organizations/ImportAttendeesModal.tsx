// src/components/organizations/ImportAttendeesModal.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Alert,
  Select,
  Table,
  Group,
  FileInput,
  Loader,
} from "@mantine/core";
import * as XLSX from "xlsx";
import { api } from "../../core/api";
import type { RegistrationForm } from "../../types";

interface ImportAttendeesModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  registrationForm: RegistrationForm;
  onImported: () => void;
}

type ExcelRow = Record<string, any>;

export default function ImportAttendeesModal({
  opened,
  onClose,
  orgId,
  registrationForm,
  onImported,
}: ImportAttendeesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverSummary, setServerSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setServerSummary(null);
    setError(null);

    if (!f) return;

    const data = await f.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (json.length === 0) {
      setError("El archivo no contiene filas");
      return;
    }

    const firstRow = json[0];
    const cols = Object.keys(firstRow);
    setHeaders(cols);
    setRows(json);

    // mapeo inicial heurístico: intenta emparejar por label o por campo común
    const initialMapping: Record<string, string> = {};

    // campos base
    const lowercaseHeaders = cols.map((h) => h.toLowerCase());
    const emailIdx = lowercaseHeaders.findIndex((h) =>
      ["email", "correo", "correo electrónico", "correo electronico"].includes(
        h
      )
    );
    if (emailIdx >= 0) initialMapping["__email"] = cols[emailIdx];

    const nameIdx = lowercaseHeaders.findIndex((h) =>
      ["nombre", "name"].includes(h)
    );
    if (nameIdx >= 0) initialMapping["__name"] = cols[nameIdx];

    const phoneIdx = lowercaseHeaders.findIndex((h) =>
      ["telefono", "teléfono", "phone", "celular", "cel"].includes(h)
    );
    if (phoneIdx >= 0) initialMapping["__phone"] = cols[phoneIdx];

    // campos del registrationForm por label
    for (const field of registrationForm.fields) {
      const idx = lowercaseHeaders.findIndex((h) =>
        h.includes(field.label.toLowerCase())
      );
      if (idx >= 0) {
        initialMapping[field.id] = cols[idx];
      }
    }

    setMapping(initialMapping);
  };

  const handleChangeMapping = (fieldKey: string, header: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: header || "",
    }));
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError("No hay datos para importar");
      return;
    }

    setLoading(true);
    setError(null);
    setServerSummary(null);

    try {
      // Construir payload
      const bulkRows = rows.map((row) => {
        const registrationData: Record<string, any> = {};
        const identifierValues: Record<string, any> = {};

        // Campos del registrationForm
        for (const field of registrationForm.fields) {
          const headerName = mapping[field.id];
          if (headerName) {
            const rawValue = row[headerName];
            let value: any = rawValue;

            if (field.type === "checkbox") {
              const boolVal = normalizeBoolean(rawValue);
              if (boolVal !== undefined) {
                value = boolVal; // guardamos true/false
              }
            }

            registrationData[field.id] = value;

            if (field.isIdentifier) {
              identifierValues[field.id] = value;
            }
          }
        }

        // Campos base
        const emailHeader = mapping["__email"];
        const nameHeader = mapping["__name"];
        const phoneHeader = mapping["__phone"];

        const email = emailHeader ? row[emailHeader] : undefined;
        const name = nameHeader ? row[nameHeader] : undefined;
        const phone = phoneHeader ? row[phoneHeader] : undefined;

        return {
          identifierValues,
          registrationData,
          email,
          name,
          phone,
        };
      });

      const response = await api.post("/org-attendees/bulk-import", {
        organizationId: orgId,
        rows: bulkRows,
      });

      setServerSummary(response.data);
      onImported();
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message || "Error al enviar los datos al servidor"
      );
    } finally {
      setLoading(false);
    }
  };

  const normalizeBoolean = (raw: any): boolean | undefined => {
    if (raw === null || raw === undefined) return undefined;

    if (typeof raw === "boolean") return raw;

    if (typeof raw === "number") {
      // 0 = false, cualquier otro = true
      return raw !== 0;
    }

    if (typeof raw === "string") {
      const v = raw.trim().toLowerCase();

      if (["true", "verdadero", "sí", "si", "yes", "y", "s"].includes(v))
        return true;
      if (["false", "falso", "no", "n"].includes(v)) return false;

      if (["1", "x", "✓"].includes(v)) return true;
      if (["0"].includes(v)) return false;
    }

    // Si no lo podemos interpretar, devolvemos undefined para no dañarlo
    return undefined;
  };

  const identifierFields = registrationForm.fields.filter(
    (f) => f.isIdentifier
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Importar asistentes desde Excel"
      size="xl"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          1. Sube un archivo Excel / CSV. 2. Mapea las columnas del archivo con
          los campos del formulario de registro. 3. Confirma para
          crear/actualizar asistentes.
        </Text>

        <FileInput
          label="Archivo Excel/CSV"
          placeholder="Selecciona un archivo"
          value={file}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
        />

        {headers.length > 0 && (
          <>
            <Alert variant="light" color="blue">
              <Text size="sm">Columnas detectadas:</Text>
              <Text size="xs" c="dimmed">
                {headers.join(" · ")}
              </Text>
            </Alert>

            {/* Mapeo de campos base */}
            <Text fw={600} size="sm">
              Campos básicos
            </Text>
            <Table withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Campo</Table.Th>
                  <Table.Th>Columna del Excel</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Email</Table.Td>
                  <Table.Td>
                    <Select
                      data={headers}
                      placeholder="Selecciona columna"
                      value={mapping["__email"] || null}
                      onChange={(value) =>
                        handleChangeMapping("__email", value)
                      }
                      searchable
                      clearable
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Nombre</Table.Td>
                  <Table.Td>
                    <Select
                      data={headers}
                      placeholder="Selecciona columna"
                      value={mapping["__name"] || null}
                      onChange={(value) => handleChangeMapping("__name", value)}
                      searchable
                      clearable
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Teléfono</Table.Td>
                  <Table.Td>
                    <Select
                      data={headers}
                      placeholder="Selecciona columna"
                      value={mapping["__phone"] || null}
                      onChange={(value) =>
                        handleChangeMapping("__phone", value)
                      }
                      searchable
                      clearable
                    />
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            {/* Mapeo de campos del registrationForm */}
            <Text fw={600} size="sm" mt="md">
              Campos del formulario de registro
            </Text>
            <Table withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Campo del formulario</Table.Th>
                  <Table.Th>Es identificador</Table.Th>
                  <Table.Th>Columna del Excel</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {registrationForm.fields
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <Table.Tr key={field.id}>
                      <Table.Td>
                        <Text size="sm">{field.label}</Text>
                        <Text size="xs" c="dimmed">
                          ID: {field.id}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {field.isIdentifier ? (
                          <Text size="xs" c="green">
                            Sí
                          </Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            No
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Select
                          data={headers}
                          placeholder="Selecciona columna"
                          value={mapping[field.id] || null}
                          onChange={(value) =>
                            handleChangeMapping(field.id, value)
                          }
                          searchable
                          clearable
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>

            {/* Muestra las primeras filas como preview */}
            <Text fw={600} size="sm" mt="md">
              Preview (primeras 5 filas)
            </Text>
            <Table striped withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  {headers.map((h) => (
                    <Table.Th key={h}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.slice(0, 5).map((row, idx) => (
                  <Table.Tr key={idx}>
                    {headers.map((h) => (
                      <Table.Td key={h}>
                        <Text size="xs">{String(row[h])}</Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {serverSummary && (
          <Alert color="green" variant="light">
            <Text size="sm">
              Importación completada. Creados: {serverSummary.created},
              actualizados: {serverSummary.updated}
            </Text>
            {serverSummary.errors?.length > 0 && (
              <Text size="xs" c="red">
                Errores en {serverSummary.errors.length} filas (ver logs).
              </Text>
            )}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            onClick={handleImport}
            disabled={rows.length === 0 || loading}
          >
            {loading ? <Loader size="xs" /> : "Importar"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
