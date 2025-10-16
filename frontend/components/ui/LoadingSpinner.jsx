// components/ui/LoadingSpinner.jsx
'use client';
/**
 * Componente reutilizable de spinner de carga
 * @param {string} text - Texto a mostrar debajo del spinner
 * @param {string} size - Tamaño: "small" | "medium" | "large"
 */
export default function LoadingSpinner({ text = "Cargando...", size = "medium" }) {
  const sizeClasses = {
    small: { container: "loading-container-small", spinner: "spinner-small" },
    medium: { container: "loading-container", spinner: "spinner" },
    large: { container: "loading-container-large", spinner: "spinner-large" }
  };
  const classes = sizeClasses[size] || sizeClasses.medium;
  return (
    <div className={classes.container}>
      <div className={classes.spinner}></div>
      {text && <p>{text}</p>}
    </div>
  );
}
