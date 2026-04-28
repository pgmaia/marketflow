import { useEffect, useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Shield, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import {
  listBackups,
  restoreBackup,
  createManualBackup,
  exportStateAsJSON,
  importStateFromJSON,
} from '../../lib/syncSupabase';

type Backup = { id: number; created_at: string };
type Status = { type: 'success' | 'error'; message: string } | null;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function BackupView() {
  const [backups, setBackups]         = useState<Backup[]>([]);
  const [loading, setLoading]         = useState(true);
  const [status, setStatus]           = useState<Status>(null);
  const [confirming, setConfirming]   = useState<number | null>(null);
  const [busy, setBusy]               = useState(false);
  const fileRef                       = useRef<HTMLInputElement>(null);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setLoading(true);
    setBackups(await listBackups());
    setLoading(false);
  }

  function notify(type: 'success' | 'error', message: string) {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleManualBackup() {
    setBusy(true);
    try {
      await createManualBackup();
      await refresh();
      notify('success', 'Backup criado com sucesso');
    } catch (e: unknown) {
      notify('error', `Erro ao criar backup: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  async function handleRestore(id: number) {
    setBusy(true);
    setConfirming(null);
    try {
      await restoreBackup(id);
      notify('success', 'Dados restaurados com sucesso');
    } catch (e: unknown) {
      notify('error', `Erro ao restaurar: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await importStateFromJSON(file);
      notify('success', 'Dados importados com sucesso');
    } catch (e: unknown) {
      notify('error', `Arquivo inválido: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6 md:px-14 md:py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF5C351A' }}>
            <Shield size={18} style={{ color: '#FF5C35' }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-800">Backup & Recuperação</h1>
            <p className="text-[12px] text-gray-500">Backups automáticos diários · últimos 7 dias guardados</p>
          </div>
        </div>

        {/* Status toast */}
        {status && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] font-medium ${
            status.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {status.type === 'success'
              ? <CheckCircle size={15} />
              : <AlertCircle size={15} />}
            {status.message}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Ações manuais</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <button
              onClick={handleManualBackup}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[13px] font-semibold text-gray-700 transition-colors disabled:opacity-50"
            >
              <Shield size={15} className="text-gray-500 shrink-0" />
              Fazer backup agora
            </button>

            <button
              onClick={exportStateAsJSON}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[13px] font-semibold text-gray-700 transition-colors disabled:opacity-50"
            >
              <Download size={15} className="text-gray-500 shrink-0" />
              Exportar JSON
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[13px] font-semibold text-gray-700 transition-colors disabled:opacity-50"
            >
              <Upload size={15} className="text-gray-500 shrink-0" />
              Importar JSON
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>

        {/* Backup list */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Backups disponíveis</p>
            <span className="text-[11px] text-gray-400">{backups.length} de 7</span>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-center text-[13px] text-gray-400">Carregando...</div>
          ) : backups.length === 0 ? (
            <div className="px-5 py-8 text-center space-y-1">
              <Clock size={24} className="mx-auto text-gray-300" />
              <p className="text-[13px] text-gray-400">Nenhum backup ainda</p>
              <p className="text-[12px] text-gray-400">O primeiro backup automático será criado em 24h</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {backups.map((b, i) => (
                <li key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <div>
                      <p className="text-[13px] font-medium text-gray-700">{formatDate(b.created_at)}</p>
                      {i === 0 && <p className="text-[11px] text-green-600">Mais recente</p>}
                    </div>
                  </div>

                  {confirming === b.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] text-gray-500">Tem certeza?</span>
                      <button
                        onClick={() => handleRestore(b.id)}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(b.id)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <RotateCcw size={12} />
                      Restaurar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          Backups automáticos são criados diariamente. Restaurar substitui todos os dados atuais.
        </p>
      </div>
    </div>
  );
}
