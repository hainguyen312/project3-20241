import {
    CallingState,
    StreamCall,
    StreamVideo,
    StreamVideoClient,
    useCallStateHooks,
    StreamTheme,
    SpeakerLayout,
    CallControls
} from '@stream-io/video-react-sdk';
import { useEffect, useState, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import Loading from '../Loading';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function Call() {
    const [client, setClient] = useState(null);
    const [call, setCall] = useState(null);
    const [error, setError] = useState(null);
    const [faceData, setFaceData] = useState([]);
    const { auth } = useAuth();
    const { username, streamToken } = auth;
    const { callType, callId } = useParams();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const apiKey = '3w47ynjjggn4';
        const token = streamToken;
        const userId = username;

        const user = {
            id: userId,
            name: username,
            image: `https://getstream.io/random_svg/?id=oliver&name=${auth.image || username}`,
        };

        const videoClient = new StreamVideoClient({ apiKey, user, token });
        setClient(videoClient);

        const videoCall = videoClient.call('default', callId);

        videoCall
            .join({ create: true })
            .then(() => {
                setCall(videoCall);
            })
            .catch((error) => {
                setError(error);
            });

        return () => {
            videoClient.disconnectUser();
            setClient(null);
            if (videoCall) {
                videoCall.leave();
                setCall(null);
            }
        };
    }, [streamToken, username, callId, auth.image]);

    // Capture frame for face recognition
    const captureFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        const ctx = canvasElement.getContext('2d');

        // Set canvas size to video size
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Draw current frame on canvas
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Convert canvas to Blob and send to backend
        canvasElement.toBlob(async (blob) => {
            if (blob) {
                const formData = new FormData();
                formData.append('image', blob);

                try {
                    const response = await axios.post('/api/face/analyze', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                
                    setFaceData(response.data.faces); 
                } catch (err) {
                    console.error('Error in face recognition:', err);
                }                
            }
        }, 'image/jpeg');
    };

    useEffect(() => {
        const interval = setInterval(captureFrame, 5000); // Every 5 seconds
        return () => clearInterval(interval);
    }, []);

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    if (!call || !client) {
        return (
            <div className="w-full">
                <Loading />
            </div>
        );
    }

    return (
        <>
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <MyUILayout callType={callType} faceData={faceData} />
                </StreamCall>
            </StreamVideo>
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {/* Video element for capturing */}
            <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        </>
    );
}

export const MyUILayout = ({ callType, faceData }) => {
    const { useCallCallingState, useCameraState, useMicrophoneState } = useCallStateHooks();
    const cameraState = useCameraState();
    const micState = useMicrophoneState();
    const callingState = useCallCallingState();

    if (callingState !== CallingState.JOINED) {
        return <></>;
    }

    if (callType === 'audio') {
        cameraState.camera.disable();
    }

    if (!cameraState.hasBrowserPermission || !micState.hasBrowserPermission) {
        console.warn('Camera or microphone permissions are not granted.');
        return <div>Please grant camera and microphone permissions to continue.</div>;
    }

    return (
        <StreamTheme>
            <SpeakerLayout participantsBarPosition="bottom" />
            <CallControls />
            <FaceOverlay faceData={faceData} />
        </StreamTheme>
    );
};

const FaceOverlay = ({ faceData }) => {
    if (!faceData || faceData.length === 0) return null;

    return (
        <div className="face-overlay">
            {faceData.map((face, index) => (
                <div
                    key={index}
                    style={{
                        position: 'absolute',
                        top: face.y,
                        left: face.x,
                        width: face.width,
                        height: face.height,
                        border: '2px solid red',
                    }}
                >
                    <p>Emotion: {face.emotion}</p>
                    <p>Name: {face.name || 'Unknown'}</p>
                </div>
            ))}
        </div>
    );
};
