import { useEffect, useState, useRef } from "react"

const WS_URL = "ws://localhost:8081";

export const useSocket = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Only create a new WebSocket if one doesn't exist
        if (!wsRef.current) {
            console.log("Creating new WebSocket connection");
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;
            
            ws.onopen = () => {
                console.log("WebSocket connected");
                setSocket(ws);
            }

            ws.onclose = () => {
                console.log("WebSocket disconnected");
                setSocket(null);
                wsRef.current = null;
            }

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setSocket(null);
                wsRef.current = null;
            }
        }

        return () => {
            // Cleanup function - close WebSocket when component unmounts
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log("Closing WebSocket connection");
                wsRef.current.close();
                wsRef.current = null;
                setSocket(null);
            }
        }
    }, [])

    return socket;  
} 