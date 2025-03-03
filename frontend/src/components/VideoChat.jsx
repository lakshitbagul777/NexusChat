import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallButton from "./CallButton";
import { getWebRTCConfig } from "../utils/webRTCConfig";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const VideoChat = () => {
    const socketRef = useRef(null);
    // const [peerConnection, setPeerConnection] = useState(null);
    const peerConnectionRef = useRef(null);
    const [interests, setInterests] = useState("");
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const iceCandidateQueue = useRef([]);
    const [userId, setUserId] = useState('');
    const [inCall, setInCall] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const targetSocketIdRef = useRef(null);
    const attempCallTimeoutRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        const newSocket = io(BACKEND_URL);
        socketRef.current = newSocket;
        // setUserId(newSocket.id);

        newSocket.on("connect", () => {
            // const tempUserId = `user_${newSocket.id}`;
            setUserId(newSocket.id);
            // newSocket.emit("register", tempUserId);
        });

        newSocket.on('incall-call-declined', ({ senderSocketId }) => {
            cleanupCall();
        })

        newSocket.on("start-call", async ({ targetSocketId, isCaller }) => {
            if (inCall) {
                // socketRef.current.emit('incall-call-declined',{ userId, targetSocketId })
                return;
            };

            clearTimeout(searchTimeoutRef.current);
            clearTimeout(attempCallTimeoutRef.current);

            targetSocketIdRef.current = targetSocketId;

            if (isCaller) {
                setInCall(true);
                await initiateCall(targetSocketId);
            } else {
                setInCall(true);
            }

        });

        newSocket.on('end-call', async () => {
            cleanupCall();
        })

        newSocket.on("offer", async (offer, senderSocketId) => {
            // console.log('offer received for call')
            // if (isConnecting && !targetSocketIdRef.current) {
            await handleOffer(offer, senderSocketId);
            // }
            // else {
            //     socketRef.current.emit('incall-call-declined', { userId, senderSocketId });
            // }
        });

        newSocket.on("answer", async (answer) => {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        newSocket.on("ice-candidate", async (candidate) => {
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                try {
                    await peerConnectionRef.current.addIceCandidate(candidate);
                } catch (error) {
                    console.error("Error adding ICE candidate:", error);
                }
            } else {
                console.log("Peer connection not ready, queuing ICE candidate");
                iceCandidateQueue.current.push(candidate);
            }
        });

        return () => newSocket.disconnect();
    }, []);

    const saveInterests = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/save-interests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, interests })
            });

            if (res.status === 200) {
                alert('Interests saved successfully!');
            } else {
                alert('Error occured while saving interests! Please try again..')
            }
        } catch (error) {
            alert('Error occured while saving interests! Please try again..');

        }
    };

    const startCall = async () => {
        let attempts = 0;
        setIsConnecting(true);
        const findMatch = async () => {
            if (attempts >= 5) { // Stop retrying after 5 attempts (adjust if needed)
                alert('No users found online! Try again later.');
                return;
            }

            const response = await fetch(`${BACKEND_URL}/meet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();
            console.log(data);

            if (data.matches.length > 0) {
                for (const match of data.matches) {
                    const success = await attemptCall(match);
                    if (success) return;
                }
            }

            attempts++;
            searchTimeoutRef.current = setTimeout(findMatch, 2000); // Retry after 2 seconds
        };

        const attemptCall = async (match) => {
            return new Promise((resolve) => {
                attempCallTimeoutRef.current = setTimeout(() => resolve(false), 5000); // Fails if no response in 5s

                socketRef.current.once('call-started', () => {
                    clearTimeout(attempCallTimeoutRef.current);
                    console.log(match.id);
                    resolve(true);
                });

                socketRef.current.emit("match-found", { callerId: userId, calleeId: match.id });
            });
        };

        findMatch();
    };

    const stopSearch = () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current); // Stop searching if the user clicks the stop button
        }
        setIsConnecting(false); // Stop the connecting state
    };

    const endCall = () => {

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current); // Stop searching for matches if in progress
        }

        if (targetSocketIdRef.current) {
            socketRef.current.emit("end-call", { userId, targetSocketId: targetSocketIdRef.current });
        }

        cleanupCall();
    };

    const cleanupCall = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localVideoRef.current?.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current?.srcObject) {
            remoteVideoRef.current.srcObject = null;
        }
        setInCall(false);
        socketRef.current.emit('make-available', { userId });
        targetSocketIdRef.current = null;
        setIsConnecting(false);
    };

    const initiateCall = async (targetSocketId) => {
        try {
            const pc = new RTCPeerConnection(getWebRTCConfig());
            peerConnectionRef.current = pc;

            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log(`Media stream received : ${stream}`);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socketRef.current.emit("ice-candidate", event.candidate, targetSocketId);
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socketRef.current.emit("offer", offer, targetSocketId);
        } catch (error) {
            console.error("Error starting call:", error);
            alert("Could not start the call. Please check your camera and microphone permissions.");
        }
    };

    const handleOffer = async (offer, senderSocketId) => {

        try {
            console.log('offer received for call')
            const pc = new RTCPeerConnection(getWebRTCConfig());
            peerConnectionRef.current = pc;

            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socketRef.current.emit("ice-candidate", event.candidate, senderSocketId);
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            while (iceCandidateQueue.current.length > 0) {
                const candidate = iceCandidateQueue.current.shift();
                try {
                    await pc.addIceCandidate(candidate);
                } catch (error) {
                    console.error("Error adding queued ICE candidate:", error);
                }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current.emit("answer", answer, senderSocketId);

        } catch (error) {
            console.error("Error handling offer:", error);
            // alert("Could not join the call. Please check your camera and microphone permissions.");
        }
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <h2 className="text-2xl font-bold mb-4">Video Chat</h2>
            <div className="w-full max-w-md bg-white p-4 rounded-2xl shadow-md">
                <label htmlFor="interests" className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your interests (space-separated):
                </label>
                <input
                    type="text"
                    id="interests"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="e.g., music sports technology"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                    onClick={saveInterests}
                    className="w-full mt-2 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
                >
                    Save Interests
                </button>
            </div>
            {!isConnecting && !targetSocketIdRef.current && (<CallButton onStartCall={startCall} />)}
            {isConnecting && !targetSocketIdRef.current && (
                <div className="text-center mt-4">
                    <div className="text-lg text-gray-700">Searching for a match...</div>
                    <button
                        onClick={stopSearch}
                        className="mt-2 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition"
                    >
                        Stop Search
                    </button>
                </div>
            )}
            {targetSocketIdRef.current && (
                <button
                    onClick={endCall}
                    className="mt-4 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition"
                >
                    End Call
                </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video rounded-2xl shadow-lg"
                />
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full aspect-video rounded-2xl shadow-lg"
                />
            </div>
        </div>

    );
};

export default VideoChat;
