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
import { StreamChat } from 'stream-chat';
import { useEffect, useState, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import Loading from '../Loading';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import useSocket from '../../hooks/useSocket';
import { saveAs } from 'file-saver';
import useAxiosPrivate from '../../hooks/useAxiosPrivate';

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
    const groupName = queryParams.get('groupName');
    const isGroupParam = queryParams.get('isGroup');
    const isGroup = isGroupParam === 'true';
    const { socket } = useSocket();
    const [chatClient, setChatClient] = useState(null);
    const axiosPrivate = useAxiosPrivate();

    console.log(!isGroupParam,isGroupParam)
    // Khởi tạo video call
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage("");
            }, 5000);
    
            return () => clearTimeout(timer);
        }
    }, [message]);
    
    useEffect(() => {
        const startLocalVideo = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;

                const apiKey = '472pnwyznejm';
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

    // Khởi tạo Stream Chat client
    useEffect(() => {
        const client = StreamChat.getInstance('472pnwyznejm');
        setChatClient(client);
        return () => client.disconnectUser();
    }, []);

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
        console.log(formData)
    
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

    // Lắng nghe sự kiện recording
    useEffect(() => {
        if (!call) {
            console.log('Call object is null, cannot set up recording events');
            return;
        }

        console.log('Setting up recording event listeners for call:', call.id);

        const handleRecordingStarted = (event) => {
            console.log('Recording started event received:', event);
        };

        const handleRecordingStopped = (event) => {
            console.log('Recording stopped event received:', event);
        };

        const handleRecordingReady = async (event) => {
            try {
                console.log('Recording ready event received:', event);
                const { call_recording } = event;
                
                if (call_recording) {
                    console.log('Call recording data:', call_recording);

                    // Chỉ cho phép groupOwner gửi recording
                    if (auth.username === groupOwner) {
                        // Gửi URL và callId lên server
                        const response = await axiosPrivate.post('/api/recording/send', {
                            callId,
                            recordingUrl: call_recording.url,
                            channelId: callId
                        });

                        if (response.status === 200) {
                            console.log('Recording sent to chat successfully');
                        } else {
                            throw new Error('Failed to send recording to chat');
                        }
                    } else {
                        console.log('Not group owner, skipping recording save');
                    }
                } else {
                    console.log('No call_recording data in event');
                }
            } catch (error) {
                console.error('Error handling recording ready:', error);
                setMessage('Failed to process recording');
            }
        };

        const handleRecordingFailed = (error) => {
            console.error('Recording failed event received:', error);
            setMessage('Recording failed');
        };

        // Đăng ký các sự kiện recording
        call.on('call.recording_started', handleRecordingStarted);
        call.on('call.recording_stopped', handleRecordingStopped);
        call.on('call.recording_ready', handleRecordingReady);
        call.on('call.recording_failed', handleRecordingFailed);

        console.log('Recording event listeners set up successfully');

        return () => {
            console.log('Cleaning up recording event listeners');
            call.off('call.recording_started', handleRecordingStarted);
            call.off('call.recording_stopped', handleRecordingStopped);
            call.off('call.recording_ready', handleRecordingReady);
            call.off('call.recording_failed', handleRecordingFailed);
        };
    }, [call, callId]);

    if (!call || !client) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-100">
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
    
        const header = "User;Similarity;Age;Gender;Race;Emotion\n";
        const csvRows = recognitionResult.map(result => {
            const gender = result.details.gender.Woman > result.details.gender.Man ? 'Nữ' : 'Nam';
            return [
                result.recognized ? result.userId : 'Không rõ',
                result.similarity.toFixed(2),
                result.details.age,
                gender,
                result.details.race,
                result.details.emotion
            ].map(val => `"${val}"`).join(';');
        });
    
        const BOM = '\uFEFF';
        const csvContent = BOM + header + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
        const safeGroupName = groupName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `attendance_${safeGroupName}_${dateStr}_${timeStr}.csv`;
    
        saveAs(blob, fileName);
    };
    return (
        <div className="relative w-full h-screen bg-gray-900">
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <MyUILayout callType={callType} />
                    
                    {isLoading && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-70 text-white p-6 rounded-lg shadow-lg z-50">
                            <div className="flex items-center space-x-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                <p className="text-lg">Đang nhận diện khuôn mặt...</p>
                            </div>
                        </div>
                    )}

                    {isConfirming && (
                        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white p-8 rounded-xl shadow-2xl z-50 w-96">
                            <h2 className="text-2xl font-bold mb-4 text-center">
                                Yêu cầu nhận diện khuôn mặt
                            </h2>
                            <p className="text-center mb-6 text-gray-300">
                                {groupOwner} đang yêu cầu nhận diện khuôn mặt của bạn. Bạn có đồng ý không?
                            </p>
                            <div className="flex justify-center space-x-4">
                                <button 
                                    onClick={handleAcceptRequest}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
                                >
                                    Đồng ý
                                </button>
                                <button 
                                    onClick={handleRejectRequest}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium"
                                >
                                    Từ chối
                                </button>
                            </div>
                        </div>
                    )}
                </StreamCall>
            </StreamVideo>

            {auth.username === groupOwner && isGroup &&(
                <button 
                    onClick={requestFaceDetection}
                    className="fixed bottom-6 right-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span>Nhận diện khuôn mặt</span>
                </button>
            )}

            {message && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-lg shadow-lg z-50">
                    {message}
                </div>
            )}
        </div>
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
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center p-8 bg-black bg-opacity-70 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-lg">Vui lòng cấp quyền truy cập camera và microphone để tiếp tục.</p>
                </div>
            </div>
        );
    }

    return (
        <StreamTheme>
            <div className="relative w-full h-screen">
                <style>
                    {`
                        .str-video__participant-details {
                            background: rgba(0, 0, 0, 0.7) !important;
                            padding: 8px 12px !important;
                            border-radius: 8px !important;
                            backdrop-filter: blur(4px);
                        }
                        .str-video__participant-details__name {
                            color: white !important;
                            font-weight: 600 !important;
                            font-size: 14px !important;
                        }
                        .str-video__participant-details__status {
                            color: #e5e7eb !important;
                            font-size: 12px !important;
                        }
                        /* Style cho CallControls */
                        .str-video__call-controls {
                            background: rgba(0, 0, 0, 0.7) !important;
                            backdrop-filter: blur(4px);
                        }
                        .str-video__call-controls__button {
                            color: white !important;
                        }
                        .str-video__call-controls__button:hover {
                            background: rgba(255, 255, 255, 0.1) !important;
                        }
                        .str-video__call-controls__button--active {
                            background: rgba(255, 255, 255, 0.2) !important;
                        }
                        .str-video__call-controls__button--danger {
                            background: rgba(239, 68, 68, 0.8) !important;
                        }
                        .str-video__call-controls__button--danger:hover {
                            background: rgba(239, 68, 68, 1) !important;
                        }
                        .str-video__generic-menu--item {
                            color: #FFFFFF !important;
                        }
                    `}
                </style>
                <SpeakerLayout participantsBarPosition="bottom" />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                    <CallControls />
                </div>
            </div>
        </StreamTheme>
    );
};
