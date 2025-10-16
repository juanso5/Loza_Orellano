// components/  const [sortField, setSortField] = useState('fecha');
  const [sortDirection, setSortDirection] = useState('desc');
  // Formatters
  const fmtUSD = formatCurrency('USD');
  const fmtARS = formatCurrency('ARS');
  // Formatear fechasx
'use client';
import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';
export default function LiquidezTable({ 
  movements = [], 
  onEdit, 
  onDelete, 
  loading = false,
  clientFilter,
  onClientFilterChange 
}) {
  const [sortField, setSortField] = useState('fecha');
  const [sortDirection, setSortDirection] = useState('desc');
  // Formatear n├║meros
  const formatCurrency = (amount, currency = 'USD') => {
    if (amount == null) return '-';
    const num = Number(amount);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'ars' ? 'ARS' : 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };
  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  // Manejar ordenamiento
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  // Datos ordenados y filtrados
  const sortedAndFilteredData = useMemo(() => {
    let filtered = [...movements];
    // Filtrar por cliente si est├í seleccionado
    if (clientFilter) {
      filtered = filtered.filter(mov => 
        mov.cliente_id === clientFilter || 
        mov.cliente_nombre?.toLowerCase().includes(clientFilter.toString().toLowerCase())
      );
    }
    // Ordenar
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      // Manejar campos espec├¡ficos
      if (sortField === 'fecha') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortField === 'monto') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [movements, clientFilter, sortField, sortDirection]);
  // Calcular totales
  const totals = useMemo(() => {
    return sortedAndFilteredData.reduce((acc, mov) => {
      const amount = Number(mov.monto) || 0;
      const currency = mov.tipo_cambio;
      const isDeposit = mov.tipo_mov === 'deposito';
      if (currency === 'usd') {
        acc.usd += isDeposit ? amount : -amount;
      } else {
        acc.ars += isDeposit ? amount : -amount;
      }
      return acc;
    }, { usd: 0, ars: 0 });
  }, [sortedAndFilteredData]);
  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="sort-icon">Ôçà</span>;
    }
    return (
      <span className="sort-icon active">
        {sortDirection === 'asc' ? 'Ôåæ' : 'Ôåô'}
      </span>
    );
  };
  if (loading) {
    return (
      <div className="table-loading">
        <div className="loading-spinner"></div>
        <p>Cargando movimientos de liquidez...</p>
      </div>
    );
  }
  return (
    <div className="liquidez-table-container">
      {/* Resumen de totales */}
      <div className="totals-summary">
        <div className="total-item">
          <span className="label">Total USD:</span>
          <span className={`amount ${totals.usd >= 0 ? 'positive' : 'negative'}`}>
            {fmtUSD(totals.usd)}
          </span>
        </div>
        <div className="total-item">
          <span className="label">Total ARS:</span>
          <span className={`amount ${totals.ars >= 0 ? 'positive' : 'negative'}`}>
            {fmtARS(totals.ars)}
          </span>
        </div>
        <div className="total-item">
          <span className="label">Movimientos:</span>
          <span className="count">{sortedAndFilteredData.length}</span>
        </div>
      </div>
      {/* Tabla */}
      <div className="table-wrapper">
        <table className="liquidez-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('fecha')} className="sortable">
                Fecha <SortIcon field="fecha" />
              </th>
              <th onClick={() => handleSort('cliente_nombre')} className="sortable">
                Cliente <SortIcon field="cliente_nombre" />
              </th>
              <th onClick={() => handleSort('tipo_mov')} className="sortable">
                Tipo <SortIcon field="tipo_mov" />
              </th>
              <th onClick={() => handleSort('monto')} className="sortable">
                Monto <SortIcon field="monto" />
              </th>
              <th>Comentario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  {clientFilter ? 'No hay movimientos para este filtro' : 'No hay movimientos registrados'}
                </td>
              </tr>
            ) : (
              sortedAndFilteredData.map((movement) => (
                <tr key={movement.id_mov_liq || movement.id_liq} className="data-row">
                  <td className="date-cell">
                    {formatDate(movement.fecha)}
                  </td>
                  <td className="client-cell">
                    {movement.cliente_nombre || `Cliente ${movement.cliente_id}`}
                  </td>
                  <td>
                    <span className={`type-badge ${movement.tipo_mov}`}>
                      {movement.tipo_mov === 'deposito' ? 'Dep├│sito' : 'Extracci├│n'}
                    </span>
                  </td>
                  <td className="amount-cell">
                    <span className={`amount ${movement.tipo_mov === 'deposito' ? 'deposit' : 'withdrawal'}`}>
                      {movement.tipo_mov === 'extraccion' ? '-' : '+'}
                      {movement.tipo_cambio === 'usd' ? fmtUSD(movement.monto) : fmtARS(movement.monto)}
                    </span>
                  </td>
                  <td className="comment-cell">
                    {movement.comentario ? (
                      <span title={movement.comentario}>
                        {movement.comentario.length > 50 
                          ? `${movement.comentario.substring(0, 50)}...`
                          : movement.comentario
                        }
                      </span>
                    ) : (
                      <span className="no-comment">-</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => onEdit?.(movement)}
                        title="Editar movimiento"
                      >
                        Ô£Å´©Å
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => onDelete?.(movement)}
                        title="Eliminar movimiento"
                      >
                        ­ƒùæ´©Å
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .liquidez-table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .table-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #6b7280;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .totals-summary {
          display: flex;
          gap: 24px;
          padding: 20px 24px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }
        .total-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 120px;
        }
        .total-item .label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .total-item .amount {
          font-size: 16px;
          font-weight: 600;
        }
        .total-item .amount.positive {
          color: #059669;
        }
        .total-item .amount.negative {
          color: #dc2626;
        }
        .total-item .count {
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }
        .table-wrapper {
          overflow-x: auto;
        }
        .liquidez-table {
          width: 100%;
          border-collapse: collapse;
        }
        .liquidez-table th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }
        .liquidez-table th.sortable {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.2s;
        }
        .liquidez-table th.sortable:hover {
          background: #f3f4f6;
        }
        .sort-icon {
          margin-left: 6px;
          opacity: 0.5;
        }
        .sort-icon.active {
          opacity: 1;
          color: #2563eb;
        }
        .liquidez-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
        }
        .data-row:hover {
          background: #fafbfc;
        }
        .empty-state {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          padding: 40px 16px;
        }
        .date-cell {
          font-family: monospace;
          font-size: 13px;
          color: #6b7280;
        }
        .client-cell {
          font-weight: 500;
          color: #374151;
        }
        .type-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-transform: capitalize;
        }
        .type-badge.deposito {
          background: #dcfce7;
          color: #166534;
        }
        .type-badge.extraccion {
          background: #fee2e2;
          color: #991b1b;
        }
        .amount-cell {
          text-align: right;
          font-weight: 600;
          font-family: monospace;
        }
        .amount.deposit {
          color: #059669;
        }
        .amount.withdrawal {
          color: #dc2626;
        }
        .comment-cell {
          max-width: 200px;
          color: #6b7280;
          font-size: 14px;
        }
        .no-comment {
          color: #d1d5db;
        }
        .actions-cell {
          width: 100px;
        }
        .action-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .btn-edit,
        .btn-delete {
          background: transparent;
          border: none;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          font-size: 14px;
        }
        .btn-edit:hover {
          background: #e0f2fe;
        }
        .btn-delete:hover {
          background: #fee2e2;
        }
        @media (max-width: 768px) {
          .totals-summary {
            flex-direction: column;
            gap: 12px;
          }
          .total-item {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
          .liquidez-table th,
          .liquidez-table td {
            padding: 8px 12px;
            font-size: 14px;
          }
          .comment-cell {
            max-width: 150px;
          }
        }
      `}</style>
    </div>
  );
}
