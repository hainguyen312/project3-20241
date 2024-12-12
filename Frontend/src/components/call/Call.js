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
    const [message, setMessage] = useState("");
    const [recognitionResult, setRecognitionResult] = useState(null); // Lưu kết quả nhận diện
    const { auth } = useAuth();
    const { username, streamToken } = auth;
    const { callType, callId } = useParams();
    const streamRef = useRef(null); // Sử dụng useRef để lưu trữ stream

    useEffect(() => {
        const startLocalVideo = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream; // Lưu stream vào useRef

                // Cấu hình Stream.io
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
                await videoCall.join({ create: true, localMedia: { video: stream, audio: stream } });
                setCall(videoCall);
            } catch (err) {
                console.error("Error accessing local media devices:", err);
                setMessage("Please grant camera and microphone permissions.");
            }
        };

        startLocalVideo();

        return () => {
            if (client) client.disconnectUser();
            if (call) call.leave();
        };
    }, [streamToken, username, callId, auth.image]);

    const captureFrameFromStream = () => {
        if (!streamRef.current) {
            setMessage("No video stream available.");
            return;
        }

        const videoTrack = streamRef.current.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);

        imageCapture.takePhoto()
            .then((blob) => {
                console.log("Captured frame for face recognition.", blob);
                uploadFrameToAPI(blob);
            })
            .catch((err) => {
                console.error("Error capturing frame:", err);
            });
    };

    const uploadFrameToAPI = async (blob) => {
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('videoImage', file);
        formData.append('avatarUrl', auth.image || '');

        try {
            const response = await axios.post('/api/face/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            console.log("Face recognition result:", response.data);
            setRecognitionResult(response.data); // Lưu kết quả vào state
        } catch (err) {
            console.error("Face recognition error:", err);
        }
    };

    // Tự động ẩn kết quả nhận diện sau 5 giây
    useEffect(() => {
        if (recognitionResult) {
            const timer = setTimeout(() => {
                setRecognitionResult(null);
            }, 20000);
            return () => clearTimeout(timer);
        }
    }, [recognitionResult]);

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
                    <MyUILayout callType={callType} />
                    {/* Hiển thị kết quả nhận diện nếu có */}
                    {recognitionResult && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                padding: '10px',
                                borderRadius: '5px',
                                zIndex: 1000,
                            }}
                        >
                            <p><strong>Name:</strong> {recognitionResult.recognized ? auth.username : 'Can not recognized'}</p>
                            <p><strong>Similarity:</strong> {recognitionResult.similarity.toFixed(2)}</p>
                            <p><strong>Age:</strong> {recognitionResult.details.age}</p>
                            <p><strong>Gender:</strong> {
                                recognitionResult.details.gender.Woman > recognitionResult.details.gender.Man
                                    ? 'Woman'
                                    : 'Man'
                            }</p>
                            <p><strong>Race:</strong> {recognitionResult.details.race}</p>
                            <p><strong>Emotion:</strong> {recognitionResult.details.emotion}</p>
                        </div>
                    )}

                </StreamCall>
            </StreamVideo>
            <button
                onClick={captureFrameFromStream}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: '10px 20px',
                    backgroundColor: '#007BFF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                }}
            >
                Detect Face
            </button>
            {message && <div>{message}</div>}
        </>
    );
}

export const MyUILayout = ({ callType }) => {
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
        </StreamTheme>
    );
};
