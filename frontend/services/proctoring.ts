export type ProctorEventType =
  | "FACE_ABSENT"
  | "MULTIPLE_FACES"
  | "GAZE_AWAY"
  | "TAB_SWITCH"
  | "WINDOW_BLUR";

export interface ProctorTelemetryEvent {
  type: "event";
  event_type: ProctorEventType;
  metadata?: Record<string, any>;
  webcam_snapshot_url?: string;
}

export interface ProctorHeartbeatMessage {
  type: "heartbeat";
  timestamp?: string;
}

export type ProctorSocketMessage =
  | ProctorTelemetryEvent
  | ProctorHeartbeatMessage
  | { type: "connected"; session_id: number; status: string }
  | { type: "heartbeat_ack"; server_time: string; status: string }
  | { type: "event_ack"; event_type: string; recorded: boolean }
  | { type: "error"; message: string };

export class ProctorWebSocketClient {
  private sessionId: number;
  private token: string;
  private onStatusChange?: (status: "connected" | "connecting" | "disconnected" | "error") => void;
  private onWarning?: (message: string) => void;
  private ws: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private reconnectTimeout: any = null;
  private isExplicitlyClosed: boolean = false;

  constructor(
    sessionId: number,
    token: string,
    onStatusChange?: (status: "connected" | "connecting" | "disconnected" | "error") => void,
    onWarning?: (message: string) => void
  ) {
    this.sessionId = sessionId;
    this.token = token;
    this.onStatusChange = onStatusChange;
    this.onWarning = onWarning;
  }

  public connect(): void {
    this.isExplicitlyClosed = false;
    this.onStatusChange?.("connecting");

    // Use current host or proxy default
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = typeof window !== "undefined" ? window.location.host : "127.0.0.1:8001";
    if (typeof window !== "undefined" && window.location.port === "3000") {
      host = `${window.location.hostname}:8001`;
    }
    const wsUrl = `${protocol}//${host}/api/ws/proctor/${this.sessionId}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChange?.("connected");
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "error" && this.onWarning) {
            this.onWarning(msg.message);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      this.ws.onerror = () => {
        this.onStatusChange?.("error");
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.onStatusChange?.("disconnected");

        // Attempt automatic reconnect if not closed explicitly
        if (!this.isExplicitlyClosed) {
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 4000);
        }
      };
    } catch (err) {
      this.onStatusChange?.("error");
    }
  }

  public sendEvent(eventType: ProctorEventType, metadata?: Record<string, any>, snapshotUrl?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload: ProctorTelemetryEvent = {
        type: "event",
        event_type: eventType,
        metadata,
        webcam_snapshot_url: snapshotUrl,
      };
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() }));
      }
    }, 10000); // 10 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange?.("disconnected");
  }
}
