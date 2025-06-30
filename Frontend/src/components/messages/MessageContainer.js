import {
  Channel, MessageInput, MessageList, Thread, Window, useChatContext,useChannelStateContext
} from 'stream-chat-react';
import {IoIosRecording ,IoIosVideocam, IoIosCall, IoIosMenu } from 'react-icons/io';
import Tippy from "@tippyjs/react";
import { MdDeleteOutline } from "react-icons/md";
import { CgLogOut } from "react-icons/cg";
import { confirmAlert } from 'react-confirm-alert';
import { EmojiPicker } from 'stream-chat-react/emojis';
import { init, SearchIndex } from 'emoji-mart';
import data from '@emoji-mart/data';
import useAxiosPrivate from '../../hooks/useAxiosPrivate';
import useSocket from '../../hooks/useSocket';
import useAuth from '../../hooks/useAuth';
import CustomMessage from './CustomMessage';
import styles from './MessageList.module.css';
import { useEffect, useState } from 'react';

init({ data });

const ChannelHeader = ({ channelData, members, memberIds, handleStartCall }) => {

  const { client, setActiveChannel } = useChatContext();
  const [showRecordings, setShowRecordings] = useState(false);
  const [recordings, setRecordings] = useState([]);

  const isGroup = channelData?.isGroup;

  const finalMemberIds = memberIds?.length ? memberIds : channelData?.members;

  const index = finalMemberIds.findIndex(id => id !== client.userID);

  const otherUser = members[Object.keys(members)[index]];

  const axiosPrivate = useAxiosPrivate();

  const deleteConversation = async () => {
    try {
      await axiosPrivate.put(`/api/chat/delete/${channelData?.cid}`)
    } catch (error) {
      console.log(error);
    }
  }

  const leaveGroup = async () => {
    axiosPrivate.put(`/api/group/leave/${channelData?.cid}`).then(() => {
      setActiveChannel(null);
    }).catch(error => {
      console.log(error);
    });
  }

  const actionConfirm = ({ action }) => {
    confirmAlert({
      closeOnEscape: true,
      closeOnClickOutside: true,
      customUI: ({ onClose }) => {
        return (
          <div className="bg-[rgba(39,38,38,0.1)] fixed inset-0 flex items-center justify-center ">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h1 className="text-xl text-black font-bold mb-4">{action === "Delete" ? 'Delete conversation' : 'Leave group'}</h1>
              {
                action === "Delete" ?
                  <p className="text-gray-600 mb-6">Every messages, files, audios in the conversation will be deleted.
                    <br></br>Action not reversible!</p>
                  : <p className="text-gray-600 mb-6">You will no longer have access to the chat.
                    <br></br>Action not reversible!</p>
              }
              <div className="flex justify-end">
                <button
                  className="mr-2 px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 text-white"
                  onClick={onClose}
                >
                  No
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  onClick={() => {
                    if (action === 'Delete')
                      deleteConversation();
                    else {
                      leaveGroup();
                    }
                    onClose();
                  }}
                >
                  {action === "Delete" ? 'Yes, confirm delete' : 'Yes, confirm leave'}
                </button>
              </div>
            </div>
          </div >
        );
      },
    });
  }

  const chatOptions = () => {
    return (
      <div className="w-auto h-auto flex flex-col gap-0">
        {
          (!isGroup || (isGroup && channelData?.created_by?.id === client.userID)) && (
            <div
              onClick={() => actionConfirm({ action: 'Delete' })}
              className="flex cursor-pointer space-x-2 text-red-500 text-base hover:bg-gray-200 font-medium text-center p-1"
            >
              <MdDeleteOutline size={24} />
              <span className='select-none'>Delete conversation</span>
            </div>
          )
        }
        {
          (isGroup && channelData?.created_by?.id !== client.userID) && (
            <div
              onClick={() => actionConfirm({ action: 'Leave' })}
              className="flex cursor-pointer space-x-2 text-red-500 text-base hover:bg-gray-200 font-medium text-center p-1"
            >
              <CgLogOut size={24} />
              <span className='select-none'>Leave group</span>
            </div>
          )
        }
      </div>
    );
  }

  // Hàm lấy danh sách recordings
  const fetchRecordings = async () => {
    try {
        // Lấy callId từ API
        const callResponse = await axiosPrivate.get(`/api/call?cid=${channelData?.cid}`);
        const callId = callResponse.data?.cid;

        if (!callId) {
            console.error('No call ID found');
            return;
        }

        // Lấy danh sách recordings với callId
        const response = await axiosPrivate.get(`/api/recording/${callId}`);
        setRecordings(response.data.recordings);
    } catch (error) {
        console.error('Error fetching recordings:', error);
    }
  };

  return (
    <div className='str-chat__header-livestream'>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="str-chat__avatar str-chat__avatar--rounded str-chat__message-sender-avatar">
          <img
            alt="K"
            className="str-chat__avatar-image str-chat__avatar-image--loaded"
            data-testid="avatar-img"
            src={isGroup ? channelData?.image :
              (otherUser?.user?.image || `https://getstream.io/random_svg/?id=oliver&name=${finalMemberIds[index]}`)}
          />
        </div>
        <div className="str-chat__header-livestream-left str-chat__channel-header-end">
          <p className="str-chat__header-livestream-left--title str-chat__channel-header-title">{isGroup ? channelData?.name : finalMemberIds[index]}</p>
        </div>
      </div>
      <div className='flex flex-row space-x-3'>
        <button className="call-button" onClick={() => handleStartCall('audio')}>
          <IoIosCall size={30} color='#007bff' />
        </button>
        <button className="call-button" onClick={() => handleStartCall('video')}>
          <IoIosVideocam size={30} color='#007bff' />
        </button>
        <button 
          className="showRecord-button" 
          onClick={() => {
            setShowRecordings(true);
            fetchRecordings();
          }}
        >
          <IoIosRecording size={30} color='#007bff' />
        </button>
        <Tippy
          content={chatOptions()}
          animation="scale"
          placement="bottom-end"
          interactive={true}
          theme={"light"}
          trigger='click'
        >
          <button className="call-button" >
            <IoIosMenu size={30} color='#007bff' />
          </button>
        </Tippy>
      </div>

      {showRecordings && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          zIndex: 1000,
          maxHeight: '80vh',
          overflowY: 'auto',
          width: '80%',
          maxWidth: '600px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2>Recordings</h2>
            <button onClick={() => setShowRecordings(false)} style={{
              padding: '5px 10px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}>
              Close
            </button>
          </div>
          {recordings.length === 0 ? (
            <p>No recordings available</p>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {recordings.map((recording, index) => (
                <div key={index} style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}>
                  <p><strong>Date:</strong> {new Date(recording.createdAt).toLocaleString()}</p>
                  <a href={recording.url} target="_blank" rel="noopener noreferrer" style={{
                    color: '#007BFF',
                    textDecoration: 'none'
                  }}>
                    Watch Recording
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MessageContainer = ({userId}) => {
  const { channel } = useChatContext();
  const { messages } = useChannelStateContext();
  const { auth } = useAuth();
  const { socket } = useSocket();
  const members = channel?.state?.members;
  const memberIds = Object.keys(members || []);
  const axiosPrivate = useAxiosPrivate();
  const groupOwner = channel?.data?.created_by?.id;
  const [scamAnalysis, setScamAnalysis] = useState({});

  // Thêm hàm để lấy user ID từ username
  const getUserById = async (username) => {
    try {
      const response = await axiosPrivate.get(`/api/group/findUser?keyword=${username}`);
      return response.data?._id;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!channel) return;

    const handleNewMessage = async (event) => {
      try {
        console.log('Analyzing message:', event.message.text);
        console.log('Message user:', event.user.name);

        if (!event.message.text || event.user.id === auth.username) {
          console.log('Skipping analysis - no text or own message');
          return;
        }

        // Lấy user ID từ username
        const userId = await getUserById(event.user.id);
        if (!userId) {
          console.error('Could not get user ID for:', event.user.id);
          return;
        }

        console.log('Calling scam detection API...');
        const response = await axiosPrivate.post('/api/scam/analyze', {
          message: event.message.text,
          senderId: userId
        });

        console.log('API response:', response.data);
        if (response.data.success) {
          setScamAnalysis(prev => ({
            ...prev,
            [event.message.id]: response.data.data
          }));
        }
      } catch (error) {
        console.error('Error analyzing message:', error);
      }
    };

    channel.on("message.new", handleNewMessage);

    return () => {
      channel.off("message.new", handleNewMessage);
    };
  }, [channel, axiosPrivate, auth.username]);

  const handleStartCall = async (callType) => {
    const callId = await axiosPrivate.get(`/api/call?cid=${channel?.data?.cid}`);
    if (callId?.data?.cid) {
      socket.emit('calling', {
        image: auth.image,
        callType: callType,
        isGroup: channel?.data?.isGroup,
        name: channel?.data?.name,
        memberIds: JSON.stringify(memberIds),
        callId: callId?.data?.cid,
        groupOwner:groupOwner
      });
      window.open(`/call/${callType}/${callId?.data?.cid}?groupOwner=${groupOwner}&groupName=${channel?.data?.name}&isGroup=${channel?.data?.isGroup?channel?.data?.isGroup:false}`, '_blank', 'width=1280,height=720');
    }
    else {
      alert('Error');
    }
  };

  const getGroupStyles = (message, previousMessage, nextMessage) => {
    if (!previousMessage) return styles.single;
    if (!nextMessage) return styles.bottom;
    if (message.user?.id !== previousMessage.user?.id) return styles.top;
    if (message.user?.id !== nextMessage.user?.id) return styles.bottom;
    return styles.middle;
  };
  return (
    <Channel 
      EmojiPicker={EmojiPicker} 
      emojiSearchIndex={SearchIndex}
    >
      <Window>
        <ChannelHeader channelData={channel?.data} members={members} memberIds={memberIds} handleStartCall={handleStartCall} />
        <MessageList 
          closeReactionSelectorOnClick
          disableDateSeparator 
          onlySenderCanEdit 
          showUnreadNotificationAlways={false}
          groupStyles={getGroupStyles}
          messageLimit={10}
          Message={(props) => <CustomMessage {...props} scamAnalysis={scamAnalysis} />}
        />
        <MessageInput focus audioRecordingEnabled />
      </Window>
      <Thread />
    </Channel>
  );
};

export default MessageContainer;
