# Mockfy
<img width="1672" height="941" alt="Mockfy Demo" src="https://github.com/user-attachments/assets/7ae6bba7-3b70-4dc8-a868-2acf7199d38f" />

Mockfy is a real-time, low-latency audio streaming platform that achieves WebSocket-level performance using standard HTTP. 

By analyzing the network stack, we identified that the primary bottlenecks in real-time web audio are not the HTTP protocol itself, but the repeated TCP/TLS handshakes and payload serialization bloat. Mockfy bypasses these constraints by establishing a persistent HTTP connection via chunked transfer encoding and streaming raw Pulse-Code Modulation (PCM) audio bytes directly over the wire.

## Architecture & Engineering Focus

The system is designed to strip out unnecessary abstractions and control the data flow at the socket level.

* **Persistent HTTP (Chunked Transfer Encoding):** Instead of opening a new connection for every audio frame, the Next.js client establishes a single, long-lived `Connection: keep-alive` HTTP request. This restricts the Time-to-First-Byte (TTFB) TCP/TLS handshake penalty to the initial connection.
* **Zero Serialization Bloat:** Standard web audio implementations serialize data to JSON or Base64, inflating payload sizes by 33% and consuming CPU cycles. Mockfy captures 16kHz PCM audio natively and transmits raw binary chunks, eliminating encoding/decoding overhead.
* **Goroutine I/O Pipelining:** The Go backend reads incoming binary chunks and immediately pipes them to the Gemini API via `io.Pipe`. The system does not buffer the audio file in memory, ensuring immediate upstream transmission.

## Performance Metrics

* **Audio Frame Size:** 20ms to 40ms intervals (approximately 1024 - 2048 bytes of raw 16kHz PCM audio).
* **Network Transit Latency:** < 50ms end-to-end. By reusing the TCP socket and bypassing Base64 serialization, network latency was reduced to bare-metal constraints, leaving upstream API generation as the sole bottleneck.

## Technology Stack

* **Frontend:** Next.js, TypeScript (Raw PCM capture via Web Audio API)
* **Backend:** Go (net/http, io.Pipe concurrent streaming)
* **Database:** PostgreSQL (Neon serverless)
* **Upstream Integration:** Gemini API

## Setup and Execution

Prerequisites: Go 1.21+ and Node.js 18+

1. Clone the repository and navigate to the backend directory:
```bash
git clone [https://github.com/sainathmanda7/Mockfy.git](https://github.com/sainathmanda7/Mockfy.git)
cd Mockfy/backend
