import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from './AuthContext';
import {
  b64encode,
  cryptoSupported,
  decryptPrivatePkcs8,
  decryptText,
  encryptText,
  generateChannelKey,
  generateIdentity,
  importCachedPrivateKey,
  unwrapChannelKey,
  wrapChannelKeyFor,
  wrapPrivateKey,
  type KeyEnvelope,
} from '@/lib/crypto';

type Status = 'loading' | 'unsupported' | 'absent' | 'locked' | 'ready';

interface CryptoState {
  status: Status;
  supported: boolean;
  /** Le serveur détient une identité de chiffrement pour ce compte. */
  hasIdentity: boolean;
  publicKeyB64: string | null;
  /** Crée l'identité (première fois). `password` chiffre la clé privée. */
  setup: (password: string) => Promise<void>;
  /** Déverrouille l'identité existante sur cet appareil. */
  unlock: (password: string) => Promise<void>;
  /** Oublie la clé privée sur cet appareil (statut → locked). */
  lockDevice: () => void;
  /** Active / fait tourner le chiffrement d'une conversation. Renvoie la version. */
  enableChannelE2EE: (channelId: string, memberIds: string[]) => Promise<number>;
  encrypt: (channelId: string, version: number, text: string) => Promise<{ ct: string; iv: string }>;
  decrypt: (channelId: string, version: number, ivB64: string, ctB64: string) => Promise<string>;
}

const Ctx = createContext<CryptoState | undefined>(undefined);
const cacheKey = (userId: string) => `talkio.crypto.priv.${userId}`;

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [hasIdentity, setHasIdentity] = useState(false);
  const [publicKeyB64, setPublicKeyB64] = useState<string | null>(null);

  const privateKey = useRef<CryptoKey | null>(null);
  const channelKeys = useRef<Map<string, CryptoKey>>(new Map()); // `${channelId}:${version}`

  const reset = () => {
    privateKey.current = null;
    channelKeys.current.clear();
  };

  const loadCached = useCallback(async (userId: string): Promise<boolean> => {
    const cached = localStorage.getItem(cacheKey(userId));
    if (!cached) return false;
    try {
      privateKey.current = await importCachedPrivateKey(cached);
      return true;
    } catch {
      localStorage.removeItem(cacheKey(userId));
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!cryptoSupported) return setStatus('unsupported');
    if (!user) {
      reset();
      setStatus('loading');
      setHasIdentity(false);
      setPublicKeyB64(null);
      return;
    }
    setStatus('loading');
    try {
      const { data } = await api.get<{ publicKey: string | null }>('/crypto/identity/me');
      if (!data.publicKey) {
        setHasIdentity(false);
        setPublicKeyB64(null);
        setStatus('absent');
        return;
      }
      setHasIdentity(true);
      setPublicKeyB64(data.publicKey);
      setStatus((await loadCached(user.id)) ? 'ready' : 'locked');
    } catch {
      setStatus('absent');
    }
  }, [user, loadCached]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Invalide le cache d'une clé de conversation quand elle tourne (rekey).
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onRekey = (p: { channelId: string }) => {
      for (const k of [...channelKeys.current.keys()]) {
        if (k.startsWith(`${p.channelId}:`)) channelKeys.current.delete(k);
      }
    };
    socket.on('channel:e2ee', onRekey);
    return () => {
      socket.off('channel:e2ee', onRekey);
    };
  }, [user]);

  const setup = useCallback(
    async (password: string) => {
      const { publicKeyB64: pub, privatePkcs8 } = await generateIdentity();
      const encryptedPrivateKey = await wrapPrivateKey(privatePkcs8, password);
      await api.post('/crypto/identity', { publicKey: pub, encryptedPrivateKey });
      const b64 = b64encode(privatePkcs8);
      if (user) localStorage.setItem(cacheKey(user.id), b64);
      privateKey.current = await importCachedPrivateKey(b64);
      setHasIdentity(true);
      setPublicKeyB64(pub);
      setStatus('ready');
    },
    [user],
  );

  const unlock = useCallback(
    async (password: string) => {
      const { data } = await api.get<{ encryptedPrivateKey: string | null }>('/crypto/identity/me');
      if (!data.encryptedPrivateKey) throw new Error('Aucune identité de chiffrement');
      const pkcs8 = await decryptPrivatePkcs8(data.encryptedPrivateKey, password); // lève si mauvais mot de passe
      const b64 = b64encode(pkcs8);
      privateKey.current = await importCachedPrivateKey(b64);
      if (user) localStorage.setItem(cacheKey(user.id), b64);
      setStatus('ready');
    },
    [user],
  );

  const lockDevice = useCallback(() => {
    if (user) localStorage.removeItem(cacheKey(user.id));
    reset();
    setStatus(hasIdentity ? 'locked' : 'absent');
  }, [user, hasIdentity]);

  const getChannelKey = useCallback(async (channelId: string, version: number): Promise<CryptoKey> => {
    const ck = `${channelId}:${version}`;
    const hit = channelKeys.current.get(ck);
    if (hit) return hit;
    if (!privateKey.current) throw new Error('Chiffrement verrouillé');
    const { data } = await api.get<(KeyEnvelope & { version: number })[]>(
      `/channels/${channelId}/e2ee/keys`,
    );
    const env = data.find((e) => e.version === version);
    if (!env) throw new Error('Clé de conversation indisponible');
    const key = await unwrapChannelKey(env, privateKey.current);
    channelKeys.current.set(ck, key);
    return key;
  }, []);

  const enableChannelE2EE = useCallback(
    async (channelId: string, memberIds: string[]): Promise<number> => {
      if (!privateKey.current) throw new Error("Déverrouillez d'abord votre chiffrement");
      const ids = Array.from(new Set(memberIds));
      const { data: keys } = await api.get<{ userId: string; publicKey: string }[]>('/crypto/keys', {
        params: { userIds: ids.join(',') },
      });
      const byId = new Map(keys.map((k) => [k.userId, k.publicKey]));
      const missing = ids.filter((id) => !byId.has(id));
      if (missing.length) {
        const err = new Error('missing-keys') as Error & { missing: string[] };
        err.missing = missing;
        throw err;
      }
      const channelKey = await generateChannelKey();
      const currentVersion = await api
        .get<{ e2eeVersion?: number }>(`/channels/${channelId}`)
        .then((r) => r.data.e2eeVersion ?? 0)
        .catch(() => 0);
      const version = currentVersion + 1;
      const envelopes = await Promise.all(
        ids.map(async (userId) => ({
          userId,
          ...(await wrapChannelKeyFor(channelKey, byId.get(userId)!)),
        })),
      );
      await api.post(`/channels/${channelId}/e2ee`, { version, keys: envelopes });
      channelKeys.current.set(`${channelId}:${version}`, channelKey);
      return version;
    },
    [],
  );

  const encrypt = useCallback(
    async (channelId: string, version: number, text: string) => {
      const key = await getChannelKey(channelId, version);
      return encryptText(key, text);
    },
    [getChannelKey],
  );

  const decrypt = useCallback(
    async (channelId: string, version: number, ivB64: string, ctB64: string) => {
      const key = await getChannelKey(channelId, version);
      return decryptText(key, ctB64, ivB64);
    },
    [getChannelKey],
  );

  return (
    <Ctx.Provider
      value={{
        status,
        supported: cryptoSupported,
        hasIdentity,
        publicKeyB64,
        setup,
        unlock,
        lockDevice,
        enableChannelE2EE,
        encrypt,
        decrypt,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCrypto hors provider');
  return ctx;
}
