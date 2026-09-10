// Chiffrement de bout en bout — primitives WebCrypto (aucune dépendance).
//
// Modèle : chaque utilisateur a une paire ECDH P-256 (« identité »). La clé privée
// est chiffrée par une clé dérivée du mot de passe (PBKDF2) puis stockée telle
// quelle sur le serveur — le serveur ne peut jamais la lire.
// Chaque conversation chiffrée a une clé AES-GCM 256 ; elle est livrée à chaque
// membre dans une enveloppe scellée vers sa clé publique (ECDH éphémère → AES-GCM).

const subtle = globalThis.crypto?.subtle;
const PBKDF2_ITERS = 250_000;

// --- base64 / bytes -------------------------------------------------------
/** Vue → ArrayBuffer indépendant (évite les soucis de typage BufferSource). */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}
export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
/** Renvoie un ArrayBuffer (accepté partout par WebCrypto). */
export function b64decode(str: string): ArrayBuffer {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function rand(n: number): ArrayBuffer {
  return ab(globalThis.crypto.getRandomValues(new Uint8Array(n)));
}
const enc = new TextEncoder();
const dec = new TextDecoder();

// --- Identité (ECDH P-256) ----------------------------------------------------
export interface Identity {
  publicKeyB64: string;
  privateKey: CryptoKey;
}

async function importPrivateKey(pkcs8: BufferSource): Promise<CryptoKey> {
  return subtle.importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveKey',
    'deriveBits',
  ]);
}
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return subtle.importKey('raw', b64decode(b64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

export async function generateIdentity(): Promise<{ publicKeyB64: string; privatePkcs8: ArrayBuffer }> {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
  const pub = await subtle.exportKey('raw', pair.publicKey);
  const priv = await subtle.exportKey('pkcs8', pair.privateKey);
  return { publicKeyB64: b64encode(pub), privatePkcs8: priv };
}

// --- Enveloppe de la clé privée par le mot de passe --------------------------
async function passwordKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', ab(enc.encode(password)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapPrivateKey(privatePkcs8: ArrayBuffer, password: string): Promise<string> {
  const salt = rand(16);
  const iv = rand(12);
  const key = await passwordKey(password, salt);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, privatePkcs8);
  return JSON.stringify({ salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) });
}

/** Déchiffre l'enveloppe → octets pkcs8 en clair. Lève si le mot de passe est faux. */
export async function decryptPrivatePkcs8(blob: string, password: string): Promise<ArrayBuffer> {
  const { salt, iv, ct } = JSON.parse(blob) as { salt: string; iv: string; ct: string };
  const key = await passwordKey(password, b64decode(salt));
  return subtle.decrypt({ name: 'AES-GCM', iv: b64decode(iv) }, key, b64decode(ct));
}

/** Importe une clé privée déjà déchiffrée (cache local de l'appareil). */
export async function importCachedPrivateKey(pkcs8B64: string): Promise<CryptoKey> {
  return importPrivateKey(b64decode(pkcs8B64));
}

// --- Clé de conversation (AES-GCM 256) --------------------------------------
export async function generateChannelKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function ecdhAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface KeyEnvelope {
  ephemeralPublicKey: string;
  iv: string;
  wrappedKey: string;
}

/** Scelle la clé de conversation vers la clé publique d'un destinataire. */
export async function wrapChannelKeyFor(
  channelKey: CryptoKey,
  recipientPublicKeyB64: string,
): Promise<KeyEnvelope> {
  const ephem = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const recipientPub = await importPublicKey(recipientPublicKeyB64);
  const wrapKey = await ecdhAesKey(ephem.privateKey, recipientPub);
  const iv = rand(12);
  const raw = await subtle.exportKey('raw', channelKey);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
  return {
    ephemeralPublicKey: b64encode(await subtle.exportKey('raw', ephem.publicKey)),
    iv: b64encode(iv),
    wrappedKey: b64encode(ct),
  };
}

/** Ouvre l'enveloppe reçue → clé de conversation importée (non extractible). */
export async function unwrapChannelKey(env: KeyEnvelope, myPrivateKey: CryptoKey): Promise<CryptoKey> {
  const ephemPub = await importPublicKey(env.ephemeralPublicKey);
  const wrapKey = await ecdhAesKey(myPrivateKey, ephemPub);
  const raw = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(env.iv) },
    wrapKey,
    b64decode(env.wrappedKey),
  );
  return subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// --- Messages --------------------------------------------------------------
export async function encryptText(channelKey: CryptoKey, plaintext: string): Promise<{ ct: string; iv: string }> {
  const iv = rand(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, channelKey, ab(enc.encode(plaintext)));
  return { ct: b64encode(ct), iv: b64encode(iv) };
}

export async function decryptText(channelKey: CryptoKey, ctB64: string, ivB64: string): Promise<string> {
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64) },
    channelKey,
    b64decode(ctB64),
  );
  return dec.decode(pt);
}

export const cryptoSupported = !!subtle;
