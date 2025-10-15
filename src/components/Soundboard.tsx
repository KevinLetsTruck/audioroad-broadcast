import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface SoundboardProps {
  showId: string;
}

interface AudioAsset {
  id: string;
  name: string;
  type: string;
  duration: number;
  fileUrl: string;
  color?: string;
  hotkey?: string;
}

export default function Soundboard({ showId }: SoundboardProps) {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchAssets();

    const newSocket = io();
    setSocket(newSocket);

    return () => {
      newSocket.close();
      audio?.pause();
    };
  }, [showId]);

  const fetchAssets = async () => {
    try {
      const response = await fetch(`/api/audio-assets?showId=${showId}`);
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error('Error fetching audio assets:', error);
    }
  };

  const playAsset = (asset: AudioAsset) => {
    // Stop currently playing audio
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    // Create and play new audio
    const newAudio = new Audio(asset.fileUrl);
    newAudio.play();
    setAudio(newAudio);
    setPlaying(asset.id);

    // Emit socket event
    socket?.emit('soundboard:play', {
      episodeId: showId,
      assetId: asset.id,
      assetName: asset.name
    });

    // Reset playing state when audio ends
    newAudio.onended = () => {
      setPlaying(null);
    };
  };

  const stopAudio = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(null);
    }
  };

  const assetsByType = {
    opener: assets.filter(a => a.type === 'opener'),
    bumper: assets.filter(a => a.type === 'bumper'),
    commercial: assets.filter(a => a.type === 'commercial'),
    closer: assets.filter(a => a.type === 'closer'),
    jingle: assets.filter(a => a.type === 'jingle'),
    sfx: assets.filter(a => a.type === 'sfx'),
  };

  const renderAssetButton = (asset: AudioAsset) => (
    <button
      key={asset.id}
      onClick={() => playAsset(asset)}
      disabled={playing === asset.id}
      className={`p-3 rounded font-semibold text-sm transition-all ${
        playing === asset.id
          ? 'bg-primary-700 animate-pulse'
          : asset.color
          ? `hover:opacity-80`
          : 'bg-gray-700 hover:bg-gray-600'
      }`}
      style={{
        backgroundColor: playing === asset.id ? undefined : asset.color || undefined
      }}
      title={asset.hotkey ? `Hotkey: ${asset.hotkey}` : ''}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{asset.name}</span>
        {asset.hotkey && (
          <span className="text-xs opacity-70">{asset.hotkey}</span>
        )}
      </div>
      <div className="text-xs opacity-70 mt-1">{asset.duration}s</div>
    </button>
  );

  return (
    <div className="space-y-6">
      {playing && (
        <button
          onClick={stopAudio}
          className="w-full py-3 bg-red-600 hover:bg-red-700 rounded font-bold text-lg"
        >
          ⏹ STOP AUDIO
        </button>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Openers</h4>
          <div className="grid gap-2">
            {assetsByType.opener.map(renderAssetButton)}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Bumpers</h4>
          <div className="grid gap-2">
            {assetsByType.bumper.map(renderAssetButton)}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Commercials</h4>
          <div className="grid gap-2">
            {assetsByType.commercial.map(renderAssetButton)}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Closers</h4>
          <div className="grid gap-2">
            {assetsByType.closer.map(renderAssetButton)}
          </div>
        </div>

        {assetsByType.jingle.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Jingles</h4>
            <div className="grid gap-2">
              {assetsByType.jingle.map(renderAssetButton)}
            </div>
          </div>
        )}

        {assetsByType.sfx.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase text-gray-400">Sound FX</h4>
            <div className="grid gap-2">
              {assetsByType.sfx.map(renderAssetButton)}
            </div>
          </div>
        )}
      </div>

      {assets.length === 0 && (
        <p className="text-center text-gray-400 py-8">
          No audio assets uploaded yet
        </p>
      )}
    </div>
  );
}

