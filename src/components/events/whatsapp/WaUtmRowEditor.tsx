import { Stack, Group, Select, TextInput, Autocomplete, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { AvailableVariable } from "../../../api/event-email";
import {
  UTM_NAME_SUGGESTIONS, UTM_STATIC_PLACEHOLDERS, CONTEXT_VARIABLE_OPTIONS, type UtmRow,
} from "./waUtm";

interface UtmRowProps {
  row: UtmRow;
  formFields: AvailableVariable[];
  onChange: (row: UtmRow) => void;
  onRemove: () => void;
}

export default function UtmRowEditor({ row, formFields, onChange, onRemove }: UtmRowProps) {
  const fieldOptions = formFields.map((f) => ({ value: f.key, label: f.label }));

  const handleModeChange = (v: string | null) => {
    if (v === "field")    onChange({ ...row, val: { mode: "field",    fieldKey: fieldOptions[0]?.value ?? "" } });
    else if (v === "variable") onChange({ ...row, val: { mode: "variable", varKey: CONTEXT_VARIABLE_OPTIONS[0].value } });
    else                  onChange({ ...row, val: { mode: "text",     text: "" } });
  };

  return (
    <Stack gap="xs" p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 6 }}>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        {/* Param name */}
        <Autocomplete
          label="Parámetro"
          placeholder="utm_perfil"
          data={UTM_NAME_SUGGESTIONS}
          value={row.name}
          onChange={(v) => onChange({ ...row, name: v })}
          size="sm"
          style={{ flex: 1 }}
        />

        {/* Value type */}
        <Select
          label="Tipo"
          data={[
            { value: "text",     label: "Texto fijo" },
            { value: "variable", label: "Variable del evento" },
            ...(formFields.length > 0 ? [{ value: "field", label: "Campo del form" }] : []),
          ]}
          value={row.val.mode}
          onChange={handleModeChange}
          size="sm"
          style={{ flex: 1 }}
        />

        <ActionIcon
          color="red"
          variant="subtle"
          size="lg"
          onClick={onRemove}
          mb={4}
          style={{ flexShrink: 0 }}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      {/* Value */}
      {row.val.mode === "field" ? (
        <Select
          label="Campo del formulario"
          placeholder="Selecciona"
          data={fieldOptions}
          value={row.val.fieldKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "field", fieldKey: v } })}
          searchable
          size="sm"
          comboboxProps={{ width: "target" }}
        />
      ) : row.val.mode === "variable" ? (
        <Select
          label="Variable del evento"
          data={CONTEXT_VARIABLE_OPTIONS}
          value={row.val.varKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "variable", varKey: v } })}
          size="sm"
          comboboxProps={{ width: "target" }}
        />
      ) : (
        <TextInput
          label="Valor"
          placeholder={UTM_STATIC_PLACEHOLDERS[row.name] ?? "valor_fijo"}
          value={row.val.text}
          onChange={(e) => onChange({ ...row, val: { mode: "text", text: e.currentTarget.value } })}
          size="sm"
        />
      )}
    </Stack>
  );
}
