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
                console.log("Captured frame for face recognition.",blob);
                console.log("Blob type:", blob.type); // Log the MIME type
                console.log("Blob size:", blob.size); // Log the size of the blob

                uploadFrameToAPI(blob);
            })
            .catch((err) => {
                console.error("Error capturing frame:", err);
            });
    };

    const uploadFrameToAPI = async (blob) => {
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post('/api/face/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            console.log("Face recognition result:", response.data);
        } catch (err) {
            console.error("Face recognition error:", err);
        }
    };
    

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
