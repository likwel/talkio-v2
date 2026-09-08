import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { IconGroups, IconVideo, IconVideoOff, IconCallEnd, IconMic, IconMicOff } from '@/lib/icons';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

/**
 * Salle d'appel audio/visio - maillage WebRTC (mesh) via signalisation Socket.IO.
 * Convient pour de petits groupes; pour de grandes visio, brancher un SFU.
 */
export default function CallRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId) return;
    const socket = connectSocket();
    let disposed = false;

    function createPeer(peerSocketId: string, initiator: boolean) {
      const pc = new RTCPeerConnection(ICE);
      peers.current.set(peerSocketId, pc);
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('call:signal', { roomId, to: peerSocketId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        setRemote((r) => ({ ...r, [peerSocketId]: e.streams[0] }));
      };
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          pc.close();
          peers.current.delete(peerSocketId);
          setRemote((r) => {
            const next = { ...r };
            delete next[peerSocketId];
            return next;
          });
        }
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('call:signal', { roomId, to: peerSocketId, data: { sdp: pc.localDescription } });
          });
      }
      return pc;
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        await api.post(`/calls/${roomId}/join`).catch(() => undefined);
        socket.emit('call:join', { roomId });
      } catch (err) {
        setError("Impossible d'acceder a la camera / au micro");
      }
    }

    const onPeerJoined = ({ socketId }: { socketId: string }) => {
      createPeer(socketId, true);
    };

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      let pc = peers.current.get(from);
      if (!pc) pc = createPeer(from, false);
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', { roomId, to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => undefined);
      }
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      peers.current.get(socketId)?.close();
      peers.current.delete(socketId);
      setRemote((r) => {
        const next = { ...r };
        delete next[socketId];
        return next;
      });
    };

    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:signal', onSignal);
    socket.on('call:peer-left', onPeerLeft);
    start();

    return () => {
      disposed = true;
      socket.emit('call:leave', { roomId });
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:signal', onSignal);
      socket.off('call:peer-left', onPeerLeft);
      peers.current.forEach((pc) => pc.close());
      peers.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      api.post(`/calls/${roomId}/leave`).catch(() => undefined);
    };
  }, [roomId]);

  function toggleMic() {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }
  function toggleCam() {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  const remoteEntries = Object.entries(remote);

  return (
    <div className="flex h-screen flex-col bg-[#131314] text-white">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2 text-lg font-normal">
          <IconGroups className="h-6 w-6 text-brand-400" /> Salle d'appel · {roomId?.slice(0, 8)}
        </div>
        <div className="text-sm text-slate-400">{remoteEntries.length + 1} participant(s)</div>
      </div>

      {error && <div className="mx-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</div>}

      <div className="grid flex-1 gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={localRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded-lg bg-black/50 px-2 py-0.5 text-xs">Vous</span>
        </div>
        {remoteEntries.map(([id, stream]) => (
          <RemoteVideo key={id} stream={stream} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 py-5">
        <button
          onClick={toggleMic}
          className={`grid h-12 w-12 place-items-center rounded-full transition ${
            micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={micOn ? 'Couper le micro' : 'Activer le micro'}
        >
          {micOn ? <IconMic className="h-6 w-6" /> : <IconMicOff className="h-6 w-6" />}
        </button>
        <button
          onClick={toggleCam}
          className={`grid h-12 w-12 place-items-center rounded-full transition ${
            camOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={camOn ? 'Couper la camera' : 'Activer la camera'}
        >
          {camOn ? <IconVideo className="h-6 w-6" /> : <IconVideoOff className="h-6 w-6" />}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-medium text-white transition hover:bg-red-700"
        >
          <IconCallEnd className="h-5 w-5" /> Quitter
        </button>
      </div>
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
    </div>
  );
}
