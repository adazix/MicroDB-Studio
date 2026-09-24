// ============================================================================
// MICRODB STUDIO - APLICACIÓN PRINCIPAL (REACT + TYPESCRIPT)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { TableExplorer } from './components/TableExplorer.js';
import { DataGridView, RelationNavigationContext } from './components/DataGridView.js';
import { SqlConsole } from './components/SqlConsole.js';
import { DiskBlockMap } from './components/DiskBlockMap.js';
import { DriveSelectorModal } from './components/DriveSelectorModal.js';
import { DBeaverBridgeModal } from './components/DBeaverBridgeModal.js';
import { ExportModal } from './components/ExportModal.js';
import { RecordEditModal } from './components/RecordEditModal.js';
import { HexInspectorModal } from './components/HexInspectorModal.js';
import { DefragModal } from './components/DefragModal.js';
import { NewTableModal } from './components/NewTableModal.js';
import { NewDatabaseModal } from './components/NewDatabaseModal.js';

import {
  TableSummary,
  TableSchema,
  TableHeaderData,
  DecodedRecord,
  DatabaseInfo
} from './types/microdb.js';

import {
  fetchTables,
  fetchTableDetail,
  deleteRecord,
  dropTable,
  fetchDatabases,
  selectDatabase,
  createDatabase,
  deleteDatabase,
  closeDirectory
} from './utils/api.js';

import { FolderOpen, Database, Layers } from 'lucide-react';
import { useToast } from './components/Toast.js';

export const App: React.FC = () => {
  const { showConfirm, showSuccess, showError, showInfo } = useToast();
  // Navigation
  const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'sectors'>('tables');

  // Multi-Database state
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [activeDatabase, setActiveDatabase] = useState<string>('/');
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);

  // Main table state
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [selectedTableDetail, setSelectedTableDetail] = useState<{
    header: TableHeaderData;
    schema: TableSchema;
    records: DecodedRecord[];
  } | null>(null);

  // Navigation context for Foreign Keys (ir y volver de relaciones)
  const [relationContext, setRelationContext] = useState<RelationNavigationContext | null>(null);

  const [isWatching, setIsWatching] = useState(false);

  // Modals
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [dbeaverModalOpen, setDbeaverModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [newTableModalOpen, setNewTableModalOpen] = useState(false);
  const [newDatabaseModalOpen, setNewDatabaseModalOpen] = useState(false);
  const [recordEditModalOpen, setRecordEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<DecodedRecord | null>(null);
  const [hexModalOpen, setHexModalOpen] = useState(false);
  const [hexRecord, setHexRecord] = useState<DecodedRecord | null>(null);
  const [vacuumModalOpen, setVacuumModalOpen] = useState(false);
  const [vacuumTargetTable, setVacuumTargetTable] = useState<string | null>(null);

  // Cargar lista de bases de datos
  const loadDatabases = useCallback(async () => {
    try {
      const data = await fetchDatabases();
      setDatabases(data.databases);
      setActiveDatabase(data.activeDatabase || '/');
      setCurrentDirectory(data.currentDbDirectory || data.rootDirectory);
    } catch (err) {
      console.error('Error fetching databases:', err);
    }
  }, []);

  // Cargar lista de tablas de la base de datos activa
  const loadTables = useCallback(async (preferredTable?: string) => {
    try {
      const data = await fetchTables();
      setTables(data.tables);
      setCurrentDirectory(data.currentDbDirectory);

      if (data.tables.length > 0) {
        const queryTarget = preferredTable || selectedTableName || '';
        const match = data.tables.find((t) => t.name.toLowerCase() === queryTarget.toLowerCase());
        const target = match ? match.name : data.tables[0].name;
        setSelectedTableName(target);
        loadTableDetail(target);
      } else {
        setSelectedTableName(null);
        setSelectedTableDetail(null);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  }, [selectedTableName]);

  // Cargar detalle de la tabla seleccionada
  const loadTableDetail = useCallback(async (tableName: string) => {
    if (!tableName) return;
    try {
      const data = await fetchTableDetail(tableName);
      setSelectedTableDetail({
        header: data.header,
        schema: data.schema,
        records: data.records
      });
    } catch (err) {
      console.error(`Error loading table ${tableName}:`, err);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    loadDatabases();
    loadTables();
  }, []);

  // Cambiar tabla seleccionada
  useEffect(() => {
    if (selectedTableName) {
      loadTableDetail(selectedTableName);
    }
  }, [selectedTableName, loadTableDetail]);

  // Handler para navegar a una tabla relacionada (Clave Foránea)
  const handleNavigateToRelation = (targetTable: string, targetRecordId?: number) => {
    if (!selectedTableName) return;

    // Buscar coincidencia exacta o plural/singular (ej: client -> CLIENTS)
    const match = tables.find(
      (t) =>
        t.name.toLowerCase() === targetTable.toLowerCase() ||
        t.name.toLowerCase() === `${targetTable}s`.toLowerCase() ||
        t.name.toLowerCase() === `${targetTable}es`.toLowerCase() ||
        targetTable.toLowerCase().startsWith(t.name.toLowerCase())
    );

    if (match) {
      setRelationContext({
        fromTable: selectedTableName,
        targetRecordId,
        fieldName: targetTable
      });
      setSelectedTableName(match.name);
      loadTableDetail(match.name);
      setActiveTab('tables');
    } else {
      showInfo('Tabla no encontrada', `La tabla '${targetTable}' no existe en esta base de datos.`);
    }
  };

  // Handler para regresar de una relación
  const handleReturnFromRelation = () => {
    if (relationContext?.fromTable) {
      setSelectedTableName(relationContext.fromTable);
      loadTableDetail(relationContext.fromTable);
      setRelationContext(null);
    }
  };

  // Handler para cambiar de Base de Datos
  const handleSelectDatabase = async (dbName: string) => {
    try {
      setRelationContext(null);
      await selectDatabase(dbName);
      setActiveDatabase(dbName);
      await loadDatabases();
      await loadTables();
      const databasePath = dbName === '/' ? 'Raíz (/)' : `/${dbName}`;
      showSuccess('Base de Datos Activa', `Cambiado a: ${databasePath}`);
    } catch (err: any) {
      showError('Error al cambiar de base de datos', err.message);
    }
  };

  // Handler para crear una nueva Base de Datos
  const handleCreateDatabase = async (dbName: string) => {
    try {
      setRelationContext(null);
      await createDatabase(dbName);
      setActiveDatabase(dbName);
      await loadDatabases();
      await loadTables();
      showSuccess('Base de Datos Creada', `Se creó el directorio /${dbName} en la tarjeta SD.`);
    } catch (err: any) {
      showError('Error al crear base de datos', err.message);
    }
  };

  // Handler para eliminar una Base de Datos
  const handleDeleteDatabase = (dbName: string) => {
    if (dbName === '/' || dbName === 'Raíz') {
      showError('Acción no permitida', 'No se puede eliminar el directorio raíz.');
      return;
    }

    showConfirm({
      title: '¿Eliminar Base de Datos Completa?',
      message: `¿Estás seguro de eliminar el directorio '/${dbName}' y todas sus tablas de la tarjeta SD? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, Eliminar Base de Datos',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setRelationContext(null);
          await deleteDatabase(dbName);
          showSuccess('Base de Datos Eliminada', `El directorio /${dbName} fue eliminado de la SD.`);
          await loadDatabases();
          await loadTables();
        } catch (err: any) {
          showError('Error al eliminar base de datos', err.message);
        }
      }
    });
  };

  // Handler para cerrar el directorio actual y volver al inicio
  const handleCloseDirectory = async () => {
    showConfirm({
      title: '¿Cerrar Directorio Actual?',
      message: 'Se desconectará la tarjeta SD o carpeta activa. Podrás seleccionar otra ubicación o crear una nueva base de datos.',
      confirmText: 'Cerrar Ubicación',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await closeDirectory();
        } catch (err) {
          console.warn('Error cerrando directorio:', err);
        }
        setCurrentDirectory(null);
        setTables([]);
        setDatabases([]);
        setSelectedTableName(null);
        setSelectedTableDetail(null);
        setRelationContext(null);
        setActiveTab('tables');
        showInfo('Directorio Cerrado', 'Ubicación desconectada. Selecciona una nueva tarjeta SD o carpeta.');
      }
    });
  };

  // WebSocket para Live SD Watcher
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setIsWatching(true);
        console.log('[WebSocket] Conectado al Live SD Watcher');
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SD_FILE_CHANGE') {
            console.log('[WebSocket] Cambio en SD detectado:', msg.data);
            loadDatabases();
            loadTables(selectedTableName || undefined);
            if (selectedTableName && msg.data.tableName === selectedTableName) {
              loadTableDetail(selectedTableName);
            }
          }
        } catch (e) {
          console.warn('[WebSocket] Mensaje inválido recibido:', e);
        }
      };
      ws.onclose = () => setIsWatching(false);
      ws.onerror = () => setIsWatching(false);
    } catch (e) {
      console.warn('WebSocket connection error:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [selectedTableName, loadTables, loadTableDetail, loadDatabases]);

  // Delete Record Handler con diálogo custom
  const handleDeleteRecord = (slotIndex: number) => {
    if (!selectedTableName) return;
    showConfirm({
      title: '¿Eliminar Registro?',
      message: `¿Estás seguro de marcar el slot físico #${slotIndex} de la tabla '${selectedTableName}' como borrado (Tombstone O(1))? Se encolará automáticamente en la Free-List para reciclaje.`,
      confirmText: 'Sí, Eliminar Slot',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteRecord(selectedTableName, slotIndex);
          loadTableDetail(selectedTableName);
          loadTables(selectedTableName);
          showSuccess('Registro Eliminado', `El slot #${slotIndex} fue marcado como borrado y encolado en la Free-List.`);
        } catch (err: any) {
          showError('Error al eliminar', err.message);
        }
      }
    });
  };

  // Drop Table Handler con diálogo custom
  const handleDropTable = (tableName: string) => {
    showConfirm({
      title: '¿Eliminar Tabla Completa?',
      message: `¿Estás seguro de eliminar permanentemente la tabla '${tableName}' y sus archivos asociados (.tbl, .idx, .jsn, .schema.json) de la base de datos activa? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, Eliminar Tabla',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setRelationContext(null);
          await dropTable(tableName);
          showSuccess('Tabla Eliminada', `La tabla '${tableName}' y sus archivos asociados han sido eliminados.`);
          await loadTables();
          await loadDatabases();
        } catch (err: any) {
          showError('Error al eliminar tabla', err.message);
        }
      }
    });
  };

  const currentTableSummary = tables.find((t) => t.name === selectedTableName);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d1117] text-slate-100 font-sans overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentDirectory={currentDirectory}
        activeDatabase={activeDatabase}
        onOpenDriveModal={() => setDriveModalOpen(true)}
        onCloseDirectory={handleCloseDirectory}
        onOpenDBeaverModal={() => setDbeaverModalOpen(true)}
        onOpenExportModal={() => setExportModalOpen(true)}
        onOpenNewTableModal={() => setNewTableModalOpen(true)}
        onRefresh={() => {
          loadDatabases();
          loadTables(selectedTableName || undefined);
          if (selectedTableName) loadTableDetail(selectedTableName);
        }}
        isWatching={isWatching}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* If no directory is opened yet */}
        {!currentDirectory && tables.length === 0 && databases.length === 0 ? (
          <div className="flex-1 relative flex items-center justify-center p-4 sm:p-6 select-none overflow-hidden bg-dark-950">
            {/* Ambient Background Banner with smooth blur and radial darkening */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-md scale-110 pointer-events-none transition-all duration-700"
              style={{ backgroundImage: `url('/banner.jpg')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/85 to-[#0d1117]/60 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0d1117_75%)] pointer-events-none" />

            {/* Welcome Glass Card */}
            <div className="relative z-10 max-w-lg w-full bg-[#161b22]/90 border border-[#30363d] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl shadow-sky-500/10 backdrop-blur-2xl text-center space-y-5 animate-fadeIn">
              <div className="flex justify-center">
                <img 
                  src="/favicon.png" 
                  alt="MicroDB Studio" 
                  className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_0_16px_rgba(56,189,248,0.7)] hover:scale-105 transition-transform" 
                />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-300 tracking-tight">
                  Bienvenido a MicroDB Studio
                </h2>
                <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed max-w-md mx-auto">
                  Suite visual y gestor de bases de datos embebidas para tarjetas SD, MicroDB y proyectos de microcontroladores Arduino / ESP32.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <button
                  onClick={() => setDriveModalOpen(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center space-x-2 active:scale-95 group"
                >
                  <FolderOpen className="w-4 h-4 text-sky-200 group-hover:scale-110 transition-transform" />
                  <span>Abrir Tarjeta SD o Carpeta</span>
                </button>

                <button
                  onClick={() => setNewDatabaseModalOpen(true)}
                  className="w-full sm:w-auto bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] hover:border-slate-600 text-slate-200 hover:text-white font-semibold text-xs px-4 py-3 rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-95"
                >
                  <Database className="w-4 h-4 text-slate-400" />
                  <span>Crear Base de Datos</span>
                </button>
              </div>

              {/* Badges */}
              <div className="pt-3.5 border-t border-[#30363d]/70 flex flex-wrap items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
                <span className="px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d]">⚡ Compatibilidad Arduino MicroDB</span>
                <span className="px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d]">📁 FAT32 SD Cards</span>
                <span className="px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d]">🔗 DBeaver Bridge</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Left Sidebar Table Explorer */}
            <TableExplorer
              databases={databases}
              activeDatabase={activeDatabase}
              onSelectDatabase={(db) => {
                setRelationContext(null);
                handleSelectDatabase(db);
              }}
              onOpenNewDatabaseModal={() => setNewDatabaseModalOpen(true)}
              onDeleteDatabase={handleDeleteDatabase}
              tables={tables}
              selectedTable={selectedTableName}
              onSelectTable={(name) => {
                setRelationContext(null);
                setSelectedTableName(name);
                loadTableDetail(name);
                setActiveTab('tables');
              }}
              onOpenVacuumModal={(name) => {
                setVacuumTargetTable(name);
                setVacuumModalOpen(true);
              }}
              onDropTable={handleDropTable}
              onOpenDriveModal={() => setDriveModalOpen(true)}
              onCloseDirectory={handleCloseDirectory}
            />

            {/* Central Content Area based on activeTab */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
              {activeTab === 'tables' && (
                selectedTableName && selectedTableDetail ? (
                  <DataGridView
                    tableName={selectedTableName}
                    header={selectedTableDetail.header}
                    schema={selectedTableDetail.schema}
                    records={selectedTableDetail.records}
                    allTableNames={tables.map((t) => t.name)}
                    navigationContext={relationContext}
                    onNavigateToRelation={handleNavigateToRelation}
                    onReturnFromRelation={handleReturnFromRelation}
                    onInsertClick={() => {
                      setRecordToEdit(null);
                      setRecordEditModalOpen(true);
                    }}
                    onEditClick={(rec) => {
                      setRecordToEdit(rec);
                      setRecordEditModalOpen(true);
                    }}
                    onDeleteClick={handleDeleteRecord}
                    onInspectHexClick={(rec) => {
                      setHexRecord(rec);
                      setHexModalOpen(true);
                    }}
                    onDropTableClick={() => selectedTableName && handleDropTable(selectedTableName)}
                    onVacuumClick={() => {
                      if (selectedTableName) {
                        setVacuumTargetTable(selectedTableName);
                        setVacuumModalOpen(true);
                      }
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <Layers className="w-12 h-12 text-slate-600 opacity-40 mb-3" />
                    <p className="font-semibold text-sm">Selecciona una tabla en la barra lateral</p>
                  </div>
                )
              )}

              {activeTab === 'sql' && (
                <SqlConsole tables={tables} selectedTable={selectedTableName} />
              )}

              {activeTab === 'sectors' && (
                currentTableSummary && selectedTableDetail ? (
                  <DiskBlockMap
                    table={currentTableSummary}
                    records={selectedTableDetail.records}
                    onOpenVacuum={() => {
                      setVacuumTargetTable(currentTableSummary.name);
                      setVacuumModalOpen(true);
                    }}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    Selecciona una tabla para ver el mapa físico de sectores
                  </div>
                )
              )}
            </main>
          </>
        )}
      </div>

      {/* Modals */}
      <DriveSelectorModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        onDirectoryOpened={(path) => {
          setRelationContext(null);
          setCurrentDirectory(path);
          loadDatabases();
          loadTables();
        }}
        currentDirectory={currentDirectory}
      />

      <NewDatabaseModal
        isOpen={newDatabaseModalOpen}
        onClose={() => setNewDatabaseModalOpen(false)}
        onDatabaseCreated={handleCreateDatabase}
        existingDatabases={databases.map((d) => d.name)}
      />

      <DBeaverBridgeModal
        isOpen={dbeaverModalOpen}
        onClose={() => setDbeaverModalOpen(false)}
        currentDirectory={currentDirectory}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        tables={tables}
        selectedTable={selectedTableName}
      />

      <NewTableModal
        isOpen={newTableModalOpen}
        onClose={() => setNewTableModalOpen(false)}
        onTableCreated={(newTableName) => {
          setRelationContext(null);
          loadDatabases();
          loadTables(newTableName);
          setSelectedTableName(newTableName);
        }}
      />

      {selectedTableName && selectedTableDetail && (
        <RecordEditModal
          isOpen={recordEditModalOpen}
          onClose={() => setRecordEditModalOpen(false)}
          tableName={selectedTableName}
          schema={selectedTableDetail.schema}
          recordToEdit={recordToEdit}
          onRecordSaved={() => {
            loadTableDetail(selectedTableName);
            loadTables(selectedTableName);
            loadDatabases();
          }}
        />
      )}

      {selectedTableName && (
        <HexInspectorModal
          isOpen={hexModalOpen}
          onClose={() => setHexModalOpen(false)}
          record={hexRecord}
          tableName={selectedTableName}
        />
      )}

      {vacuumTargetTable && (
        <DefragModal
          isOpen={vacuumModalOpen}
          onClose={() => {
            setVacuumModalOpen(false);
            setVacuumTargetTable(null);
          }}
          tableName={vacuumTargetTable}
          deletedRecordsCount={
            vacuumTargetTable === selectedTableName
              ? selectedTableDetail?.header.deletedRecords
              : tables.find((t) => t.name === vacuumTargetTable)?.header.deletedRecords
          }
          onDefragComplete={() => {
            loadDatabases();
            loadTables(vacuumTargetTable);
            if (selectedTableName === vacuumTargetTable) {
              loadTableDetail(vacuumTargetTable);
            }
          }}
        />
      )}
    </div>
  );
};
