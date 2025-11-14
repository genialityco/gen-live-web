/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Stack,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Divider,
  Group,
  Alert,
} from "@mantine/core";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { api } from "../../core/api";

export default function AdminAuth() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState<"login" | "signup" | "google" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const bootstrap = async () => {
    await api.post("/auth/bootstrap"); // crea/actualiza UserAccount en Mongo
  };

  const goHome = () => {
    navigate("/");
  };

  const handleError = (e: any) => {
    const msg = e?.response?.data?.message || e?.message || "Error inesperado";
    setError(String(msg));
  };

  const canSubmit = email.trim().length > 3 && pass.length >= 6;

  const doSignup = async () => {
    setError(null);
    if (!canSubmit) return setError("Completa email y contraseña (mín. 6)");
    try {
      setLoading("signup");
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
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
      await signInWithEmailAndPassword(auth, email.trim(), pass);
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

  const doGoogle = async () => {
    setError(null);
    try {
      setLoading("google");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await bootstrap(); // idempotente
      // Pequeño delay para que Firebase procese el estado
      setTimeout(() => goHome(), 100);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(null);
    }
  };

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

      <Divider label="o" />

      <Button
        variant="default"
        onClick={doGoogle}
        loading={loading === "google"}
      >
        Continuar con Google
      </Button>
    </Stack>
  );
}
