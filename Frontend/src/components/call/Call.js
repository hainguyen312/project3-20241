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
    const [message, setMessage] = useState("");
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

    useEffect(() => {
        // Kiểm tra quyền truy cập camera và microphone
        navigator.permissions.query({ name: 'camera' }).then((result) => {
            if (result.state === 'granted') {
                // Nếu quyền truy cập đã được cấp
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then((stream) => {
                        videoRef.current.srcObject = stream;
                    })
                    .catch((err) => {
                        console.error("Error accessing camera: ", err);
                        setMessage("Error accessing camera.");
                    });
            } else if (result.state === 'prompt') {
                // Nếu quyền truy cập chưa được cấp, yêu cầu quyền
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then((stream) => {
                        videoRef.current.srcObject = stream;
                    })
                    .catch((err) => {
                        console.error("Error accessing camera: ", err);
                        setMessage("Camera access is denied.");
                    });
            } else {
                // Nếu quyền truy cập bị từ chối
                setMessage("Camera access is denied.");
            }
        }).catch((err) => {
            console.error("Permission error: ", err);
            setMessage("Error checking camera permissions.");
        });
    }, []);

    // Capture frame for face recognition
    const captureFrame = async () => {
        if (!videoRef.current || !canvasRef.current) {
            console.error("Video or canvas element is not available.");
            return;
        }

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        const ctx = canvasElement.getContext('2d');

        // Kiểm tra videoElement và canvasElement
        console.log('Video Element:', videoElement);
        console.log('Canvas Element:', canvasElement);

        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
            console.error("Video has no content.");
            return;
        }

        // Set canvas size to video size
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Draw current frame on canvas
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Convert canvas to Blob and send to backend
        canvasElement.toBlob(async (blob) => {
            if (blob) {
                console.log("Image captured successfully"); // Log when image is captured
                const formData = new FormData();
                formData.append('image', blob);

                try {
                    const response = await axios.post('/api/face/analyze', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    if (response.data.faces && response.data.faces.length > 0) {
                        setMessage("Face detected!");
                        setFaceData(response.data.faces);
                    } else {
                        setMessage("No faces detected.");
                        setFaceData([]);
                    }
                    console.log("Face recognition response:", response.data); // Log response
                } catch (err) {
                    console.error('Error in face recognition:', err);
                    setMessage("Error occurred during face recognition.");
                }
            } else {
                console.error("Failed to capture image, canvas blob is empty.");
            }
        }, 'image/jpeg');
    };

    const handleFaceRecognition = () => {
        setMessage(""); // Reset message before new recognition
        captureFrame();
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
            {/* Button for manual face recognition */}
            <button onClick={handleFaceRecognition}>Recognize Face</button>
            {/* Display messages */}
            {message && <div>{message}</div>}
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
    if (!faceData || faceData.length === 0) {
        console.log("No faces detected"); // Log if no faces are detected
        return null;
    }

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
