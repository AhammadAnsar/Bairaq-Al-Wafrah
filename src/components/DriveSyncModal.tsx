import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Trash2,
  ExternalLink,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  LogOut,
  Settings2,
  Copy,
} from 'lucide-react';
import {
  DriveFileMetadata,
  DRIVE_FOLDER_NAME,
  GoogleUserProfile,
  getDefaultOAuthClientId,
  getCustomOAuthClientId,
  setCustomOAuthClientId,
} from '../services/googleDriveService';
import { WorkspaceDatabase } from '../types/billing';

interface DriveSyncViewProps {
  user: GoogleUserProfile | null;
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedTime: string | null;
  driveFiles: DriveFileMetadata[];
  syncError: string | null;
  database: WorkspaceDatabase;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onPushToDrive: () => Promise<void>;
  onPullFromDrive: () => Promise<void>;
  onRefreshFiles: () => Promise<void>;
  onDeleteDriveFile: (fileId: string) => Promise<void>;
  onImportLocalJson: (db: WorkspaceDatabase) => void;
}

export const DriveSyncView: React.FC<DriveSyncViewProps> = ({
  user,
  isConnected,
  isSyncing,
  lastSyncedTime,
  driveFiles,
  syncError,
  database,
  onSignIn,
  onSignOut,
  onPushToDrive,
  onPullFromDrive,
  onRefreshFiles,
  onDeleteDriveFile,
  onImportLocalJson,
}) => {
  // Mandatory confirmation dialog states before mutating/overwriting/deleting user Drive data
  const [pendingAction, setPendingAction] = useState<{
    type: 'push_overwrite' | 'pull_restore' | 'delete_file';
    fileId?: string;
    fileName?: string;
  } | null>(null);

  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState<boolean>(false);
  const [customClientId, setCustomClientId] = useState<string>(() =>
    getCustomOAuthClientId()
  );
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedFeedback(label);
    setTimeout(() => setCopiedFeedback(null), 2200);
  };

  const handleSaveClientId = () => {
    setCustomOAuthClientId(customClientId);
    setCopiedFeedback('Saved OAuth Client ID');
    setTimeout(() => setCopiedFeedback(null), 2200);
  };

  const handleExportLocalJson = () => {
    const blob = new Blob([JSON.stringify(database, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bairaq_workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as WorkspaceDatabase;
        if (parsed && Array.isArray(parsed.companies)) {
          onImportLocalJson(parsed);
        }
      } catch (err) {
        console.error('Invalid backup JSON:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === 'push_overwrite') {
      await onPushToDrive();
    } else if (action.type === 'pull_restore') {
      await onPullFromDrive();
    } else if (action.type === 'delete_file' && action.fileId) {
      await onDeleteDriveFile(action.fileId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog Modal for Mutating/Destructive Google Drive Operations */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {pendingAction.type === 'push_overwrite' &&
                    'Update Database in Google Drive?'}
                  {pendingAction.type === 'pull_restore' &&
                    'Load & Overwrite Local Workspace from Google Drive?'}
                  {pendingAction.type === 'delete_file' &&
                    `Delete "${pendingAction.fileName}" from Google Drive?`}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {pendingAction.type === 'push_overwrite' &&
                    `This will overwrite "bairaq_workspace_db.json" inside your "${DRIVE_FOLDER_NAME}" Google Drive folder with your current workspace state (${database.companies.length} companies).`}
                  {pendingAction.type === 'pull_restore' &&
                    'This will replace your current local workspace data with the version stored in Google Drive.'}
                  {pendingAction.type === 'delete_file' &&
                    `Are you sure you want to permanently delete "${pendingAction.fileName}" from your Google Drive folder? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
                  pendingAction.type === 'delete_file'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-teal-700 hover:bg-teal-800'
                }`}
              >
                {pendingAction.type === 'delete_file' ? 'Confirm Delete' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Google Drive Connection Status Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Multi-Device Google Drive Cloud Backup &amp; Auto-Sync
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Connect your Google account once to automatically back up and synchronize your entire software database (<code className="font-mono-tabular text-teal-700 dark:text-teal-400">/{DRIVE_FOLDER_NAME}/bairaq_workspace_db.json</code>). When you sign in on another computer or mobile device and connect the same Google account, all your invoices, payments, customers, and company letterheads sync automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isConnected ? (
              <button onClick={onSignIn} className="gsi-material-button">
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    Connect Google Drive
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="text-right mr-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {user?.displayName || user?.email || 'Connected Account'}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Google Drive Auto-Sync Active</span>
                  </div>
                </div>

                <button
                  onClick={() => setPendingAction({ type: 'push_overwrite' })}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isSyncing ? 'Syncing...' : 'Backup Now'}
                </button>

                <button
                  onClick={() => setPendingAction({ type: 'pull_restore' })}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  Pull from Drive
                </button>

                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {syncError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
              className="underline font-semibold shrink-0"
            >
              OAuth Domain Setup
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cloud Files in Bairaq_Al_Wafrah_ERP Folder */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Google Drive Folder Contents (/{DRIVE_FOLDER_NAME})
              </h3>
              <p className="text-xs text-slate-500">
                Synchronized database JSON and exported A4 Invoice &amp; Statement PDFs
              </p>
            </div>
            {isConnected && (
              <button
                onClick={onRefreshFiles}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>

          {!isConnected ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Click &ldquo;Connect Google Drive&rdquo; above to enable automatic multi-device backup &amp; sync
              </p>
              <p className="text-xs text-slate-500">
                All local edits are automatically saved in your browser and will sync as soon as you connect.
              </p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No files in /{DRIVE_FOLDER_NAME} yet.
              </p>
              <button
                onClick={() => setPendingAction({ type: 'push_overwrite' })}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Save Initial Workspace Database to Drive
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white font-mono-tabular">
                      {file.name}
                    </div>
                    <div className="text-slate-500">
                      <span>{file.mimeType}</span>
                      {file.modifiedTime && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>
                            Updated {new Date(file.modifiedTime).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 rounded hover:bg-teal-100"
                      >
                        Open in Drive <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() =>
                        setPendingAction({
                          type: 'delete_file',
                          fileId: file.id,
                          fileName: file.name,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete file from Google Drive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Portable JSON Backup + Optional Advanced OAuth Domain Config */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FileJson className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Portable JSON Database Backup
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Download your complete workspace database as a standalone <code className="font-mono-tabular">.json</code> file or restore from a backup file on any device.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleExportLocalJson}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Export Full Backup (.json)
              </button>

              <label className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import Backup (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>
            </div>
            {lastSyncedTime && (
              <div className="text-[11px] text-slate-500 pt-1">
                Last cloud sync: {new Date(lastSyncedTime).toLocaleString()}
              </div>
            )}
          </div>

          {/* Collapsible Advanced OAuth Origin & Client ID Helper */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                Advanced OAuth Origin &amp; Client ID
              </span>
              <span className="text-[11px] text-[#0088FF]">
                {showAdvancedOAuth ? 'Hide' : 'Configure'}
              </span>
            </button>

            {showAdvancedOAuth && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                {copiedFeedback && (
                  <div className="text-[11px] font-semibold text-emerald-600">
                    {copiedFeedback}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Authorized JavaScript Origin (App URL)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={currentOrigin}
                      className="flex-1 px-2.5 py-1.5 text-[11px] font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyText(currentOrigin, 'Copied Origin!')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-lg shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Custom OAuth 2.0 Web Client ID
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder={getDefaultOAuthClientId()}
                      className="flex-1 px-2.5 py-1.5 text-[11px] font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleSaveClientId}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-[#0088FF] text-white rounded-lg shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
