import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import {
  IconVideo,
  IconVideoOff,
  IconCallEnd,
  IconMic,
  IconMicOff,
  IconScreenShare,
  IconStopScreenShare,
  IconFullscreen,
  IconFullscreenExit,
} from '@/lib/icons';

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 4,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const GUM: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
};

type PeerState = 'connecting' | 'connected' | 'failed';

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

// --- Detection "prend la parole" (WebAudio) --------------------------------
let sharedCtx: AudioContext | null = null;
function useSpeaking(stream: MediaStream | null | undefined, active = true) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || !active || stream.getAudioTracks().length === 0) {
      setSpeaking(false);
      return;
    }
    try {
      sharedCtx = sharedCtx ?? new AudioContext();
      const ctx = sharedCtx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let hold = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.045) hold = 8;
        setSpeaking(hold > 0);
        if (hold > 0) hold -= 1;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        src.disconnect();
        analyser.disconnect();
      };
    } catch {
      return;
    }
  }, [stream, active]);
  return speaking;
}

export default function CallRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const peers = useRef<Map<string, Peer>>(new Map());

  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<string, PeerState>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [callType, setCallType] = useState<'AUDIO' | 'VIDEO'>('VIDEO');
  const [notice, setNotice] = useState('');

  const removePeer = useCallback((id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setRemotes((r) => {
      const n = { ...r };
      delete n[id];
      return n;
    });
    setPeerStates((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const socket = connectSocket();
    let disposed = false;

    function getPeer(peerId: string): Peer {
      let peer = peers.current.get(peerId);
      if (peer) return peer;
      const pc = new RTCPeerConnection(ICE);
      peer = { pc, polite: (socket.id ?? '') > peerId, makingOffer: false, ignoreOffer: false };
      peers.current.set(peerId, peer);
      setPeerStates((s) => ({ ...s, [peerId]: 'connecting' }));

      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('call:signal', { roomId, to: peerId, data: { candidate: e.candidate } });
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) setRemotes((r) => ({ ...r, [peerId]: stream }));
      };
      pc.onnegotiationneeded = async () => {
        try {
          peer!.makingOffer = true;
          await pc.setLocalDescription();
          socket.emit('call:signal', { roomId, to: peerId, data: { sdp: pc.localDescription } });
        } catch {
          /* ignore */
        } finally {
          peer!.makingOffer = false;
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') pc.restartIce();
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected')
          setPeerStates((s) => ({ ...s, [peerId]: 'connected' }));
        else if (st === 'failed') setPeerStates((s) => ({ ...s, [peerId]: 'failed' }));
        else if (st === 'closed' || st === 'disconnected') removePeer(peerId);
      };
      return peer;
    }

    async function start() {
      // Type d'appel : AUDIO => camera desactivee au demarrage (comme WhatsApp).
      let type: 'AUDIO' | 'VIDEO' = 'VIDEO';
      try {
        type = (await api.get(`/calls/${roomId}`)).data.type ?? 'VIDEO';
      } catch {
        /* garde VIDEO par defaut */
      }
      if (disposed) return;
      setCallType(type);
      const wantVideo = type === 'VIDEO';
      setCamOn(wantVideo);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: GUM.audio,
          video: wantVideo ? GUM.video : false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream.current = stream;
        camTrack.current = stream.getVideoTracks()[0] ?? null;
        if (localRef.current) localRef.current.srcObject = stream;
        setReady(true);
        await api.post(`/calls/${roomId}/join`).catch(() => undefined);
        socket.emit('call:join', { roomId });
      } catch {
        setError("Impossible d'acceder au micro / a la camera. Verifiez les autorisations du navigateur.");
      }
    }

    const onPeerJoined = async ({ socketId }: { socketId: string }) => {
      const peer = getPeer(socketId);
      try {
        peer.makingOffer = true;
        await peer.pc.setLocalDescription();
        socket.emit('call:signal', { roomId, to: socketId, data: { sdp: peer.pc.localDescription } });
      } finally {
        peer.makingOffer = false;
      }
    };

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      const peer = getPeer(from);
      const { pc } = peer;
      try {
        if (data.sdp) {
          const desc = data.sdp as RTCSessionDescriptionInit;
          const offerCollision =
            desc.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;
          await pc.setRemoteDescription(desc);
          if (desc.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('call:signal', { roomId, to: from, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            if (!peer.ignoreOffer) throw new Error('ice');
          }
        }
      } catch {
        /* ignore transient negotiation errors */
      }
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => removePeer(socketId);
    const onDeclined = (p: { by?: string }) => {
      setNotice(`${p.by ?? 'Un participant'} a refuse l'appel`);
      window.setTimeout(() => setNotice(''), 4000);
    };

    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:signal', onSignal);
    socket.on('call:peer-left', onPeerLeft);
    socket.on('call:declined', onDeclined);
    start();

    return () => {
      disposed = true;
      socket.emit('call:leave', { roomId });
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:signal', onSignal);
      socket.off('call:peer-left', onPeerLeft);
      socket.off('call:declined', onDeclined);
      peers.current.forEach((p) => p.pc.close());
      peers.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      api.post(`/calls/${roomId}/leave`).catch(() => undefined);
    };
  }, [roomId, removePeer]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  function toggleMic() {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }
  async function toggleCam() {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
      return;
    }
    // Appel audio : on active la camera a la demande (nouvelle piste + renegociation).
    if (!localStream.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: GUM.video });
      const vt = s.getVideoTracks()[0];
      camTrack.current = vt;
      localStream.current.addTrack(vt);
      peers.current.forEach((p) => p.pc.addTrack(vt, localStream.current!));
      if (localRef.current) localRef.current.srcObject = localStream.current;
      setCamOn(true);
    } catch {
      setNotice("Impossible d'activer la camera");
      window.setTimeout(() => setNotice(''), 3000);
    }
  }

  function replaceVideoTrack(track: MediaStreamTrack | null) {
    peers.current.forEach((p) => {
      const sender = p.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track).catch(() => undefined);
      else if (track && localStream.current) p.pc.addTrack(track, localStream.current);
    });
  }

  async function toggleShare() {
    if (sharing) {
      // Revenir a la camera
      replaceVideoTrack(camTrack.current);
      if (localRef.current && localStream.current) localRef.current.srcObject = localStream.current;
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      replaceVideoTrack(screenTrack);
      if (localRef.current) localRef.current.srcObject = display;
      setSharing(true);
      screenTrack.onended = () => {
        replaceVideoTrack(camTrack.current);
        if (localRef.current && localStream.current) localRef.current.srcObject = localStream.current;
        setSharing(false);
      };
    } catch {
      /* annule */
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else gridRef.current?.requestFullscreen?.();
  }

  const remoteEntries = Object.entries(remotes);
  const participants = remoteEntries.length + 1;
  const anyFailed = Object.values(peerStates).some((s) => s === 'failed');
  const allConnected =
    remoteEntries.length > 0 && Object.values(peerStates).every((s) => s === 'connected');
  const netDot = anyFailed ? '#ef4444' : allConnected ? '#22c55e' : '#f59e0b';
  const localSpeaking = useSpeaking(localStream.current, micOn && ready);

  return (
    <div className="flex h-dvh flex-col bg-[#0f1012] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-md font-semibold sm:text-lg">
          {callType === 'VIDEO' ? (
            <IconVideo className="h-6 w-6 shrink-0 text-[var(--accent)]" />
          ) : (
            <IconMic className="h-6 w-6 shrink-0 text-[var(--accent)]" />
          )}
          <span className="truncate">{callType === 'VIDEO' ? 'Visio' : 'Appel audio'}</span>
          <span className="hidden font-mono text-xs text-white/40 sm:inline">· {roomId?.slice(0, 8)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-white/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: netDot }} />
            {anyFailed ? 'Reconnexion…' : allConnected ? 'Connecte' : 'Connexion…'}
          </span>
          <span>{participants} participant{participants > 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</div>
      )}
      {notice && (
        <div className="mx-4 mt-3 rounded-lg bg-white/10 px-3 py-2 text-center text-sm text-white/80">
          {notice}
        </div>
      )}

      <div
        ref={gridRef}
        className="grid flex-1 content-center gap-3 overflow-y-auto bg-[#0f1012] p-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}
      >
        <VideoTile
          stream={localStream.current}
          videoRef={localRef}
          muted
          label={sharing ? 'Vous (partage d’ecran)' : 'Vous'}
          camOff={!camOn && !sharing}
          micOff={!micOn}
          speaking={localSpeaking && !sharing}
          mirror={!sharing}
        />
        {remoteEntries.map(([id, stream]) => (
          <RemoteTile key={id} stream={stream} state={peerStates[id]} />
        ))}
        {remoteEntries.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-white/50">
            En attente d'autres participants…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 py-4 safe-b sm:gap-3">
        <CtrlButton onClick={toggleMic} active={micOn} label={micOn ? 'Micro' : 'Muet'} danger={!micOn}>
          {micOn ? <IconMic className="h-6 w-6" /> : <IconMicOff className="h-6 w-6" />}
        </CtrlButton>
        <CtrlButton onClick={toggleCam} active={camOn} label={camOn ? 'Camera' : 'Camera off'} danger={!camOn}>
          {camOn ? <IconVideo className="h-6 w-6" /> : <IconVideoOff className="h-6 w-6" />}
        </CtrlButton>
        <CtrlButton onClick={toggleShare} active={sharing} label={sharing ? 'Arreter' : 'Partager'}>
          {sharing ? (
            <IconStopScreenShare className="h-6 w-6" />
          ) : (
            <IconScreenShare className="h-6 w-6" />
          )}
        </CtrlButton>
        <CtrlButton onClick={toggleFullscreen} active={false} label={fullscreen ? 'Reduire' : 'Plein ecran'}>
          {fullscreen ? (
            <IconFullscreenExit className="h-6 w-6" />
          ) : (
            <IconFullscreen className="h-6 w-6" />
          )}
        </CtrlButton>
        <button
          onClick={() => navigate(-1)}
          className="ml-1 flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold transition hover:bg-red-700"
        >
          <IconCallEnd className="h-5 w-5" /> Quitter
        </button>
      </div>
    </div>
  );
}

function CtrlButton({
  onClick,
  active,
  danger,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  danger?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
      title={label}
    >
      <span
        className={clsx(
          'grid h-12 w-12 place-items-center rounded-full transition',
          danger
            ? 'bg-red-600 hover:bg-red-700'
            : active
              ? 'bg-white/20 hover:bg-white/30'
              : 'bg-white/10 hover:bg-white/20',
        )}
      >
        {children}
      </span>
      <span className="text-2xs text-white/60">{label}</span>
    </button>
  );
}

function VideoTile({
  stream,
  videoRef,
  muted,
  label,
  camOff,
  micOff,
  speaking,
  mirror,
  children,
}: {
  stream: MediaStream | null;
  videoRef?: RefObject<HTMLVideoElement>;
  muted?: boolean;
  label: string;
  camOff?: boolean;
  micOff?: boolean;
  speaking?: boolean;
  mirror?: boolean;
  children?: ReactNode;
}) {
  const innerRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? innerRef;
  useEffect(() => {
    if (!videoRef && innerRef.current && stream) innerRef.current.srcObject = stream;
  }, [stream, videoRef]);

  return (
    <div
      className={clsx(
        'relative aspect-video overflow-hidden rounded-2xl bg-black ring-2 transition',
        speaking ? 'ring-[var(--accent)]' : 'ring-transparent',
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={clsx('h-full w-full object-cover', mirror && 'scale-x-[-1]', camOff && 'invisible')}
      />
      {camOff && (
        <div className="absolute inset-0 grid place-items-center bg-[#1a1b1e] text-white/40">
          <IconVideoOff className="h-8 w-8" />
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/55 px-2 py-0.5 text-xs">
        {micOff && <IconMicOff className="h-3.5 w-3.5 text-red-300" />}
        <span className="truncate">{label}</span>
      </div>
      {children}
    </div>
  );
}

function RemoteTile({ stream, state }: { stream: MediaStream; state?: PeerState }) {
  const speaking = useSpeaking(stream);
  const vt = stream.getVideoTracks()[0];
  const hasVideo = !!vt && vt.readyState === 'live' && !vt.muted;
  return (
    <VideoTile
      stream={stream}
      label="Participant"
      speaking={speaking}
      camOff={!hasVideo}
      micOff={false}
      mirror={false}
    >
      {state === 'connecting' && (
        <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-2xs text-white/70">
          connexion…
        </span>
      )}
    </VideoTile>
  );
}
