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
  deleteDatabase
} from './utils/api.js';

import { HardDrive, FolderOpen, Database, Layers } from 'lucide-react';
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

  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      const data = await fetchTableDetail(tableName);
      setSelectedTableDetail({
        header: data.header,
        schema: data.schema,
        records: data.records
      });
    } catch (err) {
      console.error(`Error loading table ${tableName}:`, err);
    } finally {
      setLoading(false);
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
      showSuccess('Base de Datos Activa', `Cambiado a: ${dbName === '/' ? 'Raíz (/)' : `/${dbName}`}`);
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
        } catch (e) {}
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
        onOpenDBeaverModal={() => setDbeaverModalOpen(true)}
        onOpenExportModal={() => setExportModalOpen(true)}
        onOpenNewTableModal={() => setNewTableModalOpen(true)}
        onRefresh={() => {
          loadDatabases();
          loadTables(selectedTableName || undefined);
          if (selectedTableName) loadTableDetail(selectedTableName);
        }}
        isWatching={isWatching}
        selectedTable={selectedTableName}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* If no directory is opened yet */}
        {!currentDirectory && tables.length === 0 && databases.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 select-none">
            <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-2xl shadow-sky-500/10 animate-bounce duration-1000">
              <Database className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold text-white">Bienvenido a MicroDB Studio</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Selecciona una tarjeta SD conectada a tu PC o elige cualquier carpeta local que contenga bases de datos o archivos{' '}
                <code className="text-sky-300 font-mono">.tbl</code> de MicroDB.
              </p>
            </div>
            <button
              onClick={() => setDriveModalOpen(true)}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center space-x-2 active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Abrir Tarjeta SD o Carpeta Local</span>
            </button>
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
          onDefragComplete={() => {
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
