import { createContext, useState, useEffect } from "react";
import useAuth from "../hooks/useAuth";
import io from "socket.io-client";

const SocketContext = createContext({});
let socketInstance = null; // Biến toàn cục để lưu socket instance

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [inComingCall, setInComingCall] = useState(null);
    const { auth } = useAuth();

    useEffect(() => {
        if (auth?.username) {
            if (socketInstance) {
                console.log("Reusing existing socket:", socketInstance.id);
                setSocket(socketInstance);
            } else {
                // Tạo socket mới nếu chưa tồn tại
                const newSocket = io("https://project3-20241-1.onrender.com", {
                    query: { username: auth.username },
                });
                socketInstance = newSocket; // Gán socket mới cho biến toàn cục
                setSocket(newSocket);

                newSocket.on("connect", () => {
                    console.log("Socket connected:", newSocket.id);
                    localStorage.setItem("SocketID", newSocket.id);
                });

                newSocket.on("disconnect", () => {
                    console.log("Socket disconnected:", newSocket.id);
                    localStorage.removeItem("SocketID");
                });
            }

            return () => {
                if (socketInstance) {
                    socketInstance.disconnect();
                    socketInstance = null; // Đảm bảo biến toàn cục bị xóa khi socket disconnect
                }
            };
        }
    }, [auth]);

    return (
        <SocketContext.Provider
            value={{ socket, setSocket, inComingCall, setInComingCall }}
        >
            {children}
        </SocketContext.Provider>
    );
};

export default SocketContext;
