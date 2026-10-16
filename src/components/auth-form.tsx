"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({
  mode,
  next,
}: {
  mode: "register" | "login";
  next?: string;
}) {
  const registering = mode === "register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function failureMessage(reason: unknown) {
    const status =
      typeof reason === "object" && reason !== null && "status" in reason
        ? reason.status
        : undefined;
    if (status === 429)
      return "Hay muchos intentos seguidos. Esperá un momento y volvé a intentar.";
    return registering
      ? "No pudimos crear la cuenta con esos datos. Si ya estás registrado, ingresá con tu cuenta."
      : "No pudimos iniciar sesión. Revisá el email y la contraseña. Si el problema sigue, volvé a intentar en unos minutos.";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (registering && password !== form.get("confirmPassword")) {
      setError("Las contraseñas no coinciden. Revisalas para continuar.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const credentials = {
        email: String(form.get("email") ?? "").trim(),
        password,
      };
      const result = registering
        ? await authClient.signUp.email({
            ...credentials,
            name: String(form.get("name") ?? "").trim(),
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        setError(failureMessage(result.error));
        setBusy(false);
        return;
      }
      // Volver a la gestión del local que pidió el ingreso (otro subdominio).
      if (next) return window.location.assign(next);
      router.replace(registering ? "/alta" : "/panel");
      router.refresh();
    } catch (reason) {
      // The Managed SDK can reject its promise for an unsuccessful auth request.
      setError(failureMessage(reason));
      setBusy(false);
    }
  }

  return (
    <>
      <p className="eyebrow">
        {registering ? "PASO 01 / 02" : "BIENVENIDO DE NUEVO"}
      </p>
      <h1 className="form-title">
        {registering ? "Empezá por tu cuenta." : "Entrá a tu espacio."}
      </h1>
      <p className="form-description">
        {registering
          ? "Estos son tus datos personales. En el próximo paso creás tu negocio."
          : "Usá tu email y contraseña para administrar tus negocios."}
      </p>
      <form onSubmit={submit} className="app-form">
        <fieldset disabled={busy}>
          {registering ? (
            <label>
              Tu nombre
              <input
                name="name"
                autoComplete="name"
                placeholder="Cómo te llamás"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vos@ejemplo.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Contraseña
            <div className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={8}
                maxLength={128}
                required
                aria-describedby={registering ? "password-hint" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          {registering ? (
            <>
              <p id="password-hint" className="field-hint">
                Usá al menos 8 caracteres. No compartas tu contraseña con el
                equipo.
              </p>
              <label>
                Repetí la contraseña
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            </>
          ) : null}
        </fieldset>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-button" disabled={busy} type="submit">
          {busy
            ? registering
              ? "Creando tu cuenta…"
              : "Ingresando…"
            : registering
              ? "Crear cuenta y continuar"
              : "Ingresar"}
          <span aria-hidden="true">→</span>
        </button>
        <p className="form-switch">
          {registering ? "¿Ya tenés cuenta?" : "¿Es tu primera vez?"}{" "}
          <Link href={registering ? "/ingresar" : "/registro"}>
            {registering ? "Ingresá" : "Creá tu cuenta"}
          </Link>
        </p>
      </form>
    </>
  );
}
