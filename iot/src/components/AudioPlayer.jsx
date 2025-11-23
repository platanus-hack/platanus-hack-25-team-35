import React, { useRef, useState } from 'react';

export default function AudioPlayer({ filename, timestamp }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-12 shadow-sm border border-gray3 hover:border-gray4 transition-colors">
      <button
        onClick={togglePlay}
        className="w-12 h-12 rounded-full bg-gray5 hover:bg-gray6 active:bg-gray7 flex-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>

      <div className="flex-1">
        <div className="text-14 font-medium text-gray12">
          {formatDate(timestamp)}
        </div>
        <audio
          ref={audioRef}
          src={`/api/recordings/${filename}`}
          onEnded={handleEnded}
          className="w-full mt-2"
          controls
        />
      </div>
    </div>
  );
}

function IconPlay() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

