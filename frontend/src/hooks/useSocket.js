import { useEffect, useRef } from "react";

export function usePosSocket(onNewTicket, onTicketReady, onTableUpdate) {
  const socketRef = useRef(null);

  useEffect(() => {
    // Socket.IO / Channels hook point. Core POS uses polling until the backend realtime layer is enabled.
    socketRef.current = null;
    return () => {
      socketRef.current?.disconnect?.();
    };
  }, [onNewTicket, onTicketReady, onTableUpdate]);

  return socketRef;
}
