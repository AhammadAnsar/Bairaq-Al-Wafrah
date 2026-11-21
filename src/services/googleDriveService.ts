import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { WorkspaceDatabase } from '../types/billing';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const IDENTITY_SCOPES = 'openid email profile';
const CUSTOM_CLIENT_ID_STORAGE_KEY = 'bairaq_custom_oauth_client_id_v1';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Decoupled Identity-Only Provider (NO drive.file scope attached to /__/auth/handler)
const identityProvider = new GoogleAuthProvider();
identityProvider.setCustomParameters({ prompt: 'select_account' });

// Cache the access token in memory ONLY (never in localStorage or sessionStorage per security guidelines).
let cachedAccessToken: string | null = null;
let cachedUserProfile: GoogleUserProfile | null = null;

export const DRIVE_FOLDER_NAME = 'Bairaq_Al_Wafrah_ERP';
export const DRIVE_DB_FILENAME = 'bairaq_workspace_db.json';

export interface GoogleUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  mimeType?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export function getDefaultOAuthClientId(): string {
  return firebaseConfig.oAuthClientId || '';
}

export function getCustomOAuthClientId(): string {
  try {
    return localStorage.getItem(CUSTOM_CLIENT_ID_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setCustomOAuthClientId(clientId: string): void {
  try {
    const trimmed = clientId.trim();
    if (trimmed) {
      localStorage.setItem(CUSTOM_CLIENT_ID_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getActiveOAuthClientId(): string {
  return getCustomOAuthClientId() || getDefaultOAuthClientId();
}

export function getFirebaseRedirectHandlerUri(): string {
  return `https://${firebaseConfig.authDomain}/__/auth/handler`;
}

async function ensureGsiClientLoaded(): Promise<boolean> {
  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return true;
  }
  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      let checks = 0;
      const timer = setInterval(() => {
        checks += 1;
        if (window.google?.accounts?.oauth2?.initTokenClient) {
          clearInterval(timer);
          resolve(true);
        } else if (checks > 25) {
          clearInterval(timer);
          resolve(false);
        }
      }, 150);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.oauth2?.initTokenClient));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return {
      uid: 'google-operator',
      displayName: 'Bairaq Al-Wafrah Operator',
      email: 'ansarahammad369@gmail.com',
      photoURL: null,
    };
  }
  const data = await res.json();
  return {
    uid: data.sub || 'google-operator',
    displayName: data.name || data.email || 'Google User',
    email: data.email || null,
    photoURL: data.picture || null,
  };
}

function requestGisToken(scope: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const loaded = await ensureGsiClientLoaded();
    if (!loaded || !window.google?.accounts?.oauth2?.initTokenClient) {
      reject(new Error('Google Identity Services script could not be loaded.'));
      return;
    }

    const clientId = getActiveOAuthClientId();
    if (!clientId) {
      reject(new Error('No Google OAuth Client ID configured.'));
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        prompt: 'select_account',
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(
              new Error(
                response.error_description ||
                  response.error ||
                  'Google OAuth authorization was cancelled or denied.'
              )
            );
            return;
          }
          resolve(response.access_token);
        },
        error_callback: (err) => {
          reject(
            new Error(
              err?.message ||
                err?.type ||
                'Google OAuth popup was closed or blocked by browser.'
            )
          );
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(new Error(err?.message || 'Failed to initialize Google Identity Services.'));
    }
  });
}

export const initAuth = (
  onAuthSuccess?: (user: GoogleUserProfile, token?: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (cachedUserProfile) {
      if (onAuthSuccess) onAuthSuccess(cachedUserProfile, cachedAccessToken || undefined);
      return;
    }
    if (firebaseUser) {
      const profile: GoogleUserProfile = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      };
      cachedUserProfile = profile;
      if (onAuthSuccess) onAuthSuccess(profile, cachedAccessToken || undefined);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * STAGE 1: Decoupled Identity-Only Login (Does NOT request drive.file scope)
 * Uses Google Identity Services (GIS) with openid email profile first,
 * falling back to Firebase Identity-Only signInWithPopup without drive.file.
 */
export const googleSignInIdentityOnly = async (): Promise<{
  user: GoogleUserProfile;
  accessToken: string | null;
}> => {
  try {
    const token = await requestGisToken(IDENTITY_SCOPES);
    const profile = await fetchGoogleUserInfo(token);
    cachedUserProfile = profile;
    return { user: profile, accessToken: null };
  } catch (gisErr) {
    // Fallback to Firebase Auth without drive.file scope
    try {
      const result = await signInWithPopup(auth, identityProvider);
      const profile: GoogleUserProfile = {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
      };
      cachedUserProfile = profile;
      return { user: profile, accessToken: null };
    } catch (fbErr: any) {
      console.error('Decoupled Google Sign-In error:', gisErr, fbErr);
      throw new Error(
        fbErr?.message ||
          (gisErr as Error)?.message ||
          'Google Sign-In failed. Ensure this domain is added to Authorized JavaScript Origins or sign in with Operator Credentials below.'
      );
    }
  }
};

/**
 * STAGE 2: Dedicated Google Drive Sync Authorization via Google Identity Services (GIS) Token Flow.
 * Requests https://www.googleapis.com/auth/drive.file directly via GIS initTokenClient
 * without routing through Firebase's /__/auth/handler redirect URI.
 */
export const googleSignIn = async (): Promise<{
  user: GoogleUserProfile;
  accessToken: string;
} | null> => {
  const token = await requestGisToken(`${IDENTITY_SCOPES} ${DRIVE_SCOPE}`);
  cachedAccessToken = token;
  const profile = await fetchGoogleUserInfo(token);
  cachedUserProfile = profile;
  return { user: profile, accessToken: token };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  if (cachedAccessToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(cachedAccessToken);
    } catch {
      // Ignore revoke error
    }
  }
  cachedAccessToken = null;
  cachedUserProfile = null;
  try {
    await auth.signOut();
  } catch {
    // Ignore signout error
  }
};

/**
 * Finds or creates the dedicated Bairaq_Al_Wafrah_ERP folder in Google Drive.
 */
export async function ensureWorkspaceFolder(token: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Drive folder lookup failed (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Drive folder (${createRes.status})`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Lists all files created by this app inside the Bairaq_Al_Wafrah_ERP folder.
 */
export async function listWorkspaceDriveFiles(token: string): Promise<DriveFileMetadata[]> {
  const folderId = await ensureWorkspaceFolder(token);
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink,mimeType)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Failed to list Drive files (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Loads the synchronized bairaq_workspace_db.json file from Google Drive if it exists.
 */
export async function pullDatabaseFromDrive(
  token: string
): Promise<{ db: WorkspaceDatabase; fileId: string; modifiedTime: string } | null> {
  const folderId = await ensureWorkspaceFolder(token);
  const query = encodeURIComponent(
    `name = '${DRIVE_DB_FILENAME}' and '${folderId}' in parents and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error('Failed to search for database file on Google Drive');
  }

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    return null;
  }

  const dbFile = searchData.files[0];
  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${dbFile.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!downloadRes.ok) {
    throw new Error('Failed to download workspace database from Google Drive');
  }

  const db = (await downloadRes.json()) as WorkspaceDatabase;
  return {
    db,
    fileId: dbFile.id,
    modifiedTime: dbFile.modifiedTime || new Date().toISOString(),
  };
}

/**
 * Pushes (creates or updates) the WorkspaceDatabase JSON in Google Drive.
 */
export async function pushDatabaseToDrive(
  token: string,
  db: WorkspaceDatabase
): Promise<{ fileId: string; modifiedTime: string }> {
  const folderId = await ensureWorkspaceFolder(token);
  const query = encodeURIComponent(
    `name = '${DRIVE_DB_FILENAME}' and '${folderId}' in parents and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error('Failed to locate database file on Google Drive');
  }

  const searchData = await searchRes.json();
  const existingFileId: string | null =
    searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

  const metadata = existingFileId
    ? { name: DRIVE_DB_FILENAME, mimeType: 'application/json' }
    : { name: DRIVE_DB_FILENAME, mimeType: 'application/json', parents: [folderId] };

  const boundary = 'bairaq_drive_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const jsonContent = JSON.stringify(db, null, 2);
  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';

  const uploadRes = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to sync database to Google Drive (${uploadRes.status})`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    modifiedTime: result.modifiedTime || new Date().toISOString(),
  };
}

/**
 * Uploads a generated PDF Blob (Invoice + Statement of Accounts) directly to the Bairaq_Al_Wafrah_ERP Drive folder.
 */
export async function uploadPdfToDrive(
  token: string,
  fileName: string,
  pdfBlob: Blob
): Promise<DriveFileMetadata> {
  const folderId = await ensureWorkspaceFolder(token);

  const query = encodeURIComponent(
    `name = '${fileName}' and '${folderId}' in parents and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const searchData = searchRes.ok ? await searchRes.json() : { files: [] };
  const existingId =
    searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

  const metadata = existingId
    ? { name: fileName, mimeType: 'application/pdf' }
    : { name: fileName, mimeType: 'application/pdf', parents: [folderId] };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', pdfBlob);

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink';

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Failed to upload PDF to Google Drive (${res.status})`);
  }

  return (await res.json()) as DriveFileMetadata;
}

/**
 * Deletes a file from Google Drive (must ONLY be invoked after explicit user confirmation dialog).
 */
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete file from Google Drive (${res.status})`);
  }
}
