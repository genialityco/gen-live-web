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
  SimpleGrid,
  Paper,
  Badge,
  Divider,
  ScrollArea,
  Box,
  Code,
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

  const normalizeBoolean = (raw: any): boolean | undefined => {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;

    if (typeof raw === "string") {
      const v = raw.trim().toLowerCase();
      if (["true", "verdadero", "sí", "si", "yes", "y", "s"].includes(v))
        return true;
      if (["false", "falso", "no", "n"].includes(v)) return false;
      if (["1", "x", "✓"].includes(v)) return true;
      if (["0"].includes(v)) return false;
    }
    return undefined;
  };

  const getSampleValue = (header?: string) => {
    if (!header || rows.length === 0) return "-";
    const v = rows[0]?.[header];
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
  };

  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setServerSummary(null);
    setError(null);

    if (!f) return;

    try {
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

      // mapeo inicial heurístico
      const initialMapping: Record<string, string> = {};
      const lowercaseHeaders = cols.map((h) => h.toLowerCase());

      const emailIdx = lowercaseHeaders.findIndex((h) =>
        [
          "email",
          "correo",
          "correo electrónico",
          "correo electronico",
        ].includes(h),
      );
      if (emailIdx >= 0) initialMapping["__email"] = cols[emailIdx];

      const nameIdx = lowercaseHeaders.findIndex((h) =>
        ["nombre", "name"].includes(h),
      );
      if (nameIdx >= 0) initialMapping["__name"] = cols[nameIdx];

      const phoneIdx = lowercaseHeaders.findIndex((h) =>
        ["telefono", "teléfono", "phone", "celular", "cel"].includes(h),
      );
      if (phoneIdx >= 0) initialMapping["__phone"] = cols[phoneIdx];

      for (const field of registrationForm.fields) {
        const idx = lowercaseHeaders.findIndex((h) =>
          h.includes(field.label.toLowerCase()),
        );
        if (idx >= 0) initialMapping[field.id] = cols[idx];
      }

      setMapping(initialMapping);
    } catch (e) {
      console.error(e);
      setError("No se pudo leer el archivo. Verifica el formato (xlsx/csv).");
    }
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
      const bulkRows = rows.map((row) => {
        const registrationData: Record<string, any> = {};
        const identifierValues: Record<string, any> = {};

        for (const field of registrationForm.fields) {
          const headerName = mapping[field.id];
          if (headerName) {
            const rawValue = row[headerName];
            const value = coerceValue(field, rawValue);
            registrationData[field.id] = value;
            if (field.isIdentifier) identifierValues[field.id] = value;

            registrationData[field.id] = value;
            if (field.isIdentifier) identifierValues[field.id] = value;
          }
        }

        const emailHeader = mapping["__email"];
        const nameHeader = mapping["__name"];
        const phoneHeader = mapping["__phone"];

        const email = emailHeader ? row[emailHeader] : undefined;
        const name = nameHeader ? row[nameHeader] : undefined;
        const phone = phoneHeader ? row[phoneHeader] : undefined;

        return { identifierValues, registrationData, email, name, phone };
      });

      const response = await api.post("/org-attendees/bulk-import", {
        organizationId: orgId,
        rows: bulkRows,
      });

      setServerSummary(response.data);
      onImported(); // refrescar tabla afuera
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message || "Error al enviar los datos al servidor",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectProps = {
    data: headers,
    placeholder: "Selecciona columna",
    searchable: true,
    clearable: true,
    size: "lg" as const,
    comboboxProps: { withinPortal: true as const },
    nothingFoundMessage: "No hay coincidencias",
    styles: { input: { minHeight: 44 } },
  };

  const coerceValue = (field: any, raw: any) => {
    if (raw === null || raw === undefined) return undefined;

    // vacíos típicos
    if (typeof raw === "string" && raw.trim() === "") return undefined;

    switch (field.type) {
      case "checkbox": {
        const b = normalizeBoolean(raw);
        return b === undefined ? raw : b;
      }

      case "number": {
        if (typeof raw === "number") return raw;
        if (typeof raw === "string") {
          // soporta "1.234,56" o "1234.56"
          const cleaned = raw
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(",", ".");
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : raw; // si no parsea, no lo dañes
        }
        return raw;
      }

      case "select": {
        // normalmente quieres guardar el value (string) tal cual
        return String(raw);
      }

      case "date": {
        // Si viene como Date
        if (raw instanceof Date) return raw.toISOString();

        // Si Excel lo trae como serial number, SheetJS puede convertir con XLSX.SSF
        // pero aquí lo dejamos simple: si es string, intenta Date()
        if (typeof raw === "string") {
          const d = new Date(raw);
          return isNaN(d.getTime()) ? raw : d.toISOString();
        }

        return raw;
      }

      default:
        return raw;
    }
  };

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
              <Text size="sm" fw={600}>
                Columnas detectadas
              </Text>
              <Text size="xs" c="dimmed">
                {headers.join(" · ")}
              </Text>
            </Alert>

            {/* Mapeo (mejor UI) */}
            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700} size="sm">
                    Mapeo de columnas
                  </Text>
                  <Badge variant="light">
                    {headers.length} columnas · {rows.length} filas
                  </Badge>
                </Group>

                <Divider />

                <Text fw={600} size="sm">
                  Campos básicos
                </Text>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={6}>
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Email
                        </Text>
                        <Badge variant="light" color="blue">
                          Base
                        </Badge>
                      </Group>

                      <Select
                        {...selectProps}
                        value={mapping["__email"] || null}
                        onChange={(value) =>
                          handleChangeMapping("__email", value)
                        }
                      />

                      <Text size="xs" c="dimmed">
                        Ejemplo:{" "}
                        <Code>{getSampleValue(mapping["__email"])}</Code>
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={6}>
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Nombre
                        </Text>
                        <Badge variant="light" color="blue">
                          Base
                        </Badge>
                      </Group>

                      <Select
                        {...selectProps}
                        value={mapping["__name"] || null}
                        onChange={(value) =>
                          handleChangeMapping("__name", value)
                        }
                      />

                      <Text size="xs" c="dimmed">
                        Ejemplo:{" "}
                        <Code>{getSampleValue(mapping["__name"])}</Code>
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={6}>
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          Teléfono
                        </Text>
                        <Badge variant="light" color="blue">
                          Base
                        </Badge>
                      </Group>

                      <Select
                        {...selectProps}
                        value={mapping["__phone"] || null}
                        onChange={(value) =>
                          handleChangeMapping("__phone", value)
                        }
                      />

                      <Text size="xs" c="dimmed">
                        Ejemplo:{" "}
                        <Code>{getSampleValue(mapping["__phone"])}</Code>
                      </Text>
                    </Stack>
                  </Paper>
                </SimpleGrid>

                <Divider />

                <Group justify="space-between" align="center">
                  <Text fw={600} size="sm">
                    Campos del formulario de registro
                  </Text>
                  <Text size="xs" c="dimmed">
                    Tip: escribe dentro del select para buscar
                  </Text>
                </Group>

                <ScrollArea h={420} type="auto" offsetScrollbars>
                  <Stack gap="sm" pr="xs">
                    {registrationForm.fields
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((field) => (
                        <Paper key={field.id} withBorder p="sm" radius="md">
                          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                            <Box>
                              <Group gap="xs" wrap="nowrap">
                                <Text fw={600} size="sm">
                                  {field.label}
                                </Text>
                                {field.isIdentifier && (
                                  <Badge color="green" variant="light">
                                    Identificador
                                  </Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">
                                ID: <Code>{field.id}</Code> · Tipo:{" "}
                                <Code>{field.type}</Code>
                              </Text>
                            </Box>

                            <Box>
                              <Select
                                {...selectProps}
                                value={mapping[field.id] || null}
                                onChange={(value) =>
                                  handleChangeMapping(field.id, value)
                                }
                              />
                            </Box>

                            <Box>
                              <Text size="xs" c="dimmed">
                                Ejemplo:{" "}
                                <Code>{getSampleValue(mapping[field.id])}</Code>
                              </Text>
                              <Text size="xs" c="dimmed">
                                Columna:{" "}
                                <Code>
                                  {mapping[field.id] ? mapping[field.id] : "-"}
                                </Code>
                              </Text>
                            </Box>
                          </SimpleGrid>
                        </Paper>
                      ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Paper>

            {/* Preview filas */}
            <Text fw={600} size="sm" mt="md">
              Preview (primeras 5 filas)
            </Text>
            <ScrollArea type="auto" offsetScrollbars>
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
            </ScrollArea>
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
