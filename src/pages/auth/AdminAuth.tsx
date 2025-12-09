/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Stack,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Alert,
} from "@mantine/core";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { api } from "../../core/api";

export default function AdminAuth() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  // Simplificamos el estado de carga ya que solo tendremos dos acciones
  const [loading, setLoading] = useState<"login" | "signup" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const bootstrap = async () => {
    // crea/actualiza UserAccount en Mongo (idempotente)
    await api.post("/auth/bootstrap");
  };

  const goHome = () => {
    navigate("/");
  };

  const handleError = (e: any) => {
    const msg = e?.response?.data?.message || e?.message || "Error inesperado";
    setError(String(msg));
  };

  // La lógica de validación se mantiene
  const canSubmit = email.trim().length > 3 && pass.length >= 6;

  const doSignup = async () => {
    setError(null);
    if (!canSubmit) return setError("Completa email y contraseña (mín. 6)");
    try {
      setLoading("signup");
      // Intenta crear la cuenta en Firebase
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
      // Si tiene éxito, sincroniza o crea el usuario en la DB (Mongo)
      await bootstrap();
      // Pequeño delay para que Firebase procese el estado
      setTimeout(() => goHome(), 100);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(null);
    }
  };

  const doLogin = async () => {
    setError(null);
    if (!canSubmit) return setError("Completa email y contraseña (mín. 6)");
    try {
      setLoading("login");
      // Intenta iniciar sesión en Firebase
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      // Si tiene éxito, sincroniza o crea el usuario en la DB (Mongo)
      await bootstrap();
      // Pequeño delay para que Firebase procese el estado
      setTimeout(() => goHome(), 100);
    } catch (e) {
      console.error(e)
      handleError(e);
    } finally {
      setLoading(null);
    }
  };

  // Se elimina la función doGoogle

  return (
    <Stack maw={420} mx="auto" gap="md">
      <Title order={3}>Acceso administradores</Title>

      {error && <Alert color="red">{error}</Alert>}

      <TextInput
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        autoFocus
      />
      <PasswordInput
        label="Contraseña"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Mínimo 6 caracteres"
      />

      <Group grow>
        <Button onClick={doLogin} loading={loading === "login"}>
          Entrar
        </Button>
        <Button
          variant="light"
          onClick={doSignup}
          loading={loading === "signup"}
        >
          Crear cuenta
        </Button>
      </Group>

      {/* Se eliminan el Divider y el botón de Google */}

    </Stack>
  );
}