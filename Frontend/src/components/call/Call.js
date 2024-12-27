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
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import useSocket from '../../hooks/useSocket';
import { saveAs } from 'file-saver';

export default function Call() {
    const [client, setClient] = useState(null);
    const [call, setCall] = useState(null);
    const [message, setMessage] = useState("");
    const [recognitionResult, setRecognitionResult] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [participantsCount, setParticipantsCount] = useState(0);
    const [receivedResults, setReceivedResults] = useState(0);
    const { auth } = useAuth();
    const { username, streamToken } = auth;
    const { callType, callId } = useParams();
    const streamRef = useRef(null);
    const location = useLocation();
    const [isConfirming, setIsConfirming] = useState(false);    
    const queryParams = new URLSearchParams(location.search);
    const groupOwner = queryParams.get('groupOwner');
    const { socket } = useSocket();
    // Khởi tạo video call
    useEffect(() => {
        const startLocalVideo = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;

                const apiKey = '3w47ynjjggn4';
                const token = streamToken;
                const userId = username;

                const user = {
                    id: userId,
                    name: username,
                    image: auth.image || `https://getstream.io/random_svg/?id=${username}&name=${username}`,
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

    // Chụp khung hình từ luồng video
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

    // Gửi khung hình tới API phân tích khuôn mặt
    const uploadFrameToAPI = async (blob) => {
        setIsLoading(true);
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('videoImage', file);
        formData.append('avatarUrl', auth.image || '');
    
        try {
            const response = await axios.post('https://smoothly-tough-sturgeon.ngrok-free.app/api/face/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
    
            console.log("Face recognition result from API:", response.data); // Log dữ liệu từ API
    
            const resultData = {
                userId: auth.username,
                ...response.data
            };
    
            setRecognitionResult((prevResults) => [
                ...prevResults,
                resultData
            ]);
    
            socket.emit('face_detect_result', {
                owner: groupOwner,
                result: resultData
            });
    
            console.log("Sent result to socket server:", {
                owner: groupOwner,
                result: resultData
            }); // Log dữ liệu gửi qua socket
    
        } catch (err) {
            console.error("Face recognition error:", err);
            setMessage("An error occurred while recognizing the face.");
        } finally {
            setIsLoading(false);
        }
    };
    

    // Gửi yêu cầu phát hiện khuôn mặt tới các thành viên trong cuộc gọi
    const requestFaceDetection = () => {
        if (!call) return;
        setRecognitionResult([]);
        setReceivedResults(0);
    
        const participantIds = call.state?.participants
            .map((member) => member.userId)
            .filter((userId) => userId !== groupOwner); // Loại bỏ owner khỏi danh sách
    
        setParticipantsCount(participantIds.length)
    
        socket.emit('detect_face', { 
            memberIds: participantIds, 
            owner: auth.username 
        });
    
        setMessage("Request sent to participants for face detection");
    };
    

    // Xử lý các sự kiện từ socket
    useEffect(() => {
        if (!socket) return;

        // Khi nhận được yêu cầu phát hiện khuôn mặt từ owner
        const handleRequestFaceDetect = (data) => {
            const { owner } = data;
            console.log("Received request_face_detect:", data);
            setIsConfirming(true);
        };

        const handleReceiveFaceResult = (data) => {
            const { result } = data;
            console.log(`Received face detect result:`, result);

            setRecognitionResult((prevResults) => [
                ...prevResults,
                result,
            ]);
            setReceivedResults(prev => prev + 1);
        };

        socket.on('request_face_detect', handleRequestFaceDetect);
        socket.on('receive_face_result', handleReceiveFaceResult);

        return () => {
            socket.off('request_face_detect', handleRequestFaceDetect);
            socket.off('receive_face_result', handleReceiveFaceResult);
        };
    }, [socket]);
    useEffect(() => {
        if (receivedResults > 0 && receivedResults === participantsCount) {
            generateCSV();
            setReceivedResults(0);  // Reset sau khi tải file
        }
    }, [receivedResults, participantsCount]);

    if (!call || !client) {
        return (
            <div className="w-full">
                <Loading />
            </div>
        );
    }
    const handleAcceptRequest = () => {
        setIsConfirming(false);
        captureFrameFromStream(); // Trigger face detection
    };

    const handleRejectRequest = () => {
        setIsConfirming(false);
        console.log("Face detection request rejected.");
    };
    const generateCSV = () => {
        if (recognitionResult.length === 0) {
            setMessage("No data to export.");
            return;
        }
    
        const header = "User,Similarity,Age,Gender,Race,Emotion\n";
        const csvRows = recognitionResult.map(result => {
            const gender = result.details.gender.Woman > result.details.gender.Man ? 'Nữ' : 'Nam';
            return `${result.recognized? result.userId:'Không rõ'},${result.similarity.toFixed(2)},${result.details.age},${gender},${result.details.race},${result.details.emotion}`;
        });
    
        const csvContent = header + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
        const fileName = `attendance_${callId}_${dateStr}_${timeStr}.csv`;
    
        saveAs(blob, fileName);
    };
console.log(call.state.participants)
console.log(socket.id)
    return (
        <>
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <MyUILayout callType={callType} />
                    {/* {auth.username === groupOwner && 
                    recognitionResult.map((result, index) => (
                        <div key={index} className="face-result"  style={{
                            position: 'absolute',
                            top: `${20 + index * 100}px`,
                            right: '20px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            padding: '10px',
                            borderRadius: '5px',
                            zIndex: 1000,
                        }}>
                            <p><strong>User:</strong> {result.recognized? result.userId:'Không rõ'}</p>
                            <p><strong>Similarity:</strong> {result.similarity.toFixed(2)}</p>
                            <p><strong>Age:</strong> {result.details.age}</p>
                            <p><strong>Gender:</strong> {result.details.gender.Woman > result.details.gender.Man ? 'Nữ' : 'Man'}</p>
                            <p><strong>Race:</strong> {result.details.race}</p>
                            <p><strong>Emotion:</strong> {result.details.emotion}</p>
                        </div>
                    ))} */}

                    {isLoading && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                padding: '20px',
                                borderRadius: '5px',
                                zIndex: 1000,
                            }}
                        >
                            <p>Recognizing face...</p>
                        </div>
                    )}
                    {isConfirming && (
                        <div style={{
                            position: 'fixed',
                            top: '30%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            color: '#fff',
                            padding: '30px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            zIndex: 1000,
                            width: '300px',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
                        }}>
                            <h2 style={{
                                marginBottom: '20px',
                                fontSize: '1.5em',
                                fontWeight: 'bold',
                            }}>
                                Face Detection Request
                            </h2>
                            <p style={{
                                marginBottom: '20px',
                                fontSize: '1em',
                            }}>
                                {groupOwner} is requesting to detect your face. Do you agree?
                            </p>
                            <button 
                                onClick={handleAcceptRequest} 
                                style={{
                                    padding: '10px 20px',
                                    margin: '10px',
                                    backgroundColor: '#007bff',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '1em',
                                    transition: 'background-color 0.3s',
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
                            >
                                Accept
                            </button>
                            <button 
                                onClick={handleRejectRequest} 
                                style={{
                                    padding: '10px 20px',
                                    margin: '10px',
                                    backgroundColor: '#dc3545',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '1em',
                                    transition: 'background-color 0.3s',
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                            >
                                Reject
                            </button>
                        </div>
                    )}

                </StreamCall>
            </StreamVideo>

            {auth.username === groupOwner &&
                <button onClick={requestFaceDetection} style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: '10px 20px',
                    backgroundColor: '#007BFF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                }}>
                    Detect Face
                </button>
            }

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
        return <div>Please grant camera and microphone permissions to continue.</div>;
    }

    return (
        <StreamTheme>
            <SpeakerLayout participantsBarPosition="bottom" />
            <CallControls />
        </StreamTheme>
    );
};
