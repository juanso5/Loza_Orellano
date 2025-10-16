import { Modal } from "./ui";
import styles from "../styles/clientes.module.css";
export default function ConfirmDeleteModal({ open, onCancel, onConfirm, text }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Confirmar eliminación"
      size="small"
      footer={
        <>
          <button className={styles.btnDanger} onClick={onConfirm}>
            <i className="fas fa-trash" /> Eliminar
          </button>
          <button className={styles.btnClose} onClick={onCancel}>
            <i className="fas fa-times" /> Cancelar
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  );
}