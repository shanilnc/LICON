import React, { useEffect, useState } from "react";
import { api } from "./api";
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading, reload: () => setRevision((x) => x + 1) };
}
export function State({ loading, error, empty, children }) {
  if (loading)
    return (
      <div className="state" role="status">
        Loading your space…
      </div>
    );
  if (error)
    return (
      <div className="state error" role="alert">
        <h3>We couldn’t connect.</h3>
        <p>{error}</p>
        <p>Please try again in a moment.</p>
      </div>
    );
  if (empty)
    return (
      <div className="state">
        <h3>Nothing here just yet.</h3>
        <p>Try another selection or explore the collection.</p>
      </div>
    );
  return children;
}
export function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Select({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function Message({ children }) {
  return children ? (
    <p className="notice" role="status">
      {children}
    </p>
  ) : null;
}
export function Form({
  onSubmit,
  children,
  button = "Save changes",
  className = "",
  disabled = false,
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setMessage("");
        try {
          const result = await onSubmit(
            Object.fromEntries(new FormData(form)),
            form,
          );
          setMessage(result || "Saved successfully.");
        } catch (error) {
          setMessage(error.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <Message>{message}</Message>
      <button disabled={busy || disabled} className="button">
        {busy ? "Please wait…" : button}
      </button>
    </form>
  );
}
